import { exec, query, queryOne } from "./db.js";
import { getSetting } from "./settings.js";

/**
 * Keeps the public Staff roster in step with web roles.
 *
 *  - A user holding a role flagged `is_public_staff` gets (or keeps) a roster
 *    entry using the highest such role's category and title.
 *  - Entries that were created manually (source = 'manual') are never changed
 *    by role changes.
 *  - When the last public role is removed, a role-created entry is hidden or
 *    flagged for review (per role `on_remove`, default from settings).
 *  - Removing someone from Staff NEVER removes permissions, and removing
 *    permissions never deletes the user account.
 */
export async function syncStaffForUser(userId, { lostRoleKeys = [] } = {}) {
  const user = await queryOne("SELECT id, minecraft_name, minecraft_uuid FROM nm_users WHERE id = ?", [userId]);
  if (!user) return;
  const publicRoles = await query(
    `SELECT r.* FROM nm_user_roles ur JOIN nm_roles r ON r.role_key = ur.role_key
      WHERE ur.user_id = ? AND r.is_public_staff = 1 ORDER BY r.priority DESC`,
    [userId],
  );
  const existing = await queryOne("SELECT * FROM nm_staff_members WHERE user_id = ?", [userId]);

  if (publicRoles.length) {
    const top = publicRoles[0];
    const category = top.staff_category_key || "helper";
    const title = top.staff_title || top.name;
    if (!existing) {
      if (await queryOne("SELECT 1 FROM nm_staff_suppressions WHERE user_id = ?", [userId])) return;
      const [{ n }] = await query("SELECT COUNT(*) AS n FROM nm_staff_members WHERE category_key = ?", [category]);
      await exec(
        `INSERT INTO nm_staff_members
           (user_id, minecraft_name, minecraft_uuid, category_key, title, source, visible, needs_review, sort_order)
         VALUES (?, ?, ?, ?, ?, 'role', 1, 0, ?)`,
        [userId, user.minecraft_name, user.minecraft_uuid, category, title, (n + 1) * 10],
      );
    } else if (existing.source === "role") {
      await exec(
        `UPDATE nm_staff_members SET minecraft_name = ?, minecraft_uuid = ?, category_key = ?, title = ?,
                visible = 1, needs_review = 0 WHERE id = ?`,
        [user.minecraft_name, user.minecraft_uuid, category, title, existing.id],
      );
    }
    return;
  }

  if (existing && existing.source === "role") {
    let mode = null;
    if (lostRoleKeys.length) {
      const lost = await queryOne(
        "SELECT on_remove FROM nm_roles WHERE role_key IN (?) AND is_public_staff = 1 LIMIT 1",
        [lostRoleKeys],
      );
      mode = lost?.on_remove || null;
    }
    mode = mode || (await getSetting("staff.on_role_removed", "hide"));
    if (mode === "review") {
      await exec("UPDATE nm_staff_members SET needs_review = 1 WHERE id = ?", [existing.id]);
    } else {
      await exec("UPDATE nm_staff_members SET visible = 0, needs_review = 0 WHERE id = ?", [existing.id]);
    }
  }
}

export async function syncStaffForRole(roleKey) {
  const users = await query("SELECT user_id FROM nm_user_roles WHERE role_key = ?", [roleKey]);
  for (const u of users) await syncStaffForUser(u.user_id);
}
