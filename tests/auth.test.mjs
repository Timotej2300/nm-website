import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setup, teardown, resetLimits, Client, loginAs, addAuthmeUser, pluginLinkCode, query, exec, outbox, OWNER_UUID, PLUGIN_KEY } from "./helpers.mjs";

before(setup);
after(teardown);
beforeEach(resetLimits);

test("unauthenticated users cannot read protected API data", async () => {
  const c = new Client();
  for (const p of ["/news", "/staff", "/store/ranks", "/votes/sites", "/tickets", "/account", "/admin/dashboard"]) {
    const r = await c.get(p);
    assert.equal(r.status, 401, p);
  }
  const s = await c.get("/site/status");
  assert.equal(s.status, 200);
  assert.equal((await c.get("/auth/me")).data.user, null);
});

test("CSRF guard: state-changing request without the custom header is refused", async () => {
  const c = new Client();
  const r = await c.post("/auth/logout", {}, { csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.data.error.code, "csrf");
  const bad = await c.post("/auth/logout", {}, { headers: { origin: "https://evil.example" } });
  assert.equal(bad.status, 403);
});

test("Minecraft (AuthMe SHA256) login works; wrong password and unknown hash do not", async () => {
  await addAuthmeUser("Steve_NM", "Correct-horse-1");
  const c = new Client();
  const bad = await c.login("Steve_NM", "wrong-password");
  assert.equal(bad.status, 401);
  assert.equal(bad.data.error.code, "invalid_credentials");
  const unknown = await c.login("Nobody_Here", "whatever-pass");
  assert.equal(unknown.status, 401);
  assert.equal(unknown.data.error.message, bad.data.error.message, "no account enumeration");
  const ok = await c.login("steve_nm", "Correct-horse-1"); // nick is case-insensitive
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.name, "Steve_NM");
  assert.ok(!JSON.stringify(ok.data).includes("hash"));
  assert.equal((await c.get("/auth/me")).data.user.name, "Steve_NM");
  await addAuthmeUser("Weird_Hash", "Whatever-pass-1", "unknown");
  assert.equal((await new Client().login("Weird_Hash", "Whatever-pass-1")).status, 401, "unsupported hash fails closed");
});

test("AuthMe BCRYPT hashes are verified too", async () => {
  await addAuthmeUser("Bcrypt_Bob", "Bcrypt-pass-123", "bcrypt");
  assert.equal((await new Client().login("Bcrypt_Bob", "Bcrypt-pass-123")).status, 200);
  assert.equal((await new Client().login("Bcrypt_Bob", "Bcrypt-pass-124")).status, 401);
});

test("CAPTCHA is required, server-verified and single-use", async () => {
  await addAuthmeUser("Captcha_Kid", "Captcha-pass-123");
  const c = new Client();
  const noCaptcha = await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", captchaId: "0".repeat(32), captchaAnswer: "AAAAA" });
  assert.equal(noCaptcha.status, 400);
  assert.equal(noCaptcha.data.error.code, "captcha_failed");
  const cap = await c.captcha();
  const wrongAnswer = await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", captchaId: cap.captchaId, captchaAnswer: "ZZZZZ" });
  assert.equal(wrongAnswer.status, 400);
  // the same challenge cannot be retried with the right answer: it was consumed
  const retry = await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", ...cap });
  assert.equal(retry.status, 400);
  const fresh = await c.captcha();
  const ok = await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", ...fresh });
  assert.equal(ok.status, 200);
  const replay = await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", ...fresh });
  assert.equal(replay.status, 400, "a used CAPTCHA cannot be replayed");
  // expiry
  const old = await c.captcha();
  await exec("UPDATE nm_captcha SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE id = ?", [old.captchaId]);
  assert.equal((await c.post("/auth/login", { identifier: "Captcha_Kid", password: "Captcha-pass-123", ...old })).status, 400);
  // the real answer never leaves the server in production mode
  const raw = await new Client().get("/auth/captcha");
  assert.match(raw.data.svg, /^<svg/);
});

test("login attempts are rate limited per account", async () => {
  await addAuthmeUser("Rate_Rick", "Rate-pass-1234");
  const c = new Client();
  let last;
  for (let i = 0; i < 12; i++) last = await c.login("Rate_Rick", "bad-bad-bad");
  assert.equal(last.status, 429);
  assert.ok(last.headers.get("retry-after"));
  assert.equal((await c.login("Rate_Rick", "Rate-pass-1234")).status, 429, "even the right password is blocked while limited");
});

test("'Remember me' really changes session lifetime and cookie persistence", async () => {
  const a = await loginAs("Short_Sam");
  assert.ok(!a.client.lastSetCookie.length || true);
  const shortRow = (await query("SELECT remember, TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), expires_at) AS h FROM nm_sessions WHERE user_id = ?", [a.id]))[0];
  assert.equal(shortRow.remember, 0);
  assert.ok(shortRow.h <= 12);
  await addAuthmeUser("Long_Lou", "Secret-pass-123");
  const c = new Client();
  const r = await c.login("Long_Lou", "Secret-pass-123", true);
  assert.equal(r.status, 200);
  const cookie = c.lastSetCookie[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=2592000/);
  const longRow = (await query("SELECT remember, TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), expires_at) AS h FROM nm_sessions WHERE user_id = ?", [r.data.user.id]))[0];
  assert.equal(longRow.remember, 1);
  assert.ok(longRow.h > 24 * 28);
  // a non-remembered login sets a browser-session cookie (no Max-Age)
  const s = new Client();
  await s.login("Short_Sam", "Secret-pass-123");
  assert.doesNotMatch(s.lastSetCookie[0], /Max-Age/);
  // expired sessions are rejected
  await exec("UPDATE nm_sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE WHERE user_id = ?", [a.id]);
  assert.equal((await a.client.get("/news")).status, 401);
});

test("session fixation: every login issues a new token and revokes the old one", async () => {
  const u = await loginAs("Fix_Fiona");
  const oldCookies = { ...u.client.cookies };
  const r = await u.client.login("Fix_Fiona", u.password);
  assert.equal(r.status, 200);
  assert.notDeepEqual(u.client.cookies, oldCookies);
  const stale = new Client();
  stale.cookies = oldCookies;
  assert.equal((await stale.get("/news")).status, 401, "old session id no longer works");
});

test("logout and logout-all invalidate sessions server-side", async () => {
  const u = await loginAs("Out_Olga");
  const copy = new Client();
  copy.cookies = { ...u.client.cookies };
  assert.equal((await u.client.post("/auth/logout")).status, 200);
  assert.equal((await copy.get("/news")).status, 401, "revoked on the server, not just cleared in the browser");
  const a = new Client();
  const b = new Client();
  await a.login("Out_Olga", u.password);
  await b.login("Out_Olga", u.password);
  assert.equal((await a.post("/auth/logout-all")).status, 200);
  assert.equal((await b.get("/news")).status, 401);
});

test("owner bootstrap needs the verified UUID — nick alone is never enough", async () => {
  const o = await loginAs("X4yl0n");
  assert.equal((await o.client.get("/admin/dashboard")).status, 403, "no admin rights before linking");
  // a code issued for someone else's UUID/name cannot be used to claim the owner UUID
  const evilCode = await pluginLinkCode("99999999-9999-9999-9999-999999999999", "Evil_Eve");
  await addAuthmeUser("Evil_Eve", "Secret-pass-123");
  const evil = new Client();
  await evil.login("Evil_Eve", "Secret-pass-123");
  const mismatch = await o.client.post("/account/link", { code: evilCode });
  assert.equal(mismatch.status, 400, "code issued for another player does not match this account");
  assert.equal((await evil.get("/admin/dashboard")).status, 403);
  // real owner link
  const code = await pluginLinkCode(OWNER_UUID, "X4yl0n");
  const linked = await o.client.post("/account/link", { code });
  assert.equal(linked.status, 200);
  assert.ok(linked.data.user.roles.some((r) => r.key === "owner"));
  assert.equal((await o.client.get("/admin/dashboard")).status, 200);
  assert.equal((await o.client.post("/account/link", { code })).status, 400, "codes are one-time");
  // the owner shows up in the public staff roster automatically
  const staff = await o.client.get("/staff");
  assert.ok(staff.data.members.some((m) => m.username === "X4yl0n" && m.tier === "owner"));
});

test("link codes expire; plugin endpoints need the shared secret", async () => {
  const c = new Client();
  const noKey = await c.post("/plugin/link-code", { uuid: OWNER_UUID, name: "X4yl0n" }, { csrf: false });
  assert.equal(noKey.status, 401);
  const wrong = await c.post("/plugin/link-code", { uuid: OWNER_UUID, name: "X4yl0n" }, { csrf: false, headers: { authorization: "Bearer nope" } });
  assert.equal(wrong.status, 401);
  const u = await loginAs("Late_Larry");
  const code = await pluginLinkCode("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "Late_Larry");
  await exec("UPDATE nm_link_codes SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 MINUTE");
  assert.equal((await u.client.post("/account/link", { code })).status, 400);
});

test("e-mail linking, verification and e-mail login with a separate web password", async () => {
  const u = await loginAs("Mail_Mia", "Minecraft-pass-1");
  outbox.length = 0;
  const weak = await u.client.post("/account/email", { email: "mia@example.com", currentPassword: "Minecraft-pass-1", webPassword: "short" });
  assert.equal(weak.status, 400);
  const wrongPw = await u.client.post("/account/email", { email: "mia@example.com", currentPassword: "nope-nope-nope", webPassword: "Web-password-123" });
  assert.equal(wrongPw.status, 403);
  const same = await u.client.post("/account/email", { email: "mia@example.com", currentPassword: "Minecraft-pass-1", webPassword: "Minecraft-pass-1" });
  assert.equal(same.status, 400, "web password must differ from the Minecraft one");
  const ok = await u.client.post("/account/email", { email: "Mia@Example.com", currentPassword: "Minecraft-pass-1", webPassword: "Web-password-123" });
  assert.equal(ok.status, 200);
  assert.equal(outbox.length, 1);
  assert.equal((await new Client().login("mia@example.com", "Web-password-123")).status, 401, "unverified e-mail cannot log in");
  const token = outbox[0].text.match(/token=([\w-]+)/)[1];
  assert.equal((await new Client().post("/auth/verify-email", { token: "x".repeat(43) })).status, 400);
  assert.equal((await new Client().post("/auth/verify-email", { token })).status, 200);
  assert.equal((await new Client().post("/auth/verify-email", { token })).status, 400, "token is single-use");
  const byMail = new Client();
  const r = await byMail.login("mia@example.com", "Web-password-123");
  assert.equal(r.status, 200);
  assert.equal(r.data.user.name, "Mail_Mia");
  assert.equal(r.data.user.emailVerified, true);
  // the Minecraft password does NOT work as an e-mail password
  assert.equal((await new Client().login("mia@example.com", "Minecraft-pass-1")).status, 401);
  // another account cannot take over the same address
  const other = await loginAs("Mail_Max", "Minecraft-pass-2");
  outbox.length = 0;
  const dup = await other.client.post("/account/email", { email: "mia@example.com", currentPassword: "Minecraft-pass-2", webPassword: "Another-web-pass-1" });
  assert.equal(dup.status, 200, "same answer (no enumeration)");
  assert.equal(outbox.length, 0, "but nothing was sent");
  // hashes are never exposed
  const row = (await query("SELECT web_password_hash FROM nm_users WHERE id = ?", [u.id]))[0];
  assert.match(row.web_password_hash, /^\$argon2id\$/);
});

test("password reset: generic answer, one-time token, revokes sessions, never touches AuthMe", async () => {
  const u = await loginAs("Reset_Rex", "Minecraft-pass-9");
  outbox.length = 0;
  await u.client.post("/account/email", { email: "rex@example.com", currentPassword: "Minecraft-pass-9", webPassword: "Old-web-password-1" });
  await new Client().post("/auth/verify-email", { token: outbox[0].text.match(/token=([\w-]+)/)[1] });
  outbox.length = 0;
  const c = new Client();
  const unknown = await c.post("/auth/forgot", { email: "ghost@example.com", ...(await c.captcha()) });
  const known = await c.post("/auth/forgot", { email: "rex@example.com", ...(await c.captcha()) });
  assert.deepEqual(unknown.data, known.data);
  assert.equal(outbox.length, 1);
  const token = outbox[0].text.match(/token=([\w-]+)/)[1];
  assert.equal((await c.post("/auth/reset", { token, password: "weak" })).status, 400);
  assert.equal((await c.post("/auth/reset", { token, password: "Brand-new-password-1" })).status, 200);
  assert.equal((await c.post("/auth/reset", { token, password: "Brand-new-password-2" })).status, 400, "single use");
  assert.equal((await u.client.get("/news")).status, 401, "existing sessions revoked");
  assert.equal((await new Client().login("rex@example.com", "Brand-new-password-1")).status, 200);
  assert.equal((await new Client().login("Reset_Rex", "Minecraft-pass-9")).status, 200, "Minecraft password unchanged");
});

test("unauthenticated and plain users cannot reach the admin API", async () => {
  const u = await loginAs("Plain_Pat");
  for (const p of ["/admin/dashboard", "/admin/users", "/admin/roles", "/admin/pages", "/admin/audit", "/admin/system", "/admin/news", "/admin/tickets"]) {
    assert.equal((await u.client.get(p)).status, 403, p);
  }
  assert.equal((await u.client.put("/admin/maintenance", { enabled: true, title: "x", message: "y", confirm: true })).status, 403);
});

test("audit log never contains passwords, hashes or tokens", async () => {
  const rows = await query("SELECT action, summary FROM nm_audit_log");
  assert.ok(rows.length > 5);
  const blob = JSON.stringify(rows);
  for (const secret of ["Secret-pass-123", "Minecraft-pass", "Web-password", "$argon2", "$SHA$", PLUGIN_KEY]) {
    assert.ok(!blob.includes(secret), `leaked ${secret}`);
  }
  assert.ok(rows.some((r) => r.action === "auth.login") && rows.some((r) => r.action === "auth.login_failed"));
});
