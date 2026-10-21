import crypto from "node:crypto";
import { z } from "zod";
import { post, parseInput } from "../lib/http.js";
import { exec, queryOne } from "../lib/db.js";
import { pluginSecret, normalizeUuid } from "../lib/config.js";
import { safeEqual, sha256Hex, hashIp } from "../lib/crypto.js";
import { enforce } from "../lib/ratelimit.js";
import { HttpError, unauthorized } from "../lib/errors.js";
import { MC_NAME_RE } from "../../shared/permissions.js";

// Machine endpoints for the Minecraft side (plugin / Votifier listener).
// They are authenticated with a long shared secret (PLUGIN_API_SECRET) in an
// Authorization: Bearer header — no cookies, hence no browser CSRF guard.
// See docs/PLUGIN_SPEC.md.

async function pluginAuth(ctx) {
  await enforce(`plugin:ip:${hashIp(ctx.ip)}`, 300, 60_000);
  const secret = pluginSecret();
  if (!secret) throw new HttpError(503, "plugin_not_configured", "PLUGIN_API_SECRET nie je nastavený.");
  const header = String(ctx.req.headers.authorization || "");
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!safeEqual(given, secret)) throw unauthorized("Neplatný kľúč", "invalid_plugin_key");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  let c = "";
  for (let i = 0; i < 8; i++) c += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  return c;
}

const linkSchema = z.object({
  uuid: z.string(),
  name: z.string().regex(MC_NAME_RE),
});

// POST /api/plugin/link-code  — called by the plugin on `/web link`
post("/plugin/link-code", { public: true, csrf: false }, async (ctx) => {
  await pluginAuth(ctx);
  const input = parseInput(linkSchema, ctx.body);
  const uuid = normalizeUuid(input.uuid);
  if (!uuid) throw new HttpError(400, "bad_uuid", "Neplatné UUID");
  await enforce(`plugin:link:${uuid}`, 6, 10 * 60_000, "Príliš veľa kódov pre tohto hráča.");
  await exec("UPDATE nm_link_codes SET used_at = UTC_TIMESTAMP() WHERE minecraft_uuid = ? AND used_at IS NULL", [uuid]);
  const code = makeCode();
  await exec(
    "INSERT INTO nm_link_codes (code_hash, minecraft_uuid, minecraft_name, expires_at) VALUES (?, ?, ?, ?)",
    [sha256Hex(code), uuid, input.name, new Date(Date.now() + 5 * 60_000)],
  );
  return { code, expiresInSec: 300 };
});

const voteSchema = z.object({
  username: z.string().regex(MC_NAME_RE),
  site: z.string().regex(/^[a-z0-9_-]{2,64}$/),
});

// POST /api/plugin/vote — called by a Votifier listener after the vote site's
// own signed Votifier packet was verified by the plugin (the web never
// "verifies" a vote on its own; it only records what the listener confirms).
post("/plugin/vote", { public: true, csrf: false }, async (ctx) => {
  await pluginAuth(ctx);
  const input = parseInput(voteSchema, ctx.body);
  const dup = await queryOne(
    "SELECT id FROM nm_votes WHERE username = ? AND site_key = ? AND voted_at > (UTC_TIMESTAMP() - INTERVAL 60 SECOND)",
    [input.username, input.site],
  );
  if (!dup) await exec("INSERT INTO nm_votes (username, site_key) VALUES (?, ?)", [input.username, input.site]);
  return { ok: true, recorded: !dup };
});
