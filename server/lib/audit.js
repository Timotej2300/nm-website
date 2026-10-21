import { exec } from "./db.js";
import { hashIp } from "./crypto.js";

const MAX = 500;

/**
 * Writes one audit row. `summary` must be a safe human-readable description:
 * NEVER pass passwords, tokens, hashes or secrets here.
 * Failures are logged (without payload) and never break the request.
 */
export async function audit(ctx, action, { targetType = null, targetId = null, summary = null, actor = null } = {}) {
  try {
    const user = actor || ctx?.user || null;
    await exec(
      `INSERT INTO nm_audit_log (actor_user_id, actor_name, action, target_type, target_id, summary, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user?.id ?? null,
        user?.name ?? null,
        String(action).slice(0, 64),
        targetType ? String(targetType).slice(0, 32) : null,
        targetId != null ? String(targetId).slice(0, 64) : null,
        summary ? String(summary).slice(0, MAX) : null,
        ctx?.ip ? hashIp(ctx.ip) : null,
      ],
    );
  } catch (e) {
    console.error("audit write failed:", action, e?.code || e?.message);
  }
}
