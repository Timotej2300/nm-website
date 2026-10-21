// Imports the EXISTING site content (news posts, store products, vote sites and
// vote rewards from the original mock data) into the database. Idempotent:
// rows that already exist are left untouched, so it can never overwrite edits.
// It deliberately does NOT import mock staff, leaderboards, donators or stats.
//   DATABASE_URL=mysql://... node scripts/seed-content.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server", "seed");
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

export async function seedContent(uri = process.env.DATABASE_URL, log = console.log) {
  if (!uri) throw new Error("DATABASE_URL is not set");
  const conn = await mysql.createConnection({ uri, charset: "utf8mb4" });
  try {
    await conn.query("SET time_zone = '+00:00'");
    // news
    let n = 0;
    for (const p of read("news.json")) {
      const published = new Date(`${p.date} UTC`);
      const [r] = await conn.query(
        `INSERT IGNORE INTO nm_news (slug, title, excerpt, image, category, tone, author, content, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`,
        [p.slug, p.title, p.excerpt, p.image, p.category, p.tone, p.author, JSON.stringify(p.content), Number.isNaN(+published) ? new Date() : published],
      );
      n += r.affectedRows;
    }
    log(`news: ${n} new`);
    // store
    const store = read("store.json");
    let sp = 0;
    const put = async (category, items) => {
      let i = 0;
      for (const it of items) {
        const { key, name, price, ...rest } = it;
        const [r] = await conn.query(
          "INSERT IGNORE INTO nm_store_products (product_key, category, name, price, available, sort_order, data) VALUES (?, ?, ?, ?, 1, ?, ?)",
          [key, category, name, Number(String(price).replace(/[^0-9.]/g, "")), (++i) * 10, JSON.stringify(rest)],
        );
        sp += r.affectedRows;
      }
    };
    await put("rank", store.ranks);
    await put("crate", store.crates);
    await put("currency", store.currency);
    log(`store products: ${sp} new`);
    // votes
    let vs = 0;
    let i = 0;
    for (const s of read("vote-sites.json")) {
      const [r] = await conn.query("INSERT IGNORE INTO nm_vote_sites (site_key, name, href, enabled, sort_order) VALUES (?, ?, ?, 1, ?)", [s.id, s.name, s.href, (++i) * 10]);
      vs += r.affectedRows;
    }
    log(`vote sites: ${vs} new`);
    await conn.query("INSERT IGNORE INTO nm_site_settings (k, v) VALUES ('votes.rewards', ?)", [JSON.stringify(read("vote-rewards.json"))]);
  } finally {
    await conn.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedContent().catch((e) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
  });
}
