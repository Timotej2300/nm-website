import { exec, queryOne } from "./db.js";
import { sha256Hex } from "./crypto.js";
import { HttpError } from "./errors.js";

function key(bucket) {
  // bucket column is 191 chars; long/untrusted identifiers are hashed.
  return bucket.length > 150 ? `h:${sha256Hex(bucket)}` : bucket;
}

/**
 * Fixed-window counter stored in the database (works across serverless
 * instances). Returns { ok, hits, retryAfterSec }.
 */
export async function hit(bucket, limit, windowMs) {
  const b = key(bucket);
  const now = Date.now();
  const resetAt = now + windowMs;
  await exec(
    `INSERT INTO nm_rate_limits (bucket, hits, reset_at_ms) VALUES (?, 1, ?)
     ON DUPLICATE KEY UPDATE
       hits = IF(reset_at_ms <= ?, 1, hits + 1),
       reset_at_ms = IF(reset_at_ms <= ?, ?, reset_at_ms)`,
    [b, resetAt, now, now, resetAt],
  );
  const row = await queryOne(
    "SELECT hits, reset_at_ms FROM nm_rate_limits WHERE bucket = ?",
    [b],
  );
  if (Math.random() < 0.01) {
    exec("DELETE FROM nm_rate_limits WHERE reset_at_ms < ?", [now - 3600_000]).catch(() => {});
  }
  const hits = Number(row?.hits ?? 1);
  return {
    ok: hits <= limit,
    hits,
    retryAfterSec: Math.max(1, Math.ceil((Number(row?.reset_at_ms ?? resetAt) - now) / 1000)),
  };
}

export async function enforce(bucket, limit, windowMs, message) {
  const r = await hit(bucket, limit, windowMs);
  if (!r.ok) {
    throw new HttpError(
      429,
      "rate_limited",
      message || "Príliš veľa pokusov. Skúste to neskôr.",
      { retryAfterSec: r.retryAfterSec },
    );
  }
  return r;
}

// Count a failure without blocking (used for per-account login failure budgets).
export async function peek(bucket) {
  const row = await queryOne(
    "SELECT hits, reset_at_ms FROM nm_rate_limits WHERE bucket = ?",
    [key(bucket)],
  );
  if (!row || Number(row.reset_at_ms) <= Date.now()) return 0;
  return Number(row.hits);
}

export async function clear(bucket) {
  await exec("DELETE FROM nm_rate_limits WHERE bucket = ?", [key(bucket)]);
}
