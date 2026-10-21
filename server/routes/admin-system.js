import { z } from "zod";
import { get, put, parseInput, pageParams } from "../lib/http.js";
import { exec, query, queryOne } from "../lib/db.js";
import { can } from "../lib/perms.js";
import { audit } from "../lib/audit.js";
import { badRequest, notFound } from "../lib/errors.js";
import { getMaintenance, setSetting, getSetting, MAINTENANCE_DEFAULT } from "../lib/settings.js";
import { getPageRows, effectiveState, invalidatePages } from "../lib/pages.js";
import { listStaffTickets } from "../lib/tickets.js";
import { authmeMode } from "../lib/authme.js";
import { authmeDb } from "../lib/db.js";
import { isMailConfigured } from "../lib/mailer.js";
import { ownerUuid, pluginSecret, isProd } from "../lib/config.js";
import { PAGES, PAGE_KEYS } from "../../shared/permissions.js";

// ───────────── dashboard (real numbers only; each tile needs its permission) ─────────────

get("/admin/dashboard", { perm: "admin.access" }, async (ctx) => {
  const u = ctx.user;
  const out = { user: u.name };
  if (can(u, "users.view")) {
    const [r] = await query("SELECT COUNT(*) AS total, SUM(status = 'suspended') AS suspended FROM nm_users");
    out.users = { total: r.total, suspended: Number(r.suspended || 0) };
  }
  if (["tickets.view_all", "tickets.view_category", "tickets.view_assigned"].some((p) => can(u, p))) {
    const open = await listStaffTickets(u, { status: "active" }, { offset: 0, size: 1 });
    const unassigned = await listStaffTickets(u, { status: "active", assignee: "none" }, { offset: 0, size: 1 });
    out.tickets = { open: open.total, unassigned: unassigned.total };
  }
  if (can(u, "staff.manage")) {
    const [r] = await query("SELECT COUNT(*) AS total, SUM(visible) AS visible, SUM(needs_review) AS review FROM nm_staff_members");
    out.staff = { total: r.total, visible: Number(r.visible || 0), needsReview: Number(r.review || 0) };
  }
  if (can(u, "news.manage")) {
    const [r] = await query("SELECT COUNT(*) AS total, SUM(status = 'published') AS published, SUM(status = 'draft') AS drafts FROM nm_news");
    out.news = { total: r.total, published: Number(r.published || 0), drafts: Number(r.drafts || 0) };
  }
  if (can(u, "pages.manage") || can(u, "maintenance.manage")) {
    const m = await getMaintenance();
    out.maintenance = { enabled: m.enabled, activatedAt: m.activatedAt };
    const rows = await getPageRows();
    out.pagesDisabled = rows.filter((r) => !effectiveState(r)).map((r) => r.page_key);
  }
  if (can(u, "audit.view")) {
    out.recentAudit = await query("SELECT action, actor_name AS actor, summary, created_at AS createdAt FROM nm_audit_log ORDER BY id DESC LIMIT 8");
  }
  return out;
});

// ───────────── pages ─────────────

const pageOut = (r) => {
  const meta = PAGES.find((p) => p.key === r.page_key);
  return {
    key: r.page_key,
    label: meta?.label || r.page_key,
    path: meta?.path,
    enabled: Boolean(r.enabled),
    effectiveEnabled: effectiveState(r),
    message: r.message,
    scheduleEnableAt: r.schedule_enable_at,
    scheduleDisableAt: r.schedule_disable_at,
    updatedBy: r.updated_by_name,
    updatedAt: r.updated_at,
  };
};

get("/admin/pages", { perm: "pages.manage" }, async () => ({ pages: (await getPageRows()).map(pageOut) }));

const pageSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().max(500).nullable().optional(),
  scheduleEnableAt: z.string().datetime().nullable().optional(),
  scheduleDisableAt: z.string().datetime().nullable().optional(),
});

put("/admin/pages/:key", { perm: "pages.manage" }, async (ctx) => {
  const key = ctx.params.key;
  if (!PAGE_KEYS.includes(key)) throw notFound("Neznáma stránka");
  const b = parseInput(pageSchema, ctx.body);
  // Only future schedules are kept; a manual save always becomes the new baseline.
  const future = (s) => (s && new Date(s).getTime() > Date.now() ? new Date(s) : null);
  const on = future(b.scheduleEnableAt);
  const off = future(b.scheduleDisableAt);
  await exec(
    `INSERT INTO nm_page_settings (page_key, enabled, message, schedule_enable_at, schedule_disable_at, updated_by, updated_by_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), message = VALUES(message), schedule_enable_at = VALUES(schedule_enable_at),
       schedule_disable_at = VALUES(schedule_disable_at), updated_by = VALUES(updated_by), updated_by_name = VALUES(updated_by_name), updated_at = UTC_TIMESTAMP()`,
    [key, b.enabled ? 1 : 0, b.message || null, on, off, ctx.user.id, ctx.user.name],
  );
  invalidatePages();
  await audit(ctx, b.enabled ? "pages.enable" : "pages.disable", {
    targetType: "page",
    targetId: key,
    summary: `Stránka ${key}: ${b.enabled ? "zapnutá" : "vypnutá"}${on ? `, plán zapnutia ${on.toISOString()}` : ""}${off ? `, plán vypnutia ${off.toISOString()}` : ""}`,
  });
  return { ok: true };
});

// ───────────── maintenance ─────────────

get("/admin/maintenance", { perm: ["maintenance.manage", "pages.manage"] }, async () => ({ maintenance: await getMaintenance() }));

const maintSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(1000),
  returnAt: z.string().datetime().nullable().optional(),
  showCountdown: z.boolean().optional().default(false),
  confirm: z.boolean().optional().default(false),
});

put("/admin/maintenance", { perm: "maintenance.manage" }, async (ctx) => {
  const b = parseInput(maintSchema, ctx.body);
  const cur = await getMaintenance();
  if (b.enabled && !cur.enabled && !b.confirm) {
    throw badRequest("Zapnutie údržby vyžaduje potvrdenie (confirm: true).", "confirm_required");
  }
  if (b.showCountdown && !b.returnAt) throw badRequest("Odpočet vyžaduje plánovaný návrat.");
  const next = {
    ...MAINTENANCE_DEFAULT,
    enabled: b.enabled,
    title: b.title,
    message: b.message,
    returnAt: b.returnAt || null,
    showCountdown: b.showCountdown,
    activatedAt: b.enabled ? (cur.enabled ? cur.activatedAt : new Date().toISOString()) : null,
    activatedBy: b.enabled ? (cur.enabled ? cur.activatedBy : ctx.user.name) : null,
  };
  await setSetting("maintenance", next, ctx.user.id);
  const changed = b.enabled !== cur.enabled;
  await audit(ctx, changed ? (b.enabled ? "maintenance.on" : "maintenance.off") : "maintenance.update", {
    targetType: "maintenance",
    summary: changed ? `Maintenance Mode ${b.enabled ? "zapnutý" : "vypnutý"}` : "Upravený text údržby",
  });
  return { maintenance: next };
});

// ───────────── web settings ─────────────

get("/admin/settings", { perm: "settings.manage" }, async () => ({
  settings: { staffOnRoleRemoved: await getSetting("staff.on_role_removed", "hide") },
}));

put("/admin/settings", { perm: "settings.manage" }, async (ctx) => {
  const b = parseInput(z.object({ staffOnRoleRemoved: z.enum(["hide", "review"]) }), ctx.body);
  await setSetting("staff.on_role_removed", b.staffOnRoleRemoved, ctx.user.id);
  await audit(ctx, "settings.update", { targetType: "settings", summary: `Po odobratí verejnej roly: ${b.staffOnRoleRemoved}` });
  return { ok: true };
});

// ───────────── audit log ─────────────

get("/admin/audit", { perm: "audit.view" }, async (ctx) => {
  const { page, size, offset } = pageParams(ctx.query, 50, 200);
  const where = [];
  const params = [];
  if (ctx.query.action) {
    where.push("action LIKE ?");
    params.push(`${String(ctx.query.action).slice(0, 40).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  if (ctx.query.actor) {
    where.push("actor_name = ?");
    params.push(String(ctx.query.actor).slice(0, 32));
  }
  if (ctx.query.q) {
    where.push("summary LIKE ?");
    params.push(`%${String(ctx.query.q).slice(0, 60).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM nm_audit_log ${w}`, params);
  const items = await query(
    `SELECT id, actor_name AS actor, action, target_type AS targetType, target_id AS targetId, summary, created_at AS createdAt
       FROM nm_audit_log ${w} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  return { total: n, page, size, items };
});

// ───────────── security & system status (booleans/counters only — never secret values) ─────────────

get("/admin/system", { perm: "security.view" }, async () => {
  let authme = { mode: authmeMode(), reachable: null };
  if (authme.mode === "direct") {
    try {
      await authmeDb().query("SELECT 1");
      authme.reachable = true;
    } catch {
      authme.reachable = false;
    }
  }
  const [s] = await query("SELECT COUNT(*) AS n FROM nm_sessions WHERE revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()");
  const [f] = await query("SELECT COUNT(*) AS n FROM nm_audit_log WHERE action = 'auth.login_failed' AND created_at > (UTC_TIMESTAMP() - INTERVAL 24 HOUR)");
  const [l] = await query("SELECT COUNT(*) AS n FROM nm_audit_log WHERE action = 'auth.login' AND created_at > (UTC_TIMESTAMP() - INTERVAL 24 HOUR)");
  const migrations = await query("SELECT name, applied_at AS appliedAt FROM nm_migrations ORDER BY name").catch(() => []);
  const owner = ownerUuid();
  const ownerLinked = owner ? Boolean(await queryOne("SELECT 1 FROM nm_users WHERE minecraft_uuid = ?", [owner])) : false;
  return {
    environment: isProd() ? "production" : "development",
    checks: {
      database: true,
      appSecret: (process.env.APP_SECRET || "").length >= 32,
      authme,
      mail: isMailConfigured(),
      ownerUuidConfigured: Boolean(owner),
      ownerAccountLinked: ownerLinked,
      pluginSecret: Boolean(pluginSecret()),
      discordWebhook: Boolean(process.env.DISCORD_WEBHOOK_URL),
      paymentProvider: process.env.PAYMENT_PROVIDER || null,
      siteUrl: Boolean(process.env.SITE_URL),
    },
    activeSessions: s.n,
    failedLogins24h: f.n,
    logins24h: l.n,
    migrations,
  };
});
