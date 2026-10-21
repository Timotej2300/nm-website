import { z } from "zod";
import { get, post, put, patch, del, parseInput, pageParams } from "../lib/http.js";
import { exec, query, queryOne, tx } from "../lib/db.js";
import { audit } from "../lib/audit.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { listStaffTickets, getStaffTicket, staffReply, staffNote, staffClaim, staffAssign, staffSetStatus, listCategories, ticketSettings } from "../lib/tickets.js";
import { setSetting } from "../lib/settings.js";
import { TICKET_STATUSES } from "../../shared/permissions.js";

const VIEW = ["tickets.view_assigned", "tickets.view_category", "tickets.view_all"];
const idOf = (ctx) => {
  const id = Number.parseInt(ctx.params.id, 10);
  if (!Number.isInteger(id) || id < 1) throw badRequest("Neplatné ID");
  return id;
};

// ───────────── team ticket queue ─────────────

get("/admin/tickets", { perm: VIEW }, async (ctx) => {
  const { page, size, offset } = pageParams(ctx.query);
  const res = await listStaffTickets(ctx.user, ctx.query, { offset, size });
  return { ...res, page, size, statuses: TICKET_STATUSES, categories: await listCategories({ includeDisabled: true }) };
});

get("/admin/tickets/:id", { perm: VIEW }, async (ctx) => ({ ticket: await getStaffTicket(ctx.user, idOf(ctx)) }));

const bodySchema = z.object({ body: z.string() });

post("/admin/tickets/:id/reply", { perm: "tickets.reply" }, async (ctx) => {
  const { body } = parseInput(bodySchema, ctx.body);
  await staffReply(ctx.user, idOf(ctx), body);
  return { ok: true };
});

post("/admin/tickets/:id/note", { perm: "tickets.internal_notes" }, async (ctx) => {
  const { body } = parseInput(bodySchema, ctx.body);
  await staffNote(ctx.user, idOf(ctx), body);
  await audit(ctx, "tickets.note", { targetType: "ticket", targetId: idOf(ctx), summary: "Pridaná interná poznámka" });
  return { ok: true };
});

post("/admin/tickets/:id/claim", { perm: "tickets.claim" }, async (ctx) => {
  await staffClaim(ctx.user, idOf(ctx));
  await audit(ctx, "tickets.claim", { targetType: "ticket", targetId: idOf(ctx), summary: "Ticket prevzatý" });
  return { ok: true };
});

post("/admin/tickets/:id/assign", { perm: "tickets.assign" }, async (ctx) => {
  const { userId } = parseInput(z.object({ userId: z.number().int().positive().nullable() }), ctx.body);
  await staffAssign(ctx.user, idOf(ctx), userId);
  await audit(ctx, "tickets.assign", { targetType: "ticket", targetId: idOf(ctx), summary: userId ? `Priradený používateľovi #${userId}` : "Priradenie zrušené" });
  return { ok: true };
});

post("/admin/tickets/:id/status", { perm: "tickets.change_status" }, async (ctx) => {
  const { status } = parseInput(z.object({ status: z.enum(TICKET_STATUSES) }), ctx.body);
  await staffSetStatus(ctx.user, idOf(ctx), status);
  await audit(ctx, "tickets.status", { targetType: "ticket", targetId: idOf(ctx), summary: `Stav → ${status}` });
  return { ok: true };
});

// ───────────── categories ─────────────

async function categoriesWithRoles() {
  const cats = await listCategories({ includeDisabled: true });
  const roles = await query("SELECT category_id, role_key FROM nm_ticket_category_roles");
  const counts = await query("SELECT category_id, COUNT(*) AS n FROM nm_tickets GROUP BY category_id");
  return cats.map((c) => ({
    ...c,
    enabled: Boolean(c.enabled),
    roles: roles.filter((r) => r.category_id === c.id).map((r) => r.role_key),
    tickets: counts.find((x) => x.category_id === c.id)?.n || 0,
  }));
}

get("/admin/ticket-categories", { perm: "tickets.manage_categories" }, async () => ({
  categories: await categoriesWithRoles(),
  roles: await query("SELECT role_key AS `key`, name FROM nm_roles WHERE role_key <> 'user' ORDER BY priority DESC"),
}));

const catSchema = z.object({
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(100),
  enabled: z.boolean().optional().default(true),
  roles: z.array(z.string().max(32)).max(30),
});

async function saveRoles(conn, id, roles) {
  if (roles.length) {
    const found = await query("SELECT role_key FROM nm_roles WHERE role_key IN (?)", [roles], conn);
    if (found.length !== new Set(roles).size) throw badRequest("Neznáma rola");
  }
  await exec("DELETE FROM nm_ticket_category_roles WHERE category_id = ?", [id], conn);
  for (const r of new Set(roles)) await exec("INSERT INTO nm_ticket_category_roles (category_id, role_key) VALUES (?, ?)", [id, r], conn);
}

post("/admin/ticket-categories", { perm: "tickets.manage_categories" }, async (ctx) => {
  const key = String(ctx.body?.key || "");
  if (!/^[a-z][a-z0-9_]{1,38}$/.test(key)) throw badRequest("Kľúč kategórie: malé písmená, číslice a _");
  const b = parseInput(catSchema, ctx.body);
  if (await queryOne("SELECT 1 FROM nm_ticket_categories WHERE cat_key = ?", [key])) throw conflict("Kategória už existuje");
  const id = await tx(async (conn) => {
    const r = await exec(
      "INSERT INTO nm_ticket_categories (cat_key, label, description, sort_order, enabled) VALUES (?, ?, ?, ?, ?)",
      [key, b.label, b.description ?? null, b.sortOrder, b.enabled ? 1 : 0],
      conn,
    );
    await saveRoles(conn, r.insertId, b.roles);
    return r.insertId;
  });
  await audit(ctx, "tickets.category_create", { targetType: "ticket_category", targetId: id, summary: `Kategória ${key}` });
  ctx.status = 201;
  return { id };
});

patch("/admin/ticket-categories/:id", { perm: "tickets.manage_categories" }, async (ctx) => {
  const id = idOf(ctx);
  const b = parseInput(catSchema, ctx.body);
  if (!(await queryOne("SELECT 1 FROM nm_ticket_categories WHERE id = ?", [id]))) throw notFound();
  await tx(async (conn) => {
    await exec(
      "UPDATE nm_ticket_categories SET label = ?, description = ?, sort_order = ?, enabled = ? WHERE id = ?",
      [b.label, b.description ?? null, b.sortOrder, b.enabled ? 1 : 0, id],
      conn,
    );
    await saveRoles(conn, id, b.roles);
  });
  await audit(ctx, "tickets.category_update", { targetType: "ticket_category", targetId: id, summary: `Upravená kategória ${b.label}` });
  return { ok: true };
});

del("/admin/ticket-categories/:id", { perm: "tickets.manage_categories" }, async (ctx) => {
  const id = idOf(ctx);
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM nm_tickets WHERE category_id = ?", [id]);
  if (n > 0) throw conflict("Kategória má tickety. Vypnite ju namiesto zmazania.", "category_in_use");
  await exec("DELETE FROM nm_ticket_categories WHERE id = ?", [id]);
  await audit(ctx, "tickets.category_delete", { targetType: "ticket_category", targetId: id, summary: "Zmazaná kategória" });
  return { ok: true };
});

// ───────────── settings ─────────────

get("/admin/ticket-settings", { perm: "tickets.manage_settings" }, async () => ({ settings: await ticketSettings() }));

put("/admin/ticket-settings", { perm: "tickets.manage_settings" }, async (ctx) => {
  const b = parseInput(
    z.object({
      playerPriority: z.boolean(),
      reopenDays: z.number().int().min(0).max(365),
      maxOpenPerUser: z.number().int().min(1).max(50),
      discordWebhookEnabled: z.boolean(),
    }),
    ctx.body,
  );
  await setSetting("tickets.player_priority", b.playerPriority, ctx.user.id);
  await setSetting("tickets.reopen_days", b.reopenDays, ctx.user.id);
  await setSetting("tickets.max_open_per_user", b.maxOpenPerUser, ctx.user.id);
  await setSetting("tickets.discord_webhook_enabled", b.discordWebhookEnabled, ctx.user.id);
  await audit(ctx, "settings.tickets", { targetType: "settings", summary: "Zmenené nastavenia ticketov" });
  return { ok: true, discordWebhookConfigured: Boolean(process.env.DISCORD_WEBHOOK_URL) };
});
