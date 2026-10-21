import { z } from "zod";
import { get, post, parseInput } from "../lib/http.js";
import { query, queryOne } from "../lib/db.js";
import { getSetting } from "../lib/settings.js";
import { HttpError, notFound } from "../lib/errors.js";

// ───────────── shared formatting (keeps the exact shapes the existing UI expects) ─────────────

export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

async function currencySymbol() {
  return String(await getSetting("store.currency_symbol", "$"));
}

const money = (symbol, n) => `${symbol}${Number(n).toFixed(2)}`;

function parseJson(text, fallback) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch {
    return fallback;
  }
}

// ───────────── News ─────────────

const newsCard = (r) => ({
  slug: r.slug,
  image: r.image,
  category: r.category || "News",
  tone: r.tone || "var(--color-info)",
  date: formatDate(r.published_at),
  author: r.author || "",
  title: r.title,
  excerpt: r.excerpt || "",
});

get("/news", { page: "news" }, async (ctx) => {
  const limit = Math.min(50, Number.parseInt(ctx.query.limit, 10) || 50);
  const rows = await query(
    "SELECT * FROM nm_news WHERE status = 'published' AND published_at <= UTC_TIMESTAMP() ORDER BY published_at DESC LIMIT ?",
    [limit],
  );
  return { posts: rows.map(newsCard) };
});

get("/news/:slug", { page: "news_details" }, async (ctx) => {
  const r = await queryOne(
    "SELECT * FROM nm_news WHERE slug = ? AND status = 'published' AND published_at <= UTC_TIMESTAMP()",
    [ctx.params.slug],
  );
  if (!r) throw notFound("Novinka nenájdená");
  return {
    post: {
      ...newsCard(r),
      content: parseJson(r.content, []),
      seoTitle: r.seo_title || null,
      seoDescription: r.seo_description || null,
    },
  };
});

// ───────────── Staff (public team page) ─────────────

get("/staff", { page: "staff" }, async () => {
  const tiers = await query("SELECT cat_key AS `key`, label FROM nm_staff_categories ORDER BY sort_order, id");
  // Only active + published members. E-mails, UUIDs and internal notes are never selected.
  const members = await query(
    `SELECT m.minecraft_name AS username, m.title AS role, m.category_key AS tier, m.bio, m.discord, m.avatar_url AS avatar
       FROM nm_staff_members m
       JOIN nm_staff_categories c ON c.cat_key = m.category_key
       LEFT JOIN nm_users u ON u.id = m.user_id
      WHERE m.visible = 1 AND (m.user_id IS NULL OR u.status = 'active')
      ORDER BY c.sort_order, m.sort_order, m.minecraft_name`,
  );
  return { tiers, members };
});

// ───────────── Store ─────────────

async function products(category) {
  const symbol = await currencySymbol();
  const rows = await query(
    "SELECT * FROM nm_store_products WHERE category = ? AND available = 1 ORDER BY sort_order, id",
    [category],
  );
  return rows.map((p) => ({
    ...parseJson(p.data, {}),
    key: p.product_key,
    name: p.name,
    price: money(symbol, p.price),
    priceValue: p.price,
  }));
}

get("/store/ranks", { page: "store" }, async () => ({ items: await products("rank") }));
get("/store/crate-keys", { page: "store" }, async () => ({ items: await products("crate") }));
get("/store/currency-packs", { page: "store" }, async () => ({ items: await products("currency") }));

get("/store/stats", { page: "store" }, async () => {
  const [row] = await query(
    "SELECT COALESCE(SUM(total), 0) AS raised, COUNT(DISTINCT user_id) AS donators FROM nm_store_orders WHERE status = 'paid'",
  );
  return { totalRaised: Number(row.raised), totalDonators: row.donators, currency: await currencySymbol() };
});

get("/store/monthly-goal", { page: "store" }, async () => {
  const cfg = await getSetting("store.monthly_goal", null); // { target, currency }
  if (!cfg || !(Number(cfg.target) > 0)) return { goal: null };
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const [row] = await query(
    "SELECT COALESCE(SUM(total), 0) AS current, COUNT(DISTINCT user_id) AS supporters FROM nm_store_orders WHERE status = 'paid' AND created_at >= ?",
    [start],
  );
  return {
    goal: {
      current: Number(row.current),
      target: Number(cfg.target),
      currency: cfg.currency || (await currencySymbol()),
      supporters: row.supporters,
      endsAt: end.toISOString(),
    },
  };
});

get("/store/top-donators", { page: "store" }, async (ctx) => {
  const period = ctx.query.period === "allTime" ? "allTime" : "monthly";
  const now = new Date();
  const since = period === "monthly" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : new Date(0);
  const rows = await query(
    `SELECT u.minecraft_name AS username, SUM(o.total) AS amount,
            (SELECT i.name FROM nm_store_order_items i
               JOIN nm_store_orders o2 ON o2.id = i.order_id AND o2.user_id = u.id AND o2.status = 'paid'
               JOIN nm_store_products p ON p.product_key = i.product_key AND p.category = 'rank'
              ORDER BY i.unit_price DESC LIMIT 1) AS tier
       FROM nm_store_orders o JOIN nm_users u ON u.id = o.user_id
      WHERE o.status = 'paid' AND o.created_at >= ?
      GROUP BY u.id, u.minecraft_name ORDER BY amount DESC, u.minecraft_name LIMIT 10`,
    [since],
  );
  return {
    items: rows.map((r, i) => ({ rank: i + 1, username: r.username, amount: Number(r.amount), tier: (r.tier || "").toUpperCase() })),
  };
});

const checkoutSchema = z.object({
  items: z.array(z.object({ key: z.string().max(64), qty: z.number().int().min(1).max(99) })).min(1).max(50),
});

// Prices are ALWAYS re-read from the database. No payment provider is wired up
// yet, so no order is created and nothing is ever reported as paid.
post("/store/checkout", { page: "store" }, async (ctx) => {
  const input = parseInput(checkoutSchema, ctx.body);
  const keys = [...new Set(input.items.map((i) => i.key))];
  const rows = await query("SELECT * FROM nm_store_products WHERE product_key IN (?) AND available = 1", [keys]);
  if (rows.length !== keys.length) throw new HttpError(400, "unknown_product", "Niektorý produkt už nie je dostupný.");
  const provider = process.env.PAYMENT_PROVIDER || null;
  throw new HttpError(
    501,
    provider ? "payment_provider_not_implemented" : "payments_not_configured",
    "Online platby zatiaľ nie sú na webe aktívne. Objednávka nebola vytvorená a nič nebolo účtované.",
  );
});

// ───────────── Votes ─────────────

get("/votes/sites", { page: "votes" }, async () => {
  const rows = await query("SELECT site_key AS id, name, href FROM nm_vote_sites WHERE enabled = 1 ORDER BY sort_order, name");
  return { items: rows };
});

get("/votes/rewards", { page: "votes" }, async () => ({ items: await getSetting("votes.rewards", []) }));

function periodStart(period) {
  const n = new Date();
  const day = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  if (period === "daily") return day;
  if (period === "weekly") {
    const dow = (day.getUTCDay() + 6) % 7; // Monday = 0
    return new Date(day.getTime() - dow * 86400_000);
  }
  if (period === "monthly") return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
  return new Date(0);
}

const PERIODS = ["daily", "weekly", "monthly", "allTime"];
const periodOf = (q) => (PERIODS.includes(q) ? q : "daily");

async function leaderboard(period, limit) {
  const rows = await query(
    `SELECT username, COUNT(*) AS votes FROM nm_votes WHERE voted_at >= ?
      GROUP BY username ORDER BY votes DESC, MIN(voted_at) ASC, username LIMIT ?`,
    [periodStart(period), limit],
  );
  return rows.map((r, i) => ({ rank: i + 1, username: r.username, votes: r.votes }));
}

get("/votes/leaderboard", { page: "votes" }, async (ctx) => ({ items: await leaderboard(periodOf(ctx.query.period), 10) }));

const TITLES = {
  daily: ["#1 Top Daily Voter", "Daily Hero", "Daily Star"],
  weekly: ["#1 Top Weekly Voter", "Weekly Hero", "Weekly Star"],
  monthly: ["#1 Top Monthly Voter", "Monthly Hero", "Monthly Star"],
  allTime: ["#1 Top Voter Ever", "All-Time Hero", "All-Time Star"],
};

get("/votes/wall-of-fame", { page: "votes" }, async (ctx) => {
  const period = periodOf(ctx.query.period);
  const top = await leaderboard(period, 3);
  return { items: top.map((r) => ({ ...r, title: TITLES[period][r.rank - 1] })) };
});

get("/votes/stats", { page: "votes" }, async () => {
  const count = async (since) => {
    const [r] = await query("SELECT COUNT(*) AS n FROM nm_votes WHERE voted_at >= ?", [since]);
    return r.n;
  };
  const [{ voters }] = await query("SELECT COUNT(DISTINCT username) AS voters FROM nm_votes");
  const week = await count(periodStart("weekly"));
  const target = Number(await getSetting("votes.weekly_goal", 0));
  const tomorrow = new Date(periodStart("daily").getTime() + 86400_000);
  return {
    totalVotes: await count(new Date(0)),
    totalVoters: voters,
    todayVotes: await count(periodStart("daily")),
    weekVotes: week,
    monthVotes: await count(periodStart("monthly")),
    weeklyGoal: target > 0 ? { current: week, target } : null,
    nextResetAt: tomorrow.toISOString(),
  };
});

get("/votes/search", { page: "votes" }, async (ctx) => {
  const q = String(ctx.query.q || "").trim().slice(0, 16);
  if (!/^[A-Za-z0-9_]{1,16}$/.test(q)) return { player: null };
  const row = await queryOne("SELECT username, COUNT(*) AS votes FROM nm_votes WHERE username = ? GROUP BY username", [q]);
  if (!row) return { player: null };
  const [{ ahead }] = await query(
    "SELECT COUNT(*) AS ahead FROM (SELECT username FROM nm_votes GROUP BY username HAVING COUNT(*) > ?) x",
    [row.votes],
  );
  return { player: { rank: ahead + 1, username: row.username, votes: row.votes } };
});
