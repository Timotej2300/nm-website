import { z } from "zod";
import { get, post, put, patch, del, parseInput, pageParams } from "../lib/http.js";
import { exec, query, queryOne } from "../lib/db.js";
import { audit } from "../lib/audit.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { normalizeUuid } from "../lib/config.js";
import { setSetting, getSetting } from "../lib/settings.js";
import { MC_NAME_RE } from "../../shared/permissions.js";

const idOf = (ctx) => {
  const id = Number.parseInt(ctx.params.id, 10);
  if (!Number.isInteger(id) || id < 1) throw badRequest("Neplatné ID");
  return id;
};

// Only https URLs or site-relative paths (blocks javascript:, data: ...).
const safeUrl = z
  .string()
  .trim()
  .max(500)
  .refine((u) => /^https:\/\/[^\s]+$/i.test(u) || /^\/[^\s/][^\s]*$/.test(u), "Povolené sú iba https:// odkazy alebo cesty začínajúce /");

// ───────────── Staff management ─────────────

const catKey = z.string().regex(/^[a-z][a-z0-9_]{1,30}$/);

get("/admin/staff", { perm: "staff.manage" }, async () => {
  const members = await query(
    `SELECT m.id, m.user_id AS userId, m.minecraft_name AS minecraftName, m.minecraft_uuid AS minecraftUuid,
            m.category_key AS categoryKey, m.title, m.bio, m.avatar_url AS avatarUrl, m.discord,
            m.sort_order AS sortOrder, m.visible, m.source, m.needs_review AS needsReview
       FROM nm_staff_members m JOIN nm_staff_categories c ON c.cat_key = m.category_key
      ORDER BY c.sort_order, m.sort_order, m.minecraft_name`,
  );
  const categories = await query(
    `SELECT c.id, c.cat_key AS \`key\`, c.label, c.sort_order AS sortOrder,
            (SELECT COUNT(*) FROM nm_staff_members m WHERE m.category_key = c.cat_key) AS members
       FROM nm_staff_categories c ORDER BY c.sort_order, c.id`,
  );
  return { members: members.map((m) => ({ ...m, visible: Boolean(m.visible), needsReview: Boolean(m.needsReview) })), categories };
});

const memberSchema = z.object({
  minecraftName: z.string().regex(MC_NAME_RE, "Neplatný Minecraft nick"),
  minecraftUuid: z.string().nullable().optional(),
  categoryKey: catKey,
  title: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(400).nullable().optional(),
  avatarUrl: safeUrl.nullable().optional().or(z.literal("")),
  discord: z.string().trim().max(64).regex(/^[A-Za-z0-9_.#@ -]*$/, "Neplatný Discord kontakt").nullable().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional().default(100),
  visible: z.boolean().optional().default(true),
});

async function memberValues(b) {
  if (!(await queryOne("SELECT 1 FROM nm_staff_categories WHERE cat_key = ?", [b.categoryKey]))) throw badRequest("Neznáma kategória");
  let uuid = null;
  if (b.minecraftUuid) {
    uuid = normalizeUuid(b.minecraftUuid);
    if (!uuid) throw badRequest("Neplatné UUID");
  }
  const user = await queryOne("SELECT id, minecraft_uuid FROM nm_users WHERE authme_username = ?", [b.minecraftName.toLowerCase()]);
  return { uuid: uuid || user?.minecraft_uuid || null, userId: user?.id ?? null };
}

post("/admin/staff", { perm: "staff.manage" }, async (ctx) => {
  const b = parseInput(memberSchema, ctx.body);
  const { uuid, userId } = await memberValues(b);
  if (userId && (await queryOne("SELECT 1 FROM nm_staff_members WHERE user_id = ?", [userId]))) throw conflict("Tento používateľ už v tíme je");
  const res = await exec(
    `INSERT INTO nm_staff_members (user_id, minecraft_name, minecraft_uuid, category_key, title, bio, avatar_url, discord, sort_order, visible, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
    [userId, b.minecraftName, uuid, b.categoryKey, b.title, b.bio || null, b.avatarUrl || null, b.discord || null, b.sortOrder, b.visible ? 1 : 0],
  );
  if (userId) await exec("DELETE FROM nm_staff_suppressions WHERE user_id = ?", [userId]);
  await audit(ctx, "staff.add", { targetType: "staff", targetId: res.insertId, summary: `Pridaný člen tímu ${b.minecraftName} (${b.categoryKey})` });
  ctx.status = 201;
  return { id: res.insertId };
});

patch("/admin/staff/:id", { perm: "staff.manage" }, async (ctx) => {
  const id = idOf(ctx);
  const row = await queryOne("SELECT * FROM nm_staff_members WHERE id = ?", [id]);
  if (!row) throw notFound();
  const b = parseInput(memberSchema, ctx.body);
  const { uuid } = await memberValues(b);
  // Editing a role-created entry turns it into a manual one so role syncs stop overwriting the edit.
  await exec(
    `UPDATE nm_staff_members SET minecraft_name = ?, minecraft_uuid = ?, category_key = ?, title = ?, bio = ?, avatar_url = ?,
            discord = ?, sort_order = ?, visible = ?, needs_review = 0, source = 'manual' WHERE id = ?`,
    [b.minecraftName, uuid, b.categoryKey, b.title, b.bio || null, b.avatarUrl || null, b.discord || null, b.sortOrder, b.visible ? 1 : 0, id],
  );
  await audit(ctx, "staff.update", { targetType: "staff", targetId: id, summary: `Upravený člen tímu ${b.minecraftName}${b.visible ? "" : " (skrytý)"}` });
  return { ok: true };
});

del("/admin/staff/:id", { perm: "staff.manage" }, async (ctx) => {
  const id = idOf(ctx);
  const row = await queryOne("SELECT * FROM nm_staff_members WHERE id = ?", [id]);
  if (!row) throw notFound();
  await exec("DELETE FROM nm_staff_members WHERE id = ?", [id]);
  // Roster entry only — the account, its roles and permissions are untouched.
  // Remember the decision so the next role sync does not silently re-create it.
  if (row.user_id) await exec("INSERT IGNORE INTO nm_staff_suppressions (user_id) VALUES (?)", [row.user_id]);
  await audit(ctx, "staff.remove", { targetType: "staff", targetId: id, summary: `Odstránený zo Staff: ${row.minecraft_name} (účet a oprávnenia ostali)` });
  return { ok: true };
});

post("/admin/staff/categories", { perm: "staff.manage" }, async (ctx) => {
  const b = parseInput(z.object({ key: catKey, label: z.string().trim().min(2).max(60), sortOrder: z.number().int().min(0).max(10000).optional().default(100) }), ctx.body);
  if (await queryOne("SELECT 1 FROM nm_staff_categories WHERE cat_key = ?", [b.key])) throw conflict("Kategória už existuje");
  await exec("INSERT INTO nm_staff_categories (cat_key, label, sort_order) VALUES (?, ?, ?)", [b.key, b.label, b.sortOrder]);
  await audit(ctx, "staff.category_add", { targetType: "staff_category", targetId: b.key, summary: `Kategória ${b.label}` });
  ctx.status = 201;
  return { ok: true };
});

patch("/admin/staff/categories/:key", { perm: "staff.manage" }, async (ctx) => {
  const b = parseInput(z.object({ label: z.string().trim().min(2).max(60), sortOrder: z.number().int().min(0).max(10000) }), ctx.body);
  const r = await exec("UPDATE nm_staff_categories SET label = ?, sort_order = ? WHERE cat_key = ?", [b.label, b.sortOrder, ctx.params.key]);
  if (!r.affectedRows) throw notFound();
  await audit(ctx, "staff.category_update", { targetType: "staff_category", targetId: ctx.params.key, summary: `Kategória ${b.label}` });
  return { ok: true };
});

del("/admin/staff/categories/:key", { perm: "staff.manage" }, async (ctx) => {
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM nm_staff_members WHERE category_key = ?", [ctx.params.key]);
  const [{ r }] = await query("SELECT COUNT(*) AS r FROM nm_roles WHERE staff_category_key = ?", [ctx.params.key]);
  if (n || r) throw conflict("Kategória sa používa (členovia alebo roly).", "category_in_use");
  await exec("DELETE FROM nm_staff_categories WHERE cat_key = ?", [ctx.params.key]);
  await audit(ctx, "staff.category_delete", { targetType: "staff_category", targetId: ctx.params.key, summary: "Zmazaná kategória" });
  return { ok: true };
});

// ───────────── News management ─────────────

const block = z.union([
  z.object({ type: z.enum(["p", "h2"]), text: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("list"), items: z.array(z.string().trim().min(1).max(500)).min(1).max(30) }),
]);

const newsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional(),
  title: z.string().trim().min(3).max(200),
  excerpt: z.string().trim().max(500).nullable().optional(),
  image: safeUrl.nullable().optional().or(z.literal("")),
  category: z.string().trim().max(40).nullable().optional(),
  tone: z.string().regex(/^(var\(--color-[a-z]+\)|#[0-9a-fA-F]{3,8})$/).nullable().optional().or(z.literal("")),
  author: z.string().trim().max(80).nullable().optional(),
  content: z.array(block).min(1).max(80),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().datetime().nullable().optional(),
  seoTitle: z.string().trim().max(120).nullable().optional(),
  seoDescription: z.string().trim().max(300).nullable().optional(),
});

const slugify = (t) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "novinka";

const newsOut = (r) => ({
  id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt, image: r.image, category: r.category, tone: r.tone,
  author: r.author, status: r.status, publishedAt: r.published_at, seoTitle: r.seo_title, seoDescription: r.seo_description,
  updatedAt: r.updated_at,
});

get("/admin/news", { perm: "news.manage" }, async (ctx) => {
  const { page, size, offset } = pageParams(ctx.query);
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM nm_news");
  const rows = await query("SELECT * FROM nm_news ORDER BY COALESCE(published_at, created_at) DESC, id DESC LIMIT ? OFFSET ?", [size, offset]);
  return { total: n, page, size, items: rows.map(newsOut) };
});

get("/admin/news/:id", { perm: "news.manage" }, async (ctx) => {
  const r = await queryOne("SELECT * FROM nm_news WHERE id = ?", [idOf(ctx)]);
  if (!r) throw notFound();
  let content = [];
  try { content = JSON.parse(r.content); } catch { /* keep empty */ }
  return { post: { ...newsOut(r), content } };
});

async function uniqueSlug(base, exceptId = 0) {
  let slug = base;
  for (let i = 2; await queryOne("SELECT 1 FROM nm_news WHERE slug = ? AND id <> ?", [slug, exceptId]); i++) slug = `${base}-${i}`;
  return slug;
}

post("/admin/news", { perm: "news.manage", maxBody: 400 * 1024 }, async (ctx) => {
  const b = parseInput(newsSchema, ctx.body);
  const slug = await uniqueSlug(b.slug || slugify(b.title));
  const published = b.status === "published" ? (b.publishedAt ? new Date(b.publishedAt) : new Date()) : null;
  const res = await exec(
    `INSERT INTO nm_news (slug, title, excerpt, image, category, tone, author, content, status, published_at, seo_title, seo_description, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [slug, b.title, b.excerpt || null, b.image || null, b.category || null, b.tone || null, b.author || ctx.user.name, JSON.stringify(b.content), b.status, published, b.seoTitle || null, b.seoDescription || null, ctx.user.id, ctx.user.id],
  );
  await audit(ctx, "news.create", { targetType: "news", targetId: res.insertId, summary: `Novinka „${b.title}“ (${b.status})` });
  ctx.status = 201;
  return { id: res.insertId, slug };
});

put("/admin/news/:id", { perm: "news.manage", maxBody: 400 * 1024 }, async (ctx) => {
  const id = idOf(ctx);
  const old = await queryOne("SELECT * FROM nm_news WHERE id = ?", [id]);
  if (!old) throw notFound();
  const b = parseInput(newsSchema, ctx.body);
  const slug = await uniqueSlug(b.slug || old.slug, id);
  let published = null;
  if (b.status === "published") published = b.publishedAt ? new Date(b.publishedAt) : old.published_at || new Date();
  await exec(
    `UPDATE nm_news SET slug = ?, title = ?, excerpt = ?, image = ?, category = ?, tone = ?, author = ?, content = ?, status = ?,
            published_at = ?, seo_title = ?, seo_description = ?, updated_by = ? WHERE id = ?`,
    [slug, b.title, b.excerpt || null, b.image || null, b.category || null, b.tone || null, b.author || old.author, JSON.stringify(b.content), b.status, published, b.seoTitle || null, b.seoDescription || null, ctx.user.id, id],
  );
  await audit(ctx, "news.update", { targetType: "news", targetId: id, summary: `Upravená novinka „${b.title}“ (${b.status})` });
  return { ok: true, slug };
});

del("/admin/news/:id", { perm: "news.manage" }, async (ctx) => {
  if (ctx.query.confirm !== "yes") throw badRequest("Vyžaduje sa potvrdenie (confirm=yes)", "confirm_required");
  const id = idOf(ctx);
  const old = await queryOne("SELECT title FROM nm_news WHERE id = ?", [id]);
  if (!old) throw notFound();
  await exec("DELETE FROM nm_news WHERE id = ?", [id]);
  await audit(ctx, "news.delete", { targetType: "news", targetId: id, summary: `Zmazaná novinka „${old.title}“` });
  return { ok: true };
});

// ───────────── Store management ─────────────

const productSchema = z.object({
  category: z.enum(["rank", "crate", "currency"]),
  name: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(100000),
  available: z.boolean(),
  sortOrder: z.number().int().min(0).max(100000).optional().default(100),
  data: z.record(z.string(), z.unknown()).optional().default({}),
});

function productData(data) {
  const d = { ...data };
  delete d.key; delete d.name; delete d.price; delete d.priceValue;
  const text = JSON.stringify(d);
  if (text.length > 20000) throw badRequest("Dáta produktu sú príliš veľké");
  return text;
}

const productOut = (p) => {
  let data = {};
  try { data = JSON.parse(p.data || "{}"); } catch { /* ignore */ }
  return { id: p.id, key: p.product_key, category: p.category, name: p.name, price: p.price, available: Boolean(p.available), sortOrder: p.sort_order, data, updatedAt: p.updated_at };
};

get("/admin/store/products", { perm: "store.manage" }, async () => ({
  items: (await query("SELECT * FROM nm_store_products ORDER BY category, sort_order, id")).map(productOut),
}));

post("/admin/store/products", { perm: "store.manage" }, async (ctx) => {
  const key = String(ctx.body?.key || "");
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(key)) throw badRequest("Kľúč produktu: malé písmená, číslice, - a _");
  const b = parseInput(productSchema, ctx.body);
  if (await queryOne("SELECT 1 FROM nm_store_products WHERE product_key = ?", [key])) throw conflict("Produkt s týmto kľúčom už existuje");
  const res = await exec(
    "INSERT INTO nm_store_products (product_key, category, name, price, available, sort_order, data, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [key, b.category, b.name, b.price, b.available ? 1 : 0, b.sortOrder, productData(b.data), ctx.user.id],
  );
  await audit(ctx, "store.product_create", { targetType: "product", targetId: key, summary: `Produkt ${b.name} (${b.price})` });
  ctx.status = 201;
  return { id: res.insertId };
});

patch("/admin/store/products/:id", { perm: "store.manage" }, async (ctx) => {
  const id = idOf(ctx);
  const old = await queryOne("SELECT * FROM nm_store_products WHERE id = ?", [id]);
  if (!old) throw notFound();
  const b = parseInput(productSchema, ctx.body);
  await exec(
    "UPDATE nm_store_products SET category = ?, name = ?, price = ?, available = ?, sort_order = ?, data = ?, updated_by = ? WHERE id = ?",
    [b.category, b.name, b.price, b.available ? 1 : 0, b.sortOrder, productData(b.data), ctx.user.id, id],
  );
  await audit(ctx, "store.product_update", { targetType: "product", targetId: old.product_key, summary: `Produkt ${b.name}: cena ${old.price} → ${b.price}, ${b.available ? "dostupný" : "nedostupný"}` });
  return { ok: true };
});

del("/admin/store/products/:id", { perm: "store.manage" }, async (ctx) => {
  const id = idOf(ctx);
  const old = await queryOne("SELECT product_key, name FROM nm_store_products WHERE id = ?", [id]);
  if (!old) throw notFound();
  await exec("DELETE FROM nm_store_products WHERE id = ?", [id]);
  await audit(ctx, "store.product_delete", { targetType: "product", targetId: old.product_key, summary: `Zmazaný produkt ${old.name}` });
  return { ok: true };
});

get("/admin/store/orders", { perm: "store.manage" }, async (ctx) => {
  const { page, size, offset } = pageParams(ctx.query);
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM nm_store_orders");
  const rows = await query(
    `SELECT o.id, o.status, o.total, o.currency, o.provider, o.created_at AS createdAt, u.minecraft_name AS player
       FROM nm_store_orders o JOIN nm_users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT ? OFFSET ?`,
    [size, offset],
  );
  return { total: n, page, size, items: rows };
});

get("/admin/store/status", { perm: "store.manage" }, async () => {
  const [o] = await query("SELECT COUNT(*) AS orders, SUM(status = 'paid') AS paid, SUM(status = 'pending_payment') AS pending FROM nm_store_orders");
  const goal = await getSetting("store.monthly_goal", null);
  return {
    paymentProvider: process.env.PAYMENT_PROVIDER || null,
    paymentsActive: false,
    note: "Platobná brána zatiaľ nie je napojená — checkout nevytvára objednávky ani nič nepredstiera. Pozri docs/DEPLOY.md.",
    orders: o.orders,
    paid: Number(o.paid || 0),
    pending: Number(o.pending || 0),
    monthlyGoal: goal,
    currencySymbol: await getSetting("store.currency_symbol", "$"),
  };
});

put("/admin/store/settings", { perm: "store.manage" }, async (ctx) => {
  const b = parseInput(
    z.object({
      currencySymbol: z.string().trim().min(1).max(4),
      monthlyGoalTarget: z.number().min(0).max(10_000_000),
      monthlyGoalCurrency: z.string().trim().max(4).optional(),
    }),
    ctx.body,
  );
  await setSetting("store.currency_symbol", b.currencySymbol, ctx.user.id);
  await setSetting("store.monthly_goal", b.monthlyGoalTarget > 0 ? { target: b.monthlyGoalTarget, currency: b.monthlyGoalCurrency || b.currencySymbol } : null, ctx.user.id);
  await audit(ctx, "store.settings", { targetType: "settings", summary: `Mena ${b.currencySymbol}, mesačný cieľ ${b.monthlyGoalTarget}` });
  return { ok: true };
});

// ───────────── Votes management ─────────────

const siteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  href: z.string().trim().max(500).refine((u) => u === "#" || /^https:\/\/[^\s]+$/i.test(u), "Povolené je # alebo https:// odkaz"),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000).optional().default(100),
});

get("/admin/votes", { perm: "votes.manage" }, async () => {
  const sites = await query("SELECT site_key AS `key`, name, href, enabled, sort_order AS sortOrder FROM nm_vote_sites ORDER BY sort_order, name");
  const [t] = await query("SELECT COUNT(*) AS total, MAX(voted_at) AS lastVote FROM nm_votes");
  return {
    sites: sites.map((s) => ({ ...s, enabled: Boolean(s.enabled) })),
    rewards: await getSetting("votes.rewards", []),
    weeklyGoal: Number(await getSetting("votes.weekly_goal", 0)),
    recorded: { total: t.total, lastVote: t.lastVote },
    listenerConfigured: Boolean(process.env.PLUGIN_API_SECRET),
    note: "Hlasy zapisuje Votifier listener cez /api/plugin/vote. Web sám hlas nijako neoveruje ani nepredstiera.",
  };
});

post("/admin/votes/sites", { perm: "votes.manage" }, async (ctx) => {
  const key = String(ctx.body?.key || "");
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(key)) throw badRequest("Kľúč: malé písmená, číslice, - a _");
  const b = parseInput(siteSchema, ctx.body);
  if (await queryOne("SELECT 1 FROM nm_vote_sites WHERE site_key = ?", [key])) throw conflict("Služba už existuje");
  await exec("INSERT INTO nm_vote_sites (site_key, name, href, enabled, sort_order, updated_by) VALUES (?, ?, ?, ?, ?, ?)", [key, b.name, b.href, b.enabled ? 1 : 0, b.sortOrder, ctx.user.id]);
  await audit(ctx, "votes.site_create", { targetType: "vote_site", targetId: key, summary: b.name });
  ctx.status = 201;
  return { ok: true };
});

patch("/admin/votes/sites/:key", { perm: "votes.manage" }, async (ctx) => {
  const b = parseInput(siteSchema, ctx.body);
  const r = await exec("UPDATE nm_vote_sites SET name = ?, href = ?, enabled = ?, sort_order = ?, updated_by = ? WHERE site_key = ?", [b.name, b.href, b.enabled ? 1 : 0, b.sortOrder, ctx.user.id, ctx.params.key]);
  if (!r.affectedRows) throw notFound();
  await audit(ctx, "votes.site_update", { targetType: "vote_site", targetId: ctx.params.key, summary: `${b.name} ${b.enabled ? "zapnuté" : "vypnuté"}` });
  return { ok: true };
});

del("/admin/votes/sites/:key", { perm: "votes.manage" }, async (ctx) => {
  const r = await exec("DELETE FROM nm_vote_sites WHERE site_key = ?", [ctx.params.key]);
  if (!r.affectedRows) throw notFound();
  await audit(ctx, "votes.site_delete", { targetType: "vote_site", targetId: ctx.params.key, summary: "Zmazaná hlasovacia služba" });
  return { ok: true };
});

put("/admin/votes/rewards", { perm: "votes.manage" }, async (ctx) => {
  const b = parseInput(
    z.object({
      rewards: z.array(z.object({ votes: z.number().int().min(1).max(100000), label: z.string().trim().min(1).max(60), reward: z.string().trim().min(1).max(300) })).max(30),
      weeklyGoal: z.number().int().min(0).max(10_000_000),
    }),
    ctx.body,
  );
  await setSetting("votes.rewards", b.rewards, ctx.user.id);
  await setSetting("votes.weekly_goal", b.weeklyGoal, ctx.user.id);
  await audit(ctx, "votes.rewards_update", { targetType: "settings", summary: `Odmeny (${b.rewards.length}), týždenný cieľ ${b.weeklyGoal}` });
  return { ok: true };
});
