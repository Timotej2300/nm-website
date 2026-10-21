import { get } from "../lib/http.js";
import { getMaintenance } from "../lib/settings.js";
import { getPageStates } from "../lib/pages.js";

// Public (no login): the SPA needs this before anyone is signed in, to show
// the maintenance screen or "page unavailable" notices. Contains no secrets.
get("/site/status", { public: true }, async () => {
  const [m, pages] = await Promise.all([getMaintenance(), getPageStates()]);
  return {
    maintenance: {
      enabled: m.enabled,
      title: m.title,
      message: m.message,
      returnAt: m.returnAt,
      showCountdown: m.showCountdown,
      activatedAt: m.activatedAt,
    },
    pages,
    serverTime: new Date().toISOString(),
  };
});
