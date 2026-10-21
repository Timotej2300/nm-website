// Thin fetch wrapper for the NinjaMelon API (same origin, cookie session).
// The x-requested-with header is the CSRF guard the server requires on writes.

export class ApiError extends Error {
  constructor(status, code, message, data) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        "x-requested-with": "nm",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError(0, "network", "Server je nedostupný. Skontrolujte pripojenie.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const err = data?.error || {};
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event("nm:unauthorized"));
    if (res.status === 503 && (err.code === "maintenance" || err.code === "page_disabled")) {
      window.dispatchEvent(new Event("nm:refresh-status"));
    }
    throw new ApiError(res.status, err.code || "error", err.message || "Nastala chyba", err);
  }
  return data;
}

export const api = {
  get: (p, o) => request(p, o),
  post: (p, body = {}) => request(p, { method: "POST", body }),
  put: (p, body = {}) => request(p, { method: "PUT", body }),
  patch: (p, body = {}) => request(p, { method: "PATCH", body }),
  del: (p) => request(p, { method: "DELETE" }),
};

export function errorMessage(e) {
  return e instanceof ApiError || e?.message ? e.message : "Nastala chyba";
}
