import http from "node:http";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

// Test environment — must be set before the server modules are first used.
const BASE = process.env.TEST_DB_BASE || "mysql://nm:nmpass@127.0.0.1:3307";
export const OWNER_UUID = "11111111-2222-3333-4444-555555555555";
export const PLUGIN_KEY = "test-plugin-secret-0123456789abcdef";
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: `${BASE}/nm_test`,
  AUTHME_DATABASE_URL: `${BASE}/authme_test`,
  APP_SECRET: "test-app-secret-test-app-secret-test-app-secret",
  NM_TEST_EXPOSE_CAPTCHA: "1",
  MAIL_TRANSPORT: "capture",
  OWNER_MINECRAFT_UUID: OWNER_UUID,
  PLUGIN_API_SECRET: PLUGIN_KEY,
  SITE_URL: "http://localhost",
});

const { migrate } = await import("../scripts/migrate.mjs");
const { seedContent } = await import("../scripts/seed-content.mjs");
const { handleApi } = await import("../server/index.js");
const { closeDb, exec, query } = await import("../server/lib/db.js");
const { invalidateSettings } = await import("../server/lib/settings.js");
const { invalidatePages } = await import("../server/lib/pages.js");
const { outbox } = await import("../server/lib/mailer.js");
export { outbox, query, exec };

let server;
let port;

export async function setup() {
  const root = await mysql.createConnection({ uri: `${BASE}/`, multipleStatements: true });
  await root.query("DROP DATABASE IF EXISTS nm_test; CREATE DATABASE nm_test CHARACTER SET utf8mb4; DROP DATABASE IF EXISTS authme_test; CREATE DATABASE authme_test CHARACTER SET utf8mb4;");
  await root.query(`CREATE TABLE authme_test.authme (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) UNIQUE, realname VARCHAR(255), password VARCHAR(255))`);
  await root.end();
  await migrate(process.env.DATABASE_URL, () => {});
  await seedContent(process.env.DATABASE_URL, () => {});
  server = http.createServer((req, res) => handleApi(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  port = server.address().port;
}

export async function teardown() {
  await new Promise((r) => server.close(r));
  await closeDb();
}

export async function resetLimits() {
  await exec("DELETE FROM nm_rate_limits");
}
export function refreshCaches() {
  invalidateSettings();
  invalidatePages();
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
export async function addAuthmeUser(name, password, algo = "sha256") {
  let hash;
  if (algo === "bcrypt") hash = await bcrypt.hash(password, 4);
  else if (algo === "unknown") hash = "$WEIRD$abc$def";
  else {
    const salt = crypto.randomBytes(8).toString("hex");
    hash = `$SHA$${salt}$${sha(sha(password) + salt)}`;
  }
  const c = await mysql.createConnection({ uri: `${BASE}/authme_test` });
  await c.query("REPLACE INTO authme (username, realname, password) VALUES (?, ?, ?)", [name.toLowerCase(), name, hash]);
  await c.end();
}

export class Client {
  constructor() {
    this.cookies = {};
    this.headers = {};
  }
  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  }
  async req(method, path, body, { csrf = true, headers = {} } = {}) {
    const h = { ...headers };
    if (this.cookieHeader()) h.cookie = this.cookieHeader();
    if (csrf && method !== "GET") h["x-requested-with"] = "nm";
    if (body !== undefined) h["content-type"] = "application/json";
    const res = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    this.lastSetCookie = set;
    for (const c of set) {
      const [pair, ...attrs] = c.split("; ");
      const i = pair.indexOf("=");
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (v === "" || attrs.some((a) => /^Max-Age=0$/i.test(a))) delete this.cookies[k];
      else this.cookies[k] = v;
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* empty */
    }
    return { status: res.status, data, headers: res.headers };
  }
  get = (p) => this.req("GET", p);
  post = (p, b = {}, o) => this.req("POST", p, b, o);
  put = (p, b = {}) => this.req("PUT", p, b);
  patch = (p, b = {}) => this.req("PATCH", p, b);
  del = (p) => this.req("DELETE", p);

  async captcha() {
    const r = await this.get("/auth/captcha");
    return { captchaId: r.data.id, captchaAnswer: r.data.answer };
  }
  async login(identifier, password, remember = false) {
    const c = await this.captcha();
    return this.post("/auth/login", { identifier, password, remember, ...c });
  }
}

/** Creates the AuthMe account, logs in (creating the web profile) and returns { client, id }. */
export async function loginAs(name, password = "Secret-pass-123", algo = "sha256") {
  await addAuthmeUser(name, password, algo);
  const client = new Client();
  const r = await client.login(name, password);
  if (r.status !== 200) throw new Error(`login failed for ${name}: ${r.status} ${JSON.stringify(r.data)}`);
  return { client, id: r.data.user.id, password };
}

export async function giveRole(userId, roleKey) {
  await exec("INSERT IGNORE INTO nm_user_roles (user_id, role_key) VALUES (?, ?)", [userId, roleKey]);
}
export async function dropRole(userId, roleKey) {
  await exec("DELETE FROM nm_user_roles WHERE user_id = ? AND role_key = ?", [userId, roleKey]);
}

/** Logs in again so the client picks up fresh server-side permissions (permissions are re-read per request anyway). */
export async function makeOwner(name = "X4yl0n") {
  const u = await loginAs(name);
  const code = await pluginLinkCode(OWNER_UUID, name);
  const r = await u.client.post("/account/link", { code });
  if (r.status !== 200) throw new Error("owner link failed " + JSON.stringify(r.data));
  return u;
}

export async function pluginLinkCode(uuid, name) {
  const c = new Client();
  const r = await c.post("/plugin/link-code", { uuid, name }, { csrf: false, headers: { authorization: `Bearer ${PLUGIN_KEY}` } });
  if (r.status !== 200) throw new Error("link-code failed " + JSON.stringify(r.data));
  return r.data.code;
}
