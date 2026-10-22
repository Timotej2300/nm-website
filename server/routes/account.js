import { z } from "zod";
import { get, post, parseInput } from "../lib/http.js";
import { exec, query, queryOne, tx } from "../lib/db.js";
import { enforce } from "../lib/ratelimit.js";
import { sha256Hex, randomToken, hashWebPassword, verifyWebPassword } from "../lib/crypto.js";
import { verifyMinecraftLogin } from "../lib/authme.js";
import { ensureOwner, toPublicUser } from "../lib/users.js";
import { countActiveSessions, revokeAllSessions } from "../lib/session.js";
import { loadActor } from "../lib/perms.js";
import { syncStaffForUser } from "../lib/staff.js";
import { audit } from "../lib/audit.js";
import { HttpError, badRequest, conflict, forbidden } from "../lib/errors.js";
import { checkWebPassword, emailSchema } from "../lib/password-policy.js";
import { isMailConfigured, sendMail, link } from "../lib/mailer.js";

// Sensitive account changes require the current password again, so a stolen
// session cookie alone cannot take over an account.
const FRESH_SESSION_MS = 30 * 60_000;

async function reauthenticate(ctx, password) {
  await enforce(`reauth:${ctx.user.id}`, 10, 15 * 60_000, "Príliš veľa pokusov o overenie hesla.");
  const row = await queryOne("SELECT authme_username, web_password_hash FROM nm_users WHERE id = ?", [ctx.user.id]);
  // First-time setup for an account that came in with the in-game code (so it has NO password
  // of any kind yet): the fresh sign-in is the proof. Accounts with an AuthMe password always
  // confirm with it; once a web password exists, or after 30 minutes, the password is required.
  const fresh = Number(ctx.session.session_age_sec) * 1000 < FRESH_SESSION_MS;
  if (!row.web_password_hash && !row.authme_username && fresh) return;
  if (!password) throw forbidden("Zadajte aktuálne heslo.", "invalid_password");
  if (row.web_password_hash && (await verifyWebPassword(row.web_password_hash, password))) return;
  if (row.authme_username) {
    try {
      const r = await verifyMinecraftLogin(row.authme_username, password);
      if (r.ok) return;
    } catch {
      throw new HttpError(503, "authme_unavailable", "Overenie hesla je dočasne nedostupné.");
    }
  }
  throw forbidden("Nesprávne heslo.", "invalid_password");
}

get("/account", async (ctx) => {
  return {
    user: toPublicUser(ctx.user, ctx.profile),
    sessions: await countActiveSessions(ctx.user.id),
    mailConfigured: isMailConfigured(),
    // Accounts created with the in-game code have no password at all yet: first setup needs none.
    setupWithoutPassword: !ctx.profile.has_web_password && !ctx.profile.authme_username,
  };
});

const linkSchema = z.object({ code: z.string().trim().min(4).max(32) });

post("/account/link", async (ctx) => {
  const { code } = parseInput(linkSchema, ctx.body);
  await enforce(`link:${ctx.user.id}`, 8, 15 * 60_000, "Príliš veľa pokusov o zadanie kódu.");
  const profile = await queryOne("SELECT * FROM nm_users WHERE id = ?", [ctx.user.id]);
  const row = await queryOne(
    `SELECT * FROM nm_link_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
    [sha256Hex(code.toUpperCase().replace(/[\s-]/g, ""))],
  );
  const invalid = () => badRequest("Kód je neplatný alebo vypršal. Vygenerujte nový príkazom /web link.", "invalid_code");
  if (!row) throw invalid();
  // The code was issued in-game for one specific player; it only links to the matching web account.
  if (row.minecraft_name.toLowerCase() !== (profile.authme_username || "").toLowerCase()) throw invalid();
  if (profile.minecraft_uuid && profile.minecraft_uuid !== row.minecraft_uuid) {
    throw conflict("Tento účet je už prepojený s iným Minecraft UUID. Kontaktujte administrátora.", "uuid_mismatch");
  }
  await tx(async (conn) => {
    const used = await exec("UPDATE nm_link_codes SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id], conn);
    if (used.affectedRows !== 1) throw invalid();
    const other = await queryOne("SELECT id FROM nm_users WHERE minecraft_uuid = ? AND id <> ?", [row.minecraft_uuid, profile.id], conn);
    if (other) throw conflict("Toto Minecraft UUID je už prepojené s iným účtom.", "uuid_taken");
    await exec("UPDATE nm_users SET minecraft_uuid = ? WHERE id = ?", [row.minecraft_uuid, profile.id], conn);
  });
  const fresh = await queryOne("SELECT * FROM nm_users WHERE id = ?", [profile.id]);
  const becameOwner = await ensureOwner(fresh);
  await syncStaffForUser(profile.id);
  await audit(ctx, "account.linked", {
    targetType: "user",
    targetId: profile.id,
    summary: `Prepojené Minecraft UUID${becameOwner ? " (rola owner pridelená)" : ""}`,
  });
  const actor = await loadActor(fresh);
  return {
    user: toPublicUser(actor, {
      minecraft_uuid: fresh.minecraft_uuid,
      email: fresh.email,
      email_verified_at: fresh.email_verified_at,
      has_web_password: Boolean(fresh.web_password_hash),
    }),
  };
});

const emailChangeSchema = z.object({
  email: emailSchema,
  currentPassword: z.string().max(256).optional(),
  webPassword: z.string().max(256).optional(),
});

post("/account/email", async (ctx) => {
  const input = parseInput(emailChangeSchema, ctx.body);
  if (!isMailConfigured()) {
    throw new HttpError(503, "mail_not_configured", "Odosielanie e-mailov nie je na serveri nastavené.");
  }
  await enforce(`email:change:${ctx.user.id}`, 5, 3600_000);
  await reauthenticate(ctx, input.currentPassword);
  const me = await queryOne("SELECT web_password_hash, minecraft_name FROM nm_users WHERE id = ?", [ctx.user.id]);

  if (!me.web_password_hash && !input.webPassword) {
    throw badRequest("Zvoľte webové heslo (iné než heslo do Minecraftu).", "web_password_required");
  }
  if (input.webPassword) {
    if (input.currentPassword && input.webPassword === input.currentPassword && !me.web_password_hash) {
      throw badRequest("Webové heslo musí byť iné než heslo do Minecraftu.", "same_password");
    }
    const problem = checkWebPassword(input.webPassword, { name: me.minecraft_name, email: input.email });
    if (problem) throw badRequest(problem, "weak_password");
    await exec("UPDATE nm_users SET web_password_hash = ? WHERE id = ?", [await hashWebPassword(input.webPassword), ctx.user.id]);
  }

  const taken = await queryOne("SELECT id FROM nm_users WHERE email = ? AND id <> ?", [input.email, ctx.user.id]);
  if (!taken) {
    const token = randomToken(32);
    await exec("UPDATE nm_email_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = 'verify_email' AND used_at IS NULL", [ctx.user.id]);
    await exec(
      "INSERT INTO nm_email_tokens (user_id, purpose, token_hash, email, expires_at) VALUES (?, 'verify_email', ?, ?, ?)",
      [ctx.user.id, sha256Hex(token), input.email, new Date(Date.now() + 24 * 3600_000)],
    );
    await sendMail({
      to: input.email,
      subject: "Overenie e-mailu — NinjaMelon",
      text: `Dobrý deň ${me.minecraft_name},\n\nna overenie e-mailu a prepojenie s Minecraft účtom použite tento odkaz (platí 24 hodín):\n${link(`/verify-email?token=${token}`)}\n\nAk ste o to nežiadali, e-mail ignorujte.`,
    });
  }
  await audit(ctx, "account.email_requested", { targetType: "user", targetId: ctx.user.id, summary: "Žiadosť o prepojenie/zmenu e-mailu" });
  // Identical response whether or not the address is already used elsewhere.
  return { ok: true, message: "Ak adresu možno použiť, poslali sme na ňu overovací odkaz." };
});

const pwSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(1).max(256),
});

post("/account/web-password", async (ctx) => {
  const input = parseInput(pwSchema, ctx.body);
  await reauthenticate(ctx, input.currentPassword);
  const me = await queryOne("SELECT minecraft_name, email, email_verified_at, authme_username FROM nm_users WHERE id = ?", [ctx.user.id]);
  if (!me.email_verified_at) throw badRequest("Najprv overte e-mail.", "email_not_verified");
  const problem = checkWebPassword(input.newPassword, { name: me.minecraft_name, email: me.email });
  if (problem) throw badRequest(problem, "weak_password");
  await exec("UPDATE nm_users SET web_password_hash = ? WHERE id = ?", [await hashWebPassword(input.newPassword), ctx.user.id]);
  await revokeAllSessions(ctx.user.id, ctx.session.session_id);
  await audit(ctx, "account.web_password_changed", { targetType: "user", targetId: ctx.user.id, summary: "Zmenené webové heslo, ostatné relácie zneplatnené" });
  return { ok: true };
});

get("/account/sessions", async (ctx) => {
  const rows = await query(
    `SELECT id, remember, created_at AS createdAt, last_seen_at AS lastSeenAt, expires_at AS expiresAt,
            user_agent AS userAgent, id = ? AS current
       FROM nm_sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() ORDER BY id DESC`,
    [ctx.session.session_id, ctx.user.id],
  );
  return { sessions: rows.map((r) => ({ ...r, remember: Boolean(r.remember), current: Boolean(r.current) })) };
});
