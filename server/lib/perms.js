import { query } from "./db.js";
import { PERMISSION_KEYS } from "../../shared/permissions.js";
import { forbidden } from "./errors.js";

/**
 * Loads a user's effective access from the database on every request —
 * permissions are never trusted from the client or cached in the session.
 */
export async function loadActor(userRow) {
  const roles = await query(
    `SELECT r.role_key, r.name, r.priority
       FROM nm_user_roles ur JOIN nm_roles r ON r.role_key = ur.role_key
      WHERE ur.user_id = ? ORDER BY r.priority DESC`,
    [userRow.user_id ?? userRow.id],
  );
  const keys = roles.map((r) => r.role_key);
  let perms = new Set();
  if (keys.length) {
    const rows = await query(
      "SELECT DISTINCT permission FROM nm_role_permissions WHERE role_key IN (?)",
      [keys],
    );
    perms = new Set(rows.map((r) => r.permission));
  }
  const isOwner = keys.includes("owner");
  if (isOwner) PERMISSION_KEYS.forEach((p) => perms.add(p)); // owner holds everything
  return {
    id: userRow.user_id ?? userRow.id,
    name: userRow.minecraft_name,
    uuid: userRow.minecraft_uuid ?? null,
    roles: roles.map((r) => ({ key: r.role_key, name: r.name, priority: r.priority })),
    roleKeys: keys,
    permissions: perms,
    topPriority: roles.length ? roles[0].priority : 0,
    isOwner,
  };
}

export const can = (actor, perm) => Boolean(actor?.permissions?.has(perm));
export const canAny = (actor, perms) => perms.some((p) => can(actor, p));

export function requirePerm(actor, perm) {
  if (!can(actor, perm)) throw forbidden();
}

export function requireAnyPerm(actor, perms) {
  if (!canAny(actor, perms)) throw forbidden();
}

/** Highest role priority of an arbitrary user (for anti-escalation checks). */
export async function topPriorityOf(userId) {
  const rows = await query(
    `SELECT COALESCE(MAX(r.priority), 0) AS p
       FROM nm_user_roles ur JOIN nm_roles r ON r.role_key = ur.role_key
      WHERE ur.user_id = ?`,
    [userId],
  );
  return rows[0].p;
}

export async function hasRole(userId, roleKey) {
  const rows = await query(
    "SELECT 1 FROM nm_user_roles WHERE user_id = ? AND role_key = ? LIMIT 1",
    [userId, roleKey],
  );
  return rows.length > 0;
}
