// Importing the route modules registers their routes with the router.
import "./routes/site.js";
import "./routes/auth.js";
import "./routes/account.js";
import "./routes/plugin.js";
import "./routes/content.js";
import "./routes/tickets.js";
import "./routes/admin-users.js";
import "./routes/admin-tickets.js";
import "./routes/admin-content.js";
import "./routes/admin-system.js";

export { handleApi } from "./lib/http.js";
