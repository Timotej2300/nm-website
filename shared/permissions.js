// Shared between the Vercel API (server/) and the React admin UI (src/).
// Single source of truth for permission keys, pages and ticket statuses.

export const PERMISSIONS = {
  "admin.access": "Prístup do admin panelu",
  "users.view": "Zobraziť používateľov",
  "users.manage": "Spravovať používateľov a ich roly",
  "roles.manage": "Vytvárať a upravovať roly a oprávnenia",
  "staff.manage": "Spravovať verejný tím (Staff)",
  "tickets.view_assigned": "Vidieť tickety priradené sebe",
  "tickets.view_category": "Vidieť tickety vo svojich kategóriách",
  "tickets.view_all": "Vidieť všetky tickety",
  "tickets.reply": "Odpovedať na tickety",
  "tickets.claim": "Prevziať nepriradený ticket",
  "tickets.assign": "Priraďovať tickety kolegom",
  "tickets.change_status": "Meniť stav ticketov",
  "tickets.internal_notes": "Vytvárať a čítať interné poznámky",
  "tickets.manage_categories": "Spravovať kategórie ticketov",
  "tickets.manage_settings": "Spravovať nastavenia ticketov",
  "pages.manage": "Spravovať dostupnosť stránok",
  "maintenance.manage": "Zapínať a vypínať Maintenance Mode",
  "news.manage": "Spravovať novinky",
  "store.manage": "Spravovať obchod",
  "votes.manage": "Spravovať hlasovanie",
  "settings.manage": "Meniť nastavenia webu",
  "audit.view": "Prezerať audit log",
  "security.view": "Prezerať bezpečnosť a systémový stav",
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);

// page_key -> label + public path. Order = order shown in the admin panel.
export const PAGES = [
  { key: "home", label: "Home", path: "/" },
  { key: "cart", label: "Cart", path: "/cart" },
  { key: "login", label: "Login", path: "/login" },
  { key: "news", label: "News", path: "/news" },
  { key: "news_details", label: "NewsDetails", path: "/news/:slug" },
  { key: "staff", label: "Staff", path: "/staff" },
  { key: "store", label: "Store", path: "/store" },
  { key: "votes", label: "Votes", path: "/votes" },
  { key: "tickets", label: "Tickets", path: "/tickets" },
];
export const PAGE_KEYS = PAGES.map((p) => p.key);

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_PLAYER",
  "WAITING_FOR_STAFF",
  "RESOLVED",
  "CLOSED",
];

export const TICKET_STATUS_LABELS = {
  OPEN: "Nový",
  IN_PROGRESS: "Rieši sa",
  WAITING_FOR_PLAYER: "Čaká sa na hráča",
  WAITING_FOR_STAFF: "Čaká sa na tím",
  RESOLVED: "Vyriešený",
  CLOSED: "Uzavretý",
};

export const MC_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
