import crypto from "node:crypto";
import { authmeDb } from "./db.js";
import { verifyAuthmeHash } from "./authme-hash.js";
import { hmacHex } from "./crypto.js";
import { MC_NAME_RE } from "../../shared/permissions.js";

// Two ways to check a Minecraft nick + AuthMe password:
//
//  1. "direct" (default): the web server reads the `authme` table over a
//     remote MySQL connection (AUTHME_DATABASE_URL, read-only user) and
//     verifies the stored hash itself.
//  2. "bridge": the AuthMe database is NOT reachable from Vercel. A small
//     service next to the Minecraft server (bridge/authme-bridge.mjs) does
//     the lookup; requests are HMAC-signed with AUTHME_BRIDGE_SECRET.
//
// Either way the password only travels server-to-server over TLS, is never
// logged and is never returned to the browser. AuthMe data is never modified.

export function authmeMode() {
  if (process.env.AUTHME_BRIDGE_URL) return "bridge";
  if (process.env.AUTHME_DATABASE_URL) return "direct";
  return "none";
}

function tableName() {
  const t = process.env.AUTHME_TABLE || "authme";
  if (!/^[A-Za-z0-9_]{1,64}$/.test(t)) throw new Error("Invalid AUTHME_TABLE");
  return t;
}

/** @returns {Promise<{ok:boolean, realname?:string, error?:string}>} */
export async function verifyMinecraftLogin(username, password) {
  if (!MC_NAME_RE.test(username)) return { ok: false };
  const mode = authmeMode();
  if (mode === "bridge") return bridgeVerify(username, password);
  if (mode === "direct") return directVerify(username, password);
  return { ok: false, error: "authme_not_configured" };
}

async function directVerify(username, password) {
  const pool = authmeDb();
  const [rows] = await pool.query(
    `SELECT username, realname, password FROM \`${tableName()}\` WHERE username = ? LIMIT 1`,
    [username.toLowerCase()],
  );
  const row = rows[0];
  // Unknown account: still do comparable work so timing does not reveal it.
  const stored = row?.password || "$SHA$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
  const ok = await verifyAuthmeHash(stored, password);
  if (!row || !ok) return { ok: false };
  return { ok: true, realname: row.realname || row.username };
}

async function bridgeVerify(username, password) {
  const url = process.env.AUTHME_BRIDGE_URL;
  const secret = process.env.AUTHME_BRIDGE_SECRET;
  if (!secret || secret.length < 24) return { ok: false, error: "authme_bridge_secret_missing" };
  const body = JSON.stringify({ username, password, nonce: crypto.randomBytes(12).toString("hex") });
  const ts = String(Date.now());
  const sig = hmacHex(`${ts}.${body}`, secret);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-nm-timestamp": ts, "x-nm-signature": sig },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return { ok: false, error: "authme_bridge_error" };
  const data = await res.json().catch(() => ({}));
  if (data?.ok !== true || typeof data.realname !== "string" || !MC_NAME_RE.test(data.realname)) {
    return { ok: false };
  }
  return { ok: true, realname: data.realname };
}
