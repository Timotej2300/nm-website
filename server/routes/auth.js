import { z } from "zod";
import { get, post, parseInput } from "../lib/http.js";
import { exec, queryOne, tx } from "../lib/db.js";
import { createCaptcha, verifyCaptcha } from "../lib/captcha.js";
import { enforce, clear } from "../lib/ratelimit.js";
import { hashIp, sha256Hex, randomToken, hashWebPassword, verifyWebPassword, burnPasswordCheck } from "../lib/crypto.js";
import { verifyMinecraftLogin } from "../lib/authme.js";
import { upsertAuthmeUser, upsertCodeUser, ensureOwner, toPublicUser } from "../lib/users.js";
import { createSession, sessionCookie, revokeSession, revokeAllSessions } from "../lib/session.js";
import { loadActor } from "../lib/perms.js";
import { syncStaffForUser } from "../lib/staff.js";
import { audit } from "../lib/audit.js";
import { HttpError, badRequest, conflict, unauthorized } from "../lib/errors.js";
import { MC_NAME_RE } from "../../shared/permissions.js";
import { checkWebPassword, emailSchema } from "../lib/password-policy.js";
import { isMailConfigured, sendMail, link } from "../lib/mailer.js";

const GENERIC_FAIL = "Nesprávne prihlasovacie údaje.";

get("/auth/captcha", { public: true }, async (ctx) => {
  await enforce(`captcha:ip:${hashIp(ctx.ip)}`, 60, 10 * 60_000);
  const c = await createCaptcha();
  return c;
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
  remember: z.boolean().optional().default(false),
  captchaId: z.string(),
  captchaAnswer: z.string().min(1).max(16),
});

post("/auth/login", { public: true }, async (ctx) => {
  const input = parseInput(loginSchema, ctx.body);
  const ipKey = hashIp(ctx.ip);
  const idLower = input.identifier.toLowerCase();

  // 1) automation protection: per-IP and per-account budgets, then CAPTCHA.
  await enforce(`login:ip:${ipKey}`, 30, 15 * 60_000);
  await enforce(`login:id:${idLower}`, 10, 15 * 60_000);
  await verifyCaptcha(input.captchaId, input.captchaAnswer);

  const isEmail = input.identifier.includes("@");
  let user = null;
  let failureAudit = null;

  if (isEmail) {
    const row = await queryOne(
      "SELECT * FROM nm_users WHERE email = ? AND email_verified_at IS NOT NULL AND web_password_hash IS NOT NULL",
      [idLower],
    );
    if (!row) {
      await burnPasswordCheck(input.password);
    } else if (await verifyWebPassword(row.web_password_hash, input.password)) {
      user = row;
    } else {
      failureAudit = row.minecraft_name;
    }
  } else {
    if (!MC_NAME_RE.test(input.identifier)) {
      await burnPasswordCheck(input.password);
    } else {
      let result;
      try {
        result = await verifyMinecraftLogin(input.identifier, input.password);
      } catch (e) {
        console.error("AuthMe verification failed:", e?.code || e?.message?.slice(0, 120));
        throw new HttpError(503, "authme_unavailable", "Overenie Minecraft účtu je dočasne nedostupné. Skúste to neskôr.");
      }
      if (result.error === "authme_not_configured" || result.error?.startsWith("authme_bridge")) {
        throw new HttpError(503, result.error, "Prihlasovanie cez Minecraft účet nie je nakonfigurované.");
      }
      if (result.ok) user = await upsertAuthmeUser(result.realname);
      else failureAudit = input.identifier;
    }
  }

  if (!user) {
    await audit(ctx, "auth.login_failed", {
      targetType: "login",
      summary: failureAudit ? `Neúspešné prihlásenie (${failureAudit})` : "Neúspešné prihlásenie (neznámy účet)",
    });
    throw unauthorized(GENERIC_FAIL, "invalid_credentials");
  }
  if (user.status !== "active") {
    await audit(ctx, "auth.login_blocked", { targetType: "user", targetId: user.id, summary: `Zablokovaný účet ${user.minecraft_name}` });
    throw new HttpError(403, "account_suspended", "Tento účet je pozastavený.");
  }

  await clear(`login:id:${idLower}`);
  if (await ensureOwner(user)) {
    await audit(ctx, "owner.bootstrap", { targetType: "user", targetId: user.id, summary: `Rola owner pridelená (${user.minecraft_name})`, actor: { id: user.id, name: user.minecraft_name } });
  }
  await syncStaffForUser(user.id);

  // 2) fresh session id on every login (session fixation); any presented old session is revoked.
  if (ctx.session) await revokeSession(ctx.session.session_id);
  const s = await createSession(user.id, { remember: input.remember, ip: ctx.ip, userAgent: ctx.userAgent });
  ctx.setCookie(sessionCookie(s.token, { remember: input.remember }));
  await exec("UPDATE nm_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [user.id]);

  const actor = await loadActor(user);
  await audit(ctx, "auth.login", { targetType: "user", targetId: user.id, summary: `Prihlásenie (${isEmail ? "e-mail" : "Minecraft"}${input.remember ? ", zapamätať" : ""})`, actor });
  return {
    user: toPublicUser(actor, {
      minecraft_uuid: user.minecraft_uuid,
      email: user.email,
      email_verified_at: user.email_verified_at,
      has_web_password: Boolean(user.web_password_hash),
    }),
  };
});

// ── sign-in with the one-time code from `/weblink` (no password at all) ──

const codeLoginSchema = z.object({
  code: z.string().trim().min(4).max(32),
  remember: z.boolean().optional().default(false),
  captchaId: z.string(),
  captchaAnswer: z.string().min(1).max(16),
});

post("/auth/code-login", { public: true }, async (ctx) => {
  const input = parseInput(codeLoginSchema, ctx.body);
  await enforce(`codelogin:ip:${hashIp(ctx.ip)}`, 20, 15 * 60_000);
  await verifyCaptcha(input.captchaId, input.captchaAnswer);

  const fail = async () => {
    await audit(ctx, "auth.login_failed", { targetType: "login", summary: "Neúspešné prihlásenie kódom" });
    throw unauthorized("Kód je neplatný alebo vypršal. V hre napíšte /weblink pre nový.", "invalid_code");
  };
  const normalized = input.code.toUpperCase().replace(/[\s-]/g, "");
  const row = await queryOne(
    "SELECT * FROM nm_link_codes WHERE code_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [sha256Hex(normalized)],
  );
  if (!row) return fail();
  // Single use: only one request can flip used_at.
  const used = await exec("UPDATE nm_link_codes SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id]);
  if (used.affectedRows !== 1) return fail();

  const user = await upsertCodeUser(row.minecraft_uuid, row.minecraft_name);
  if (user.status !== "active") {
    await audit(ctx, "auth.login_blocked", { targetType: "user", targetId: user.id, summary: `Zablokovaný účet ${user.minecraft_name}` });
    throw new HttpError(403, "account_suspended", "Tento účet je pozastavený.");
  }
  if (await ensureOwner(user)) {
    await audit(ctx, "owner.bootstrap", { targetType: "user", targetId: user.id, summary: `Rola owner pridelená (${user.minecraft_name})`, actor: { id: user.id, name: user.minecraft_name } });
  }
  await syncStaffForUser(user.id);

  if (ctx.session) await revokeSession(ctx.session.session_id);
  const s = await createSession(user.id, { remember: input.remember, ip: ctx.ip, userAgent: ctx.userAgent });
  ctx.setCookie(sessionCookie(s.token, { remember: input.remember }));
  await exec("UPDATE nm_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [user.id]);

  const actor = await loadActor(user);
  await audit(ctx, "auth.login", { targetType: "user", targetId: user.id, summary: `Prihlásenie (kód z hry${input.remember ? ", zapamätať" : ""})`, actor });
  return {
    user: toPublicUser(actor, {
      minecraft_uuid: user.minecraft_uuid,
      email: user.email,
      email_verified_at: user.email_verified_at,
      has_web_password: Boolean(user.web_password_hash),
    }),
  };
});

get("/auth/me", { public: true }, async (ctx) => {
  if (!ctx.user) return { user: null };
  return { user: toPublicUser(ctx.user, ctx.profile) };
});

post("/auth/logout", { public: true }, async (ctx) => {
  if (ctx.session) {
    await revokeSession(ctx.session.session_id);
    await audit(ctx, "auth.logout", { targetType: "user", targetId: ctx.user.id, summary: "Odhlásenie" });
  }
  ctx.clearSession();
  return { ok: true };
});

post("/auth/logout-all", { public: true }, async (ctx) => {
  if (!ctx.user) throw unauthorized();
  const n = await revokeAllSessions(ctx.user.id);
  await audit(ctx, "auth.logout_all", { targetType: "user", targetId: ctx.user.id, summary: `Zneplatnené všetky relácie (${n})` });
  ctx.clearSession();
  return { ok: true, revoked: n };
});

// ── password reset (web password only; AuthMe passwords are never touched) ──

const forgotSchema = z.object({
  email: emailSchema,
  captchaId: z.string(),
  captchaAnswer: z.string().min(1).max(16),
});

post("/auth/forgot", { public: true }, async (ctx) => {
  const input = parseInput(forgotSchema, ctx.body);
  await enforce(`forgot:ip:${hashIp(ctx.ip)}`, 5, 3600_000);
  await enforce(`forgot:email:${input.email}`, 3, 3600_000);
  await verifyCaptcha(input.captchaId, input.captchaAnswer);
  if (!isMailConfigured()) {
    throw new HttpError(503, "mail_not_configured", "Odosielanie e-mailov nie je na serveri nastavené.");
  }
  const user = await queryOne(
    "SELECT id, minecraft_name FROM nm_users WHERE email = ? AND email_verified_at IS NOT NULL AND status = 'active'",
    [input.email],
  );
  if (user) {
    const token = randomToken(32);
    await exec("UPDATE nm_email_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = 'reset_password' AND used_at IS NULL", [user.id]);
    await exec(
      "INSERT INTO nm_email_tokens (user_id, purpose, token_hash, email, expires_at) VALUES (?, 'reset_password', ?, ?, ?)",
      [user.id, sha256Hex(token), input.email, new Date(Date.now() + 3600_000)],
    );
    await sendMail({
      to: input.email,
      subject: "Obnovenie hesla — NinjaMelon",
      text: `Dobrý deň ${user.minecraft_name},\n\nna obnovenie webového hesla použite tento odkaz (platí 1 hodinu):\n${link(`/reset-password?token=${token}`)}\n\nHeslo k Minecraft účtu sa tým nemení. Ak ste o obnovenie nežiadali, tento e-mail ignorujte.`,
    });
  }
  // Same answer whether or not the address exists (no account enumeration).
  return { ok: true, message: "Ak je adresa overená a prepojená s účtom, poslali sme na ňu odkaz na obnovenie hesla." };
});

const resetSchema = z.object({ token: z.string().min(20).max(100), password: z.string().min(1).max(256) });

post("/auth/reset", { public: true }, async (ctx) => {
  const input = parseInput(resetSchema, ctx.body);
  await enforce(`reset:ip:${hashIp(ctx.ip)}`, 10, 3600_000);
  const row = await queryOne(
    `SELECT t.id, t.user_id, u.minecraft_name, u.email FROM nm_email_tokens t JOIN nm_users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.purpose = 'reset_password' AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`,
    [sha256Hex(input.token)],
  );
  if (!row) throw badRequest("Odkaz je neplatný alebo vypršal.", "invalid_token");
  const problem = checkWebPassword(input.password, { name: row.minecraft_name, email: row.email });
  if (problem) throw badRequest(problem, "weak_password");
  const hash = await hashWebPassword(input.password);
  const done = await tx(async (conn) => {
    const r = await exec("UPDATE nm_email_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id], conn);
    if (r.affectedRows !== 1) return false;
    await exec("UPDATE nm_users SET web_password_hash = ? WHERE id = ?", [hash, row.user_id], conn);
    await exec("UPDATE nm_sessions SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [row.user_id], conn);
    return true;
  });
  if (!done) throw badRequest("Odkaz je neplatný alebo vypršal.", "invalid_token");
  await audit(ctx, "auth.password_reset", { targetType: "user", targetId: row.user_id, summary: "Obnovené webové heslo, relácie zneplatnené", actor: { id: row.user_id, name: row.minecraft_name } });
  return { ok: true };
});

const verifySchema = z.object({ token: z.string().min(20).max(100) });

post("/auth/verify-email", { public: true }, async (ctx) => {
  const input = parseInput(verifySchema, ctx.body);
  await enforce(`verify:ip:${hashIp(ctx.ip)}`, 20, 3600_000);
  const row = await queryOne(
    `SELECT t.id, t.user_id, t.email, u.minecraft_name FROM nm_email_tokens t JOIN nm_users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.purpose = 'verify_email' AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`,
    [sha256Hex(input.token)],
  );
  if (!row) throw badRequest("Odkaz je neplatný alebo vypršal.", "invalid_token");
  await tx(async (conn) => {
    const taken = await queryOne("SELECT id FROM nm_users WHERE email = ? AND id <> ?", [row.email, row.user_id], conn);
    if (taken) throw conflict("Táto e-mailová adresa je už prepojená s iným účtom.", "email_taken");
    const r = await exec("UPDATE nm_email_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id], conn);
    if (r.affectedRows !== 1) throw badRequest("Odkaz je neplatný alebo vypršal.", "invalid_token");
    await exec("UPDATE nm_users SET email = ?, email_verified_at = UTC_TIMESTAMP() WHERE id = ?", [row.email, row.user_id], conn);
    await exec("UPDATE nm_email_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = 'verify_email' AND used_at IS NULL", [row.user_id], conn);
  });
  await audit(ctx, "account.email_verified", { targetType: "user", targetId: row.user_id, summary: "E-mail overený", actor: { id: row.user_id, name: row.minecraft_name } });
  return { ok: true };
});
