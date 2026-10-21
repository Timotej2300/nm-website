// Local API server (same handler Vercel runs). Vite proxies /api to it.
//   DATABASE_URL=... node scripts/dev-server.mjs
import http from "node:http";
import { handleApi } from "../server/index.js";

const port = Number(process.env.API_PORT || 3001);
http.createServer((req, res) => handleApi(req, res)).listen(port, () => console.log(`API on http://localhost:${port}`));
