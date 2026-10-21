import { exec, query } from "./db.js";

// Key/value site settings (JSON encoded) with a very short in-memory cache so
// the per-request maintenance/page checks do not hit the database every time.
const TTL_MS = 3000;
let cache = null;
let loadedAt = 0;

export function invalidateSettings() {
  cache = null;
}

async function load() {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await query("SELECT k, v FROM nm_site_settings");
  const map = new Map();
  for (const r of rows) {
    try {
      map.set(r.k, r.v == null ? null : JSON.parse(r.v));
    } catch {
      map.set(r.k, null);
    }
  }
  cache = map;
  loadedAt = Date.now();
  return map;
}

export async function getSetting(key, fallback = null) {
  const map = await load();
  return map.has(key) && map.get(key) !== null ? map.get(key) : fallback;
}

export async function getSettings(keys) {
  const map = await load();
  const out = {};
  for (const k of keys) out[k] = map.has(k) ? map.get(k) : null;
  return out;
}

export async function setSetting(key, value, userId = null) {
  await exec(
    `INSERT INTO nm_site_settings (k, v, updated_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE v = VALUES(v), updated_by = VALUES(updated_by)`,
    [key, JSON.stringify(value), userId],
  );
  invalidateSettings();
}

export const MAINTENANCE_DEFAULT = {
  enabled: false,
  title: "Údržba webu",
  message: "Web je dočasne v údržbe. Čoskoro sa vrátime.",
  returnAt: null,
  showCountdown: false,
  activatedAt: null,
  activatedBy: null,
};

export async function getMaintenance() {
  const m = await getSetting("maintenance", null);
  return { ...MAINTENANCE_DEFAULT, ...(m || {}) };
}
