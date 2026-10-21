import { z } from "zod";
import { get, post, put, patch, del, parseInput, pageParams } from "../lib/http.js";
import { exec, query, queryOne, tx } from "../lib/db.js";
import { can, loadActor, topPriorityOf } from "../lib/perms.js";
import { audit } from "../lib/audit.js";
import { forbidden, notFound, badRequest, conflict } from "../lib/errors.js";
import { revokeAllSessions, countActiveSessions } from "../lib/session.js";
import { syncStaffForUser, syncStaffForRole } from "../lib/staff.js";
import { releaseOrphanedTickets } from "../lib/tickets.js";
import { ownerUuid } from "../lib/config.js";
import { PERMISSIONS, PERMISSION_KEYS } from "../../shared/permissions.js";

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

async function userRoles(ids) {
  if (!ids.length) return new Map();
  const rows = await query(
    `SELECT ur.user_id, r.role_key AS \`key\`, r.name, r.priority FROM nm_user_roles ur
       JOIN nm_roles r ON r.role_key = ur.role_key WHERE ur.user_id IN (?) ORDER BY r.priority DESC`,
    [ids],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.user_id)) map.set(r.user_id, []);
    map.get(r.user_id).push({ key: r.key, name: r.name, priority: r.priority });
  }
  return map;
}

// Never selects password hashes, tokens or e-mail addresses.
const publicRow = (u, roles) => ({
  id: u.id,
  name: u.minecraft_name,
  uuid: u.minecraft_uuid,
  linked: Boolean(u.minecraft_uuid),
  emailVerified: Boolean(u.email_verified_at),
  status: u.status,
  roles: roles || [],
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at,
});

export const isProtectedOwner = (u, roleKeys) =>
  roleKeys.includes("owner") || (ownerUuid() && u.minecraft_uuid && u.minecraft_uuid.toLowerCase() === ownerUuid());

/** Anti-escalation: who may modify whom. */
async function assertCanManageUser(actor, target) {
  if (target.id === actor.id) throw forbidden("Nemôžete upravovať sám seba.");
  const roles = await userRoles([target.id]);
  const keys = (roles.get(target.id) || []).map((r) => r.key);
  if (isProtectedOwner(target, keys)) throw forbidden("Hlavného vlastníka nemožno upravovať.");
  const tp = await topPriorityOf(target.id);
  if (!actor.isOwner && tp >= actor.topPriority) throw forbidden("Nemáte oprávnenie upravovať používateľa s rovnakou alebo vyššou rolou.");
  return { keys, topPriority: tp };
}

// ───────────── users ─────────────

get("/admin/users", { perm: "users.view" }, async (ctx) => {
  const { page, size, offset } = pageParams(ctx.query);
  const where = [];
  const params = [];
  if (ctx.query.q) {
    const q = String(ctx.query.q).trim().slice(0, 32);
    where.push("(u.minecraft_name LIKE ? OR u.minecraft_uuid = ?)");
    params.push(`%${escapeLike(q)}%`, q.toLowerCase());
  }
  if (ctx.query.role) {
    where.push("EXISTS (SELECT 1 FROM nm_user_roles x WHERE x.user_id = u.id AND x.role_key = ?)");
    params.push(String(ctx.query.role));
  }
  if (ctx.query.status === "active" || ctx.query.status === "suspended") {
    where.push("u.status = ?");
    params.push(ctx.query.status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ n }] = await query(`SELECT COUNT(*) AS n FROM nm_users u ${w}`, params);
  const rows = await query(
    `SELECT u.id, u.minecraft_name, u.minecraft_uuid, u.email_verified_at, u.status, u.created_at, u.last_login_at
       FROM nm_users u ${w} ORDER BY u.id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const roles = await userRoles(rows.map((r) => r.id));
  return { total: n, page, size, items: rows.map((r) => publicRow(r, roles.get(r.id))) };
});

get("/admin/users/:id", { perm: "users.view" }, async (ctx) => {
  const u = await queryOne(
    "SELECT id, minecraft_name, minecraft_uuid, email_verified_at, status, created_at, last_login_at FROM nm_users WHERE id = ?",
    [Number(ctx.params.id)],
  );
  if (!u) throw notFound("Používateľ nenájdený");
  const roles = await userRoles([u.id]);
  const events = can(ctx.user, "audit.view")
    ? await query(
        `SELECT action, summary, created_at AS createdAt FROM nm_audit_log
          WHERE (actor_user_id = ? AND (action LIKE 'auth.%' OR action LIKE 'account.%'))
             OR (target_type = 'user' AND target_id = ?) ORDER BY id DESC LIMIT 25`,
        [u.id, String(u.id)],
      )
    : [];
  return { user: { ...publicRow(u, roles.get(u.id)), activeSessions: await countActiveSessions(u.id) }, events };
});

post("/admin/users/:id/status", { perm: "users.manage" }, async (ctx) => {
  const { status } = parseInput(z.object({ status: z.enum(["active", "suspended"]) }), ctx.body);
  const target = await queryOne("SELECT id, minecraft_name, minecraft_uuid, status FROM nm_users WHERE id = ?", [Number(ctx.params.id)]);
  if (!target) throw notFound("Používateľ nenájdený");
  await assertCanManageUser(ctx.user, target);
  if (target.status === status) return { ok: true };
  await exec("UPDATE nm_users SET status = ? WHERE id = ?", [status, target.id]);
  if (status === "suspended") {
    await revokeAllSessions(target.id);
    await releaseOrphanedTickets(target.id, { force: true });
    await exec("UPDATE nm_staff_members SET visible = 0 WHERE user_id = ?", [target.id]);
  }
  await audit(ctx, status === "suspended" ? "users.suspend" : "users.activate", {
    targetType: "user",
    targetId: target.id,
    summary: `${status === "suspended" ? "Pozastavený" : "Obnovený"} účet ${target.minecraft_name}`,
  });
  return { ok: true };
});

post("/admin/users/:id/revoke-sessions", { perm: "users.manage" }, async (ctx) => {
  const target = await queryOne("SELECT id, minecraft_name, minecraft_uuid FROM nm_users WHERE id = ?", [Number(ctx.params.id)]);
  if (!target) throw notFound("Používateľ nenájdený");
  await assertCanManageUser(ctx.user, target);
  const n = await revokeAllSessions(target.id);
  await audit(ctx, "users.revoke_sessions", { targetType: "user", targetId: target.id, summary: `Zneplatnené relácie používateľa ${target.minecraft_name} (${n})` });
  return { ok: true, revoked: n };
});

put("/admin/users/:id/roles", { perm: "users.manage" }, async (ctx) => {
  const { roles } = parseInput(z.object({ roles: z.array(z.string().max(32)).max(20) }), ctx.body);
  const target = await queryOne("SELECT id, minecraft_name, minecraft_uuid FROM nm_users WHERE id = ?", [Number(ctx.params.id)]);
  if (!target) throw notFound("Používateľ nenájdený");
  await assertCanManageUser(ctx.user, target);

  const wanted = new Set(roles);
  wanted.add("user"); // everyone keeps the base role
  const known = await query("SELECT role_key, priority FROM nm_roles WHERE role_key IN (?)", [[...wanted]]);
  if (known.length !== wanted.size) throw badRequest("Neznáma rola");
  const current = (await userRoles([target.id])).get(target.id) || [];
  const currentKeys = current.map((r) => r.key);
  const add = [...wanted].filter((k) => !currentKeys.includes(k));
  const remove = currentKeys.filter((k) => !wanted.has(k));
  const prio = new Map(known.map((r) => [r.role_key, r.priority]));
  for (const k of remove) prio.set(k, current.find((r) => r.key === k).priority);

  for (const k of [...add, ...remove]) {
    if (k === "owner") throw forbidden("Rolu Owner nemožno prideliť ani odobrať cez web.");
    if (prio.get(k) >= ctx.user.topPriority && !(ctx.user.isOwner && k !== "owner")) {
      throw forbidden(`Nemôžete meniť rolu ${k} (rovnaká alebo vyššia než vaša).`);
    }
  }
  await tx(async (conn) => {
    for (const k of add) await exec("INSERT IGNORE INTO nm_user_roles (user_id, role_key, assigned_by) VALUES (?, ?, ?)", [target.id, k, ctx.user.id], conn);
    if (remove.length) await exec("DELETE FROM nm_user_roles WHERE user_id = ? AND role_key IN (?)", [target.id, remove], conn);
  });
  await syncStaffForUser(target.id, { lostRoleKeys: remove });
  await releaseOrphanedTickets(target.id);
  if (add.length || remove.length) {
    await audit(ctx, "roles.user_changed", {
      targetType: "user",
      targetId: target.id,
      summary: `${target.minecraft_name}: +[${add.join(", ")}] −[${remove.join(", ")}]`,
    });
  }
  const fresh = (await userRoles([target.id])).get(target.id) || [];
  return { roles: fresh };
});

// ───────────── roles ─────────────

const staffRolesFields = (r) => ({
  key: r.role_key,
  name: r.name,
  description: r.description,
  priority: r.priority,
  isSystem: Boolean(r.is_system),
  isPublicStaff: Boolean(r.is_public_staff),
  staffCategoryKey: r.staff_category_key,
  staffTitle: r.staff_title,
  onRemove: r.on_remove,
});

get("/admin/roles", { perm: ["users.view", "roles.manage"] }, async (ctx) => {
  const roles = await query("SELECT * FROM nm_roles ORDER BY priority DESC, role_key");
  const perms = await query("SELECT role_key, permission FROM nm_role_permissions");
  const counts = await query("SELECT role_key, COUNT(*) AS n FROM nm_user_roles GROUP BY role_key");
  const staffCategories = await query("SELECT cat_key AS `key`, label FROM nm_staff_categories ORDER BY sort_order");
  return {
    roles: roles.map((r) => ({
      ...staffRolesFields(r),
      permissions: r.role_key === "owner" ? [...PERMISSION_KEYS] : perms.filter((p) => p.role_key === r.role_key).map((p) => p.permission).sort(),
      users: counts.find((c) => c.role_key === r.role_key)?.n || 0,
      editable: r.role_key !== "owner",
    })),
    permissionCatalog: PERMISSIONS,
    staffCategories,
    canManage: can(ctx.user, "roles.manage"),
  };
});

const roleBody = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(255).nullable().optional(),
  priority: z.number().int().min(0).max(999).optional(),
  permissions: z.array(z.string()).max(60),
  isPublicStaff: z.boolean().optional().default(false),
  staffCategoryKey: z.string().max(32).nullable().optional(),
  staffTitle: z.string().trim().max(80).nullable().optional(),
  onRemove: z.enum(["hide", "review"]).optional().default("hide"),
});

function checkPermissions(actor, permissions) {
  for (const p of permissions) {
    if (!PERMISSION_KEYS.includes(p)) throw badRequest(`Neznáme oprávnenie ${p}`);
    if (p === "roles.manage") throw badRequest("Oprávnenie roles.manage je vyhradené pre rolu Owner.");
    if (!can(actor, p)) throw forbidden(`Nemôžete prideliť oprávnenie ${p}, ktoré sami nemáte.`);
  }
}

async function checkStaffCategory(key) {
  if (key && !(await queryOne("SELECT 1 FROM nm_staff_categories WHERE cat_key = ?", [key]))) {
    throw badRequest("Neznáma kategória Staff");
  }
}

post("/admin/roles", { perm: "roles.manage" }, async (ctx) => {
  const key = String(ctx.body?.key || "");
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(key)) throw badRequest("Kľúč roly: malé písmená, číslice a _ (2–31 znakov)");
  const body = parseInput(roleBody, ctx.body);
  if (await queryOne("SELECT 1 FROM nm_roles WHERE role_key = ?", [key])) throw conflict("Rola s týmto kľúčom už existuje");
  const priority = body.priority ?? 100;
  if (priority >= ctx.user.topPriority) throw forbidden("Priorita roly musí byť nižšia než vaša.");
  checkPermissions(ctx.user, body.permissions);
  await checkStaffCategory(body.staffCategoryKey);
  await tx(async (conn) => {
    await exec(
      `INSERT INTO nm_roles (role_key, name, description, priority, is_system, is_public_staff, staff_category_key, staff_title, on_remove)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [key, body.name, body.description ?? null, priority, body.isPublicStaff ? 1 : 0, body.staffCategoryKey ?? null, body.staffTitle ?? null, body.onRemove],
      conn,
    );
    for (const p of new Set(body.permissions)) await exec("INSERT INTO nm_role_permissions (role_key, permission) VALUES (?, ?)", [key, p], conn);
  });
  await audit(ctx, "roles.create", { targetType: "role", targetId: key, summary: `Vytvorená rola ${key} (${body.permissions.length} oprávnení)` });
  ctx.status = 201;
  return { ok: true, key };
});

patch("/admin/roles/:key", { perm: "roles.manage" }, async (ctx) => {
  const key = ctx.params.key;
  const role = await queryOne("SELECT * FROM nm_roles WHERE role_key = ?", [key]);
  if (!role) throw notFound("Rola nenájdená");
  if (key === "owner") throw forbidden("Rolu Owner nemožno upravovať.");
  const body = parseInput(roleBody, ctx.body);
  if (role.priority >= ctx.user.topPriority) throw forbidden("Nemôžete upraviť rolu s rovnakou alebo vyššou prioritou.");
  const priority = role.is_system ? role.priority : (body.priority ?? role.priority);
  if (priority >= ctx.user.topPriority) throw forbidden("Priorita roly musí byť nižšia než vaša.");
  checkPermissions(ctx.user, body.permissions);
  await checkStaffCategory(body.staffCategoryKey);
  const before = (await query("SELECT permission FROM nm_role_permissions WHERE role_key = ?", [key])).map((r) => r.permission);
  await tx(async (conn) => {
    await exec(
      `UPDATE nm_roles SET name = ?, description = ?, priority = ?, is_public_staff = ?, staff_category_key = ?, staff_title = ?, on_remove = ? WHERE role_key = ?`,
      [body.name, body.description ?? null, priority, body.isPublicStaff ? 1 : 0, body.staffCategoryKey ?? null, body.staffTitle ?? null, body.onRemove, key],
      conn,
    );
    await exec("DELETE FROM nm_role_permissions WHERE role_key = ?", [key], conn);
    for (const p of new Set(body.permissions)) await exec("INSERT INTO nm_role_permissions (role_key, permission) VALUES (?, ?)", [key, p], conn);
  });
  const after = [...new Set(body.permissions)];
  const added = after.filter((p) => !before.includes(p));
  const removed = before.filter((p) => !after.includes(p));
  const holders = await query("SELECT user_id FROM nm_user_roles WHERE role_key = ?", [key]);
  await syncStaffForRole(key);
  for (const h of holders) await releaseOrphanedTickets(h.user_id);
  await audit(ctx, "roles.update", {
    targetType: "role",
    targetId: key,
    summary: `Rola ${key}: +[${added.join(", ")}] −[${removed.join(", ")}]${body.isPublicStaff ? ", verejný staff" : ""}`,
  });
  return { ok: true };
});

del("/admin/roles/:key", { perm: "roles.manage" }, async (ctx) => {
  const role = await queryOne("SELECT * FROM nm_roles WHERE role_key = ?", [ctx.params.key]);
  if (!role) throw notFound("Rola nenájdená");
  if (role.is_system) throw forbidden("Systémovú rolu nemožno zmazať.");
  if (role.priority >= ctx.user.topPriority) throw forbidden("Nemôžete zmazať rolu s rovnakou alebo vyššou prioritou.");
  const holders = await query("SELECT user_id FROM nm_user_roles WHERE role_key = ?", [role.role_key]);
  await exec("DELETE FROM nm_roles WHERE role_key = ?", [role.role_key]);
  for (const h of holders) {
    await syncStaffForUser(h.user_id, { lostRoleKeys: [role.role_key] });
    await releaseOrphanedTickets(h.user_id);
  }
  await audit(ctx, "roles.delete", { targetType: "role", targetId: role.role_key, summary: `Zmazaná rola ${role.role_key} (${holders.length} používateľov)` });
  return { ok: true };
});

export { loadActor };
