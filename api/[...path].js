// Single Vercel Function that serves the whole API (keeps us far below the
// per-deployment function limit). Routing lives in server/lib/http.js.
import { handleApi } from "../server/index.js";

export const config = { maxDuration: 15 };

export default function handler(req, res) {
  return handleApi(req, res);
}
