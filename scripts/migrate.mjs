// Applies migrations/*.sql in order, once each. Never drops or rewrites data.
//   DATABASE_URL=mysql://... node scripts/migrate.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(uri = process.env.DATABASE_URL, log = console.log) {
  if (!uri) throw new Error("DATABASE_URL is not set");
  const conn = await mysql.createConnection({ uri, multipleStatements: true, charset: "utf8mb4" });
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS nm_migrations (
      name VARCHAR(100) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [done] = await conn.query("SELECT name, checksum FROM nm_migrations");
    const applied = new Map(done.map((r) => [r.name, r.checksum]));
    const files = fs.readdirSync(dir).filter((f) => /^\d+.*\.sql$/.test(f)).sort();
    let ran = 0;
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      const sum = crypto.createHash("sha256").update(sql).digest("hex");
      if (applied.has(f)) {
        if (applied.get(f) !== sum) log(`! ${f} changed after it was applied — ignored (add a new migration instead)`);
        continue;
      }
      await conn.query(sql);
      await conn.query("INSERT INTO nm_migrations (name, checksum) VALUES (?, ?)", [f, sum]);
      log(`✓ applied ${f}`);
      ran++;
    }
    if (!ran) log("Database is up to date.");
    return ran;
  } finally {
    await conn.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate().catch((e) => {
    console.error("Migration failed:", e.message);
    process.exit(1);
  });
}
