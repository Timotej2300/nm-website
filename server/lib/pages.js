import { query } from "./db.js";
import { PAGE_KEYS } from "../../shared/permissions.js";
import { HttpError } from "./errors.js";

const TTL_MS = 3000;
let cache = null;
let loadedAt = 0;

export function invalidatePages() {
  cache = null;
}

const DEFAULT_MESSAGE = "Táto stránka je dočasne nedostupná.";

/**
 * Effective state of a page:
 *  - the manual switch (`enabled`) is the baseline;
 *  - if a scheduled enable/disable moment has already passed, the most recent
 *    one wins over the baseline. A manual save clears the schedule, so a manual
 *    change always takes precedence over older schedules.
 */
export function effectiveState(row, now = Date.now()) {
  let enabled = Boolean(row.enabled);
  const on = row.schedule_enable_at ? new Date(row.schedule_enable_at).getTime() : null;
  const off = row.schedule_disable_at ? new Date(row.schedule_disable_at).getTime() : null;
  const onPast = on != null && on <= now;
  const offPast = off != null && off <= now;
  if (onPast && offPast) enabled = on > off;
  else if (onPast) enabled = true;
  else if (offPast) enabled = false;
  return enabled;
}

export async function getPageRows() {
  const rows = await query("SELECT * FROM nm_page_settings");
  const byKey = new Map(rows.map((r) => [r.page_key, r]));
  return PAGE_KEYS.map(
    (key) =>
      byKey.get(key) || {
        page_key: key,
        enabled: 1,
        message: null,
        schedule_enable_at: null,
        schedule_disable_at: null,
        updated_by_name: null,
        updated_at: null,
      },
  );
}

export async function getPageStates() {
  if (cache && Date.now() - loadedAt < TTL_MS) return cache;
  const rows = await getPageRows();
  const map = {};
  for (const r of rows) {
    map[r.page_key] = {
      enabled: effectiveState(r),
      message: r.message || DEFAULT_MESSAGE,
    };
  }
  // NewsDetails can never be reachable while News is off.
  if (!map.news.enabled) map.news_details = { ...map.news, enabled: false };
  cache = map;
  loadedAt = Date.now();
  return map;
}

export async function assertPageEnabled(pageKey) {
  const states = await getPageStates();
  const st = states[pageKey];
  if (st && !st.enabled) {
    throw new HttpError(503, "page_disabled", st.message, { page: pageKey });
  }
}
