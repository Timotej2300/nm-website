// All configuration comes from environment variables (see .env.example).
// Read lazily so tests can change process.env between runs.

const env = () => process.env;

export function isProd() {
  return env().VERCEL_ENV === "production" || env().NODE_ENV === "production";
}

export function siteUrl() {
  return (env().SITE_URL || "http://localhost:5173").replace(/\/+$/, "");
}

export function appSecret() {
  const s = env().APP_SECRET;
  if (s && s.length >= 32) return s;
  if (isProd()) {
    throw new Error("APP_SECRET is missing or shorter than 32 characters");
  }
  // Non-production fallback so local dev works without setup. Never used in prod.
  return "dev-only-secret-dev-only-secret-0123456789";
}

export function pluginSecret() {
  const s = env().PLUGIN_API_SECRET;
  return s && s.length >= 24 ? s : null;
}

export function ownerUuid() {
  const raw = (env().OWNER_MINECRAFT_UUID || "").trim().toLowerCase();
  const hex = raw.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return normalizeUuid(hex);
}

export function normalizeUuid(value) {
  const hex = String(value || "").toLowerCase().replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const SESSION_COOKIE = () =>
  isProd() ? "__Host-nm_session" : "nm_session";

export const SESSION_SHORT_MS = 12 * 60 * 60 * 1000; // no "remember me"
export const SESSION_LONG_MS = 30 * 24 * 60 * 60 * 1000; // "remember me"
