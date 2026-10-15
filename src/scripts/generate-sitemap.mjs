// Generates public/sitemap.xml from the app's known routes.
// Plain Node (fs only, no npm packages), fully self-contained — it does
// NOT import anything from src/, so this is the only file that needs to
// exist for `npm run sitemap` to work.
import { writeFileSync, mkdirSync } from "node:fs";

// TODO: replace with your real production domain.
const SITE_URL = "https://www.bdzone.net";

const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/news", changefreq: "daily", priority: "0.8" },
  { path: "/votes", changefreq: "weekly", priority: "0.7" },
  { path: "/store", changefreq: "weekly", priority: "0.7" },
  { path: "/staff", changefreq: "monthly", priority: "0.5" },
];

// Keep this list in sync with the slugs in src/data/news.js.
const newsRoutes = [
  { path: "/news/survival-season-18-recap", lastmod: "2026-01-20" },
  { path: "/news/ramadan-iftar-community-event", lastmod: "2026-03-02" },
  { path: "/news/season-18-leaderboards-final-results", lastmod: "2026-01-16" },
  { path: "/news/server-launch", lastmod: "2021-07-05" },
].map((r) => ({ ...r, changefreq: "monthly", priority: "0.6" }));

const urls = [...staticRoutes, ...newsRoutes];

const body = urls
  .map((route) => {
    const lastmodTag = route.lastmod
      ? `\n    <lastmod>${route.lastmod}</lastmod>`
      : "";
    return `  <url>
    <loc>${SITE_URL}${route.path}</loc>${lastmodTag}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

mkdirSync("public", { recursive: true });
writeFileSync("public/sitemap.xml", xml, "utf-8");
console.log(`sitemap.xml written with ${urls.length} URLs -> public/sitemap.xml`);
