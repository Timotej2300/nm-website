import { HttpError, badRequest, unauthorized, forbidden } from "./errors.js";
import { parseCookies, loadSession, clearSessionCookie } from "./session.js";
import { SESSION_COOKIE, siteUrl } from "./config.js";
import { loadActor, can, canAny } from "./perms.js";
import { getMaintenance } from "./settings.js";
import { getPageStates } from "./pages.js";

const routes = [];

/**
 * Registers an API route (path is relative to /api).
 * opts:
 *   public: true   – no login needed, not blocked by maintenance (auth, status, plugin)
 *   perm: "x"|[..] – any-of permission required (implies login)
 *   page: "news"   – page key; returns 503 when the page is switched off
 *   csrf: false    – skip the browser CSRF guard (secret-authenticated machine endpoints)
 *   maxBody: bytes – JSON body limit (default 100 KB)
 */
export function route(method, pattern, opts, handler) {
  if (typeof opts === "function") {
    handler = opts;
    opts = {};
  }
  const keys = [];
  const re = new RegExp(
    "^" +
      pattern.replace(/:([A-Za-z_]+)/g, (_, k) => {
        keys.push(k);
        return "([^/]+)";
      }) +
      "/?$",
  );
  routes.push({ method, re, keys, opts, handler });
}

export const get = (p, o, h) => route("GET", p, o, h);
export const post = (p, o, h) => route("POST", p, o, h);
export const put = (p, o, h) => route("PUT", p, o, h);
export const patch = (p, o, h) => route("PATCH", p, o, h);
export const del = (p, o, h) => route("DELETE", p, o, h);

export function parseInput(schema, data) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const issue = r.error.issues[0];
    const field = issue?.path?.join(".") || "";
    throw badRequest(
      `Neplatný údaj${field ? ` (${field})` : ""}: ${issue?.message || "skontrolujte vstup"}`,
      "validation_failed",
      { field },
    );
  }
  return r.data;
}

export function clientIp(req) {
  const h = req.headers;
  const xff = h["x-vercel-forwarded-for"] || h["x-real-ip"] || h["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

async function readBody(req, limit) {
  if (req.body !== undefined && req.body !== null) {
    // Vercel's Node helpers may already have parsed the body.
    if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
    if (typeof req.body === "string") return req.body;
    return JSON.stringify(req.body);
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new HttpError(413, "payload_too_large", "Požiadavka je príliš veľká");
    chunks.push(c);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function checkCsrf(req) {
  const xrw = req.headers["x-requested-with"];
  if (xrw !== "nm") throw forbidden("Chýba CSRF hlavička", "csrf");
  const origin = req.headers.origin;
  if (origin) {
    let ok;
    try {
      const o = new URL(origin);
      ok = o.host === req.headers.host || o.origin === new URL(siteUrl()).origin;
    } catch {
      ok = false;
    }
    if (!ok) throw forbidden("Neplatný pôvod požiadavky", "csrf");
  }
}

function send(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
}

export async function handleApi(req, res) {
  const cookies = [];
  try {
    const url = new URL(req.url, "http://x");
    const path = url.pathname.replace(/^\/api/, "") || "/";
    const method = (req.method || "GET").toUpperCase();

    let matched = null;
    let pathMatched = false;
    for (const r of routes) {
      const m = r.re.exec(path);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== method) continue;
      matched = { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      break;
    }
    if (!matched) {
      if (pathMatched) throw new HttpError(405, "method_not_allowed", "Nepodporovaná metóda");
      throw new HttpError(404, "not_found", "Nenájdené");
    }
    const { r, params } = matched;
    const opts = r.opts;

    const safe = method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (!safe && opts.csrf !== false) checkCsrf(req);

    const ctx = {
      req,
      res,
      method,
      path,
      params,
      query: Object.fromEntries(url.searchParams),
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || "",
      body: null,
      status: 200,
      user: null,
      session: null,
      setCookie: (c) => cookies.push(c),
      clearSession: () => cookies.push(clearSessionCookie()),
    };

    if (!safe) {
      const ct = String(req.headers["content-type"] || "");
      const raw = await readBody(req, opts.maxBody || 100 * 1024);
      if (raw && raw.length) {
        if (!ct.includes("application/json")) {
          throw new HttpError(415, "unsupported_media_type", "Očakáva sa application/json");
        }
        try {
          ctx.body = JSON.parse(raw);
        } catch {
          throw badRequest("Neplatný JSON");
        }
      } else {
        ctx.body = {};
      }
    }

    // Session (if any) is resolved for every route so public ones can use it too.
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE()];
    if (token) {
      const s = await loadSession(token);
      if (s) {
        ctx.session = s;
        ctx.user = await loadActor(s);
        ctx.profile = s;
      } else {
        ctx.clearSession(); // stale / revoked cookie
      }
    }

    const needsPerm = opts.perm ? (Array.isArray(opts.perm) ? opts.perm : [opts.perm]) : null;
    if (!opts.public || needsPerm) {
      if (!ctx.user) throw unauthorized();
    }
    if (needsPerm && !canAny(ctx.user, needsPerm)) throw forbidden();

    if (!opts.public && !needsPerm) {
      // Player-facing data endpoints: maintenance + per-page switches apply.
      const maint = await getMaintenance();
      if (maint.enabled && !can(ctx.user, "admin.access")) {
        throw new HttpError(503, "maintenance", maint.message, { maintenance: true });
      }
      if (opts.page) {
        const states = await getPageStates();
        const st = states[opts.page];
        if (st && !st.enabled && !can(ctx.user, "admin.access")) {
          throw new HttpError(503, "page_disabled", st.message, { page: opts.page });
        }
      }
    }

    const out = await r.handler(ctx);
    const headers = cookies.length ? { "Set-Cookie": cookies } : {};
    send(res, ctx.status, out === undefined ? { ok: true } : out, headers);
  } catch (e) {
    const headers = cookies.length ? { "Set-Cookie": cookies } : {};
    if (e instanceof HttpError) {
      if (e.status === 429 && e.extra?.retryAfterSec) headers["Retry-After"] = String(e.extra.retryAfterSec);
      return send(
        res,
        e.status,
        { error: { code: e.code, message: e.message, ...(e.extra || {}) } },
        headers,
      );
    }
    // Never leak internals (SQL, stack traces, secrets) to the client.
    console.error("API error:", e?.code || e?.name, e?.message?.slice(0, 200));
    send(res, 500, { error: { code: "server_error", message: "Nastala chyba servera. Skúste to neskôr." } }, headers);
  }
}

export function pageParams(query, defSize = 25, maxSize = 100) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const size = Math.min(maxSize, Math.max(1, Number.parseInt(query.size, 10) || defSize));
  return { page, size, offset: (page - 1) * size };
}
