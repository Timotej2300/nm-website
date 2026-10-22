import { exec, query, queryOne } from "./db.js";
import { ownerUuid } from "./config.js";
import { PERMISSION_KEYS } from "../../shared/permissions.js";

/**
 * Creates or refreshes the web profile for a Minecraft account whose
 * AuthMe password was just verified. Accounts can ONLY come into existence
 * through a verified AuthMe login — there is no public registration.
 */
export async function upsertAuthmeUser(realname) {
  const key = realname.toLowerCase();
  const existing = await queryOne("SELECT * FROM nm_users WHERE authme_username = ?", [key]);
  if (existing) {
    if (existing.minecraft_name !== realname) {
      await exec("UPDATE nm_users SET minecraft_name = ? WHERE id = ?", [realname, existing.id]);
      existing.minecraft_name = realname;
    }
    return existing;
  }
  const res = await exec(
    "INSERT INTO nm_users (authme_username, minecraft_name) VALUES (?, ?)",
    [key, realname],
  );
  await exec("INSERT IGNORE INTO nm_user_roles (user_id, role_key) VALUES (?, 'user')", [res.insertId]);
  return queryOne("SELECT * FROM nm_users WHERE id = ?", [res.insertId]);
}

/**
 * Account for a player who proved their identity in-game with a one-time
 * `/weblink` code. The stable UUID is the identity; the name is refreshed on
 * every login. An older AuthMe-created account with the same name and no UUID
 * yet is adopted (it belongs to the same person: the plugin only hands codes
 * to authenticated players). No public registration exists - a code can only
 * come from the plugin, which is authenticated with PLUGIN_API_SECRET.
 */
export async function upsertCodeUser(uuid, name) {
  let user = await queryOne("SELECT * FROM nm_users WHERE minecraft_uuid = ?", [uuid]);
  if (!user) {
    const legacy = await queryOne(
      "SELECT * FROM nm_users WHERE authme_username = ? AND minecraft_uuid IS NULL",
      [name.toLowerCase()],
    );
    if (legacy) {
      await exec("UPDATE nm_users SET minecraft_uuid = ? WHERE id = ? AND minecraft_uuid IS NULL", [uuid, legacy.id]);
      user = await queryOne("SELECT * FROM nm_users WHERE id = ?", [legacy.id]);
    }
  }
  if (!user) {
    try {
      const res = await exec("INSERT INTO nm_users (authme_username, minecraft_name, minecraft_uuid) VALUES (NULL, ?, ?)", [name, uuid]);
      await exec("INSERT IGNORE INTO nm_user_roles (user_id, role_key) VALUES (?, 'user')", [res.insertId]);
      user = await queryOne("SELECT * FROM nm_users WHERE id = ?", [res.insertId]);
    } catch (e) {
      if (e?.code !== "ER_DUP_ENTRY") throw e;
      user = await queryOne("SELECT * FROM nm_users WHERE minecraft_uuid = ?", [uuid]);
    }
  }
  if (user && user.minecraft_name !== name) {
    await exec("UPDATE nm_users SET minecraft_name = ? WHERE id = ?", [name, user.id]);
    user.minecraft_name = name;
  }
  return user;
}

/**
 * Owner bootstrap: the account whose *verified* Minecraft UUID equals
 * OWNER_MINECRAFT_UUID holds the `owner` role. The UUID only gets attached
 * to a web account through the one-time in-game link code, so a nick alone
 * (e.g. someone else called "X4yl0n") can never become owner.
 * Returns true when the role was newly granted.
 */
export async function ensureOwner(user) {
  const owner = ownerUuid();
  if (!owner || !user?.minecraft_uuid || user.minecraft_uuid.toLowerCase() !== owner) return false;
  const res = await exec(
    "INSERT IGNORE INTO nm_user_roles (user_id, role_key) VALUES (?, 'owner')",
    [user.id],
  );
  return res.affectedRows === 1;
}

export function toPublicUser(actor, profile) {
  return {
    id: actor.id,
    name: actor.name,
    uuidLinked: Boolean(profile.minecraft_uuid),
    uuid: profile.minecraft_uuid || null,
    email: profile.email || null,
    emailVerified: Boolean(profile.email_verified_at),
    hasWebPassword: Boolean(profile.has_web_password),
    roles: actor.roles.map((r) => ({ key: r.key, name: r.name })),
    permissions: [...actor.permissions].filter((p) => PERMISSION_KEYS.includes(p)).sort(),
    isStaff: actor.permissions.has("admin.access"),
  };
}

export async function findUserByName(name) {
  return queryOne("SELECT * FROM nm_users WHERE authme_username = ?", [String(name).toLowerCase()]);
}

export async function listUserRoles(userId) {
  return query(
    `SELECT r.role_key, r.name, r.priority FROM nm_user_roles ur
       JOIN nm_roles r ON r.role_key = ur.role_key WHERE ur.user_id = ? ORDER BY r.priority DESC`,
    [userId],
  );
}
