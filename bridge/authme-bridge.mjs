// Optional AuthMe bridge — run it NEXT TO the Minecraft server when the AuthMe
// database is not reachable from Vercel. It only READS AuthMe, never writes.
//
//   AUTHME_DATABASE_URL=mysql://readonly:***@127.0.0.1/authme \
//   AUTHME_BRIDGE_SECRET=<same value as on Vercel, >= 24 chars> \
//   BRIDGE_PORT=8787 node bridge/authme-bridge.mjs
//
// Put it behind HTTPS (reverse proxy) and set AUTHME_BRIDGE_URL on Vercel.
import http from "node:http";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import { verifyAuthmeHash } from "../server/lib/authme-hash.js";

const SECRET = process.env.AUTHME_BRIDGE_SECRET || "";
const TABLE = process.env.AUTHME_TABLE || "authme";
if (SECRET.length < 24) throw new Error("AUTHME_BRIDGE_SECRET must be at least 24 characters");
if (!/^[A-Za-z0-9_]{1,64}$/.test(TABLE)) throw new Error("Invalid AUTHME_TABLE");
const pool = mysql.createPool({ uri: process.env.AUTHME_DATABASE_URL, connectionLimit: 4 });
const seen = new Map(); // nonce -> expiry (replay protection)

const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

http.createServer((req, res) => {
  if (req.method !== "POST") return reply(res, 405, { ok: false });
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 4096) req.destroy(); });
  req.on("end", async () => {
    try {
      const ts = String(req.headers["x-nm-timestamp"] || "");
      const sig = String(req.headers["x-nm-signature"] || "");
      const want = crypto.createHmac("sha256", SECRET).update(`${ts}.${raw}`).digest("hex");
      if (!safeEq(sig, want) || Math.abs(Date.now() - Number(ts)) > 30_000) return reply(res, 401, { ok: false });
      const { username, password, nonce } = JSON.parse(raw);
      if (typeof nonce !== "string" || seen.has(nonce)) return reply(res, 401, { ok: false });
      seen.set(nonce, Date.now() + 60_000);
      for (const [k, v] of seen) if (v < Date.now()) seen.delete(k);
      if (!/^[A-Za-z0-9_]{3,16}$/.test(username) || typeof password !== "string") return reply(res, 200, { ok: false });
      const [rows] = await pool.query(`SELECT username, realname, password FROM \`${TABLE}\` WHERE username = ? LIMIT 1`, [username.toLowerCase()]);
      const row = rows[0];
      const stored = row?.password || "$SHA$0000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
      const ok = await verifyAuthmeHash(stored, password);
      return reply(res, 200, row && ok ? { ok: true, realname: row.realname || row.username } : { ok: false });
    } catch {
      return reply(res, 200, { ok: false });
    }
  });
}).listen(Number(process.env.BRIDGE_PORT || 8787), "127.0.0.1");
