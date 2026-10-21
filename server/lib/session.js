import { exec, query, queryOne } from "./db.js";
import { randomToken, sha256Hex, hashIp } from "./crypto.js";
import {
  SESSION_COOKIE,
  SESSION_SHORT_MS,
  SESSION_LONG_MS,
  isProd,
} from "./config.js";

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && !(k in out)) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

export function sessionCookie(token, { remember } = {}) {
  const parts = [`${SESSION_COOKIE()}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (isProd()) parts.push("Secure");
  // Without "remember me" the cookie is a browser-session cookie (no Max-Age).
  if (remember) parts.push(`Max-Age=${Math.floor(SESSION_LONG_MS / 1000)}`);
  return parts.join("; ");
}

export function clearSessionCookie() {
  const parts = [`${SESSION_COOKIE()}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isProd()) parts.push("Secure");
  return parts.join("; ");
}

/** Always creates a brand-new random token (prevents session fixation). */
export async function createSession(userId, { remember, ip, userAgent }) {
  const token = randomToken(32);
  const ms = remember ? SESSION_LONG_MS : SESSION_SHORT_MS;
  await exec(
    `INSERT INTO nm_sessions (user_id, token_hash, remember, expires_at, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, sha256Hex(token), remember ? 1 : 0, new Date(Date.now() + ms), hashIp(ip), (userAgent || "").slice(0, 255)],
  );
  return { token, remember: Boolean(remember) };
}

export async function loadSession(token) {
  if (!token || typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const row = await queryOne(
    `SELECT s.id AS session_id, s.user_id, s.remember, s.last_seen_at,
            u.authme_username, u.minecraft_name, u.minecraft_uuid, u.email, u.email_verified_at,
            u.status, u.web_password_hash IS NOT NULL AS has_web_password
       FROM nm_sessions s
       JOIN nm_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
    [sha256Hex(token)],
  );
  if (!row || row.status !== "active") return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60 * 1000) {
    exec("UPDATE nm_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?", [row.session_id]).catch(() => {});
  }
  return row;
}

export async function revokeSession(sessionId) {
  await exec("UPDATE nm_sessions SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL", [sessionId]);
}

export async function revokeAllSessions(userId, exceptSessionId = null) {
  const res = await exec(
    "UPDATE nm_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL AND id <> ?",
    [userId, exceptSessionId || 0],
  );
  return res.affectedRows;
}

export async function countActiveSessions(userId) {
  const rows = await query(
    "SELECT COUNT(*) AS n FROM nm_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [userId],
  );
  return rows[0].n;
}
