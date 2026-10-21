# Deployment guide (Vercel + domain + database)

## 1. Database
Use a MariaDB/MySQL instance reachable from Vercel (managed provider, or your own host with TLS and a firewall rule).
Create an empty database and a user with full rights on it only. Set `DATABASE_URL`.
Run once from your machine (or CI) with the production URL in the environment:
```
npm ci
npm run migrate   # applies migrations/001-004, tracked in nm_migrations (checksummed)
npm run seed      # one-time: copies the original news/store/votes content; never overwrites existing rows
```
Never run migrations from the web app; re-run `npm run migrate` after pulling new code.

## 2. AuthMe (Minecraft login)
Pick one mode:
- **Direct**: create a **read-only** MySQL user for the `authme` table and set `AUTHME_DATABASE_URL` (+ `AUTHME_TABLE`). Restrict it to Vercel egress or use TLS + strong password.
- **Bridge** (recommended when the MC DB must stay private): run `bridge/authme-bridge.mjs` next to the MC server (read-only DB user on localhost), expose it through HTTPS, then set `AUTHME_BRIDGE_URL` and the same `AUTHME_BRIDGE_SECRET` on both sides.
Supported hashes: SHA256 (`$SHA$`), BCRYPT, ARGON2, PBKDF2 (best effort). Unknown formats fail closed. AuthMe data is never written.

## 3. Vercel
1. Import the repo; framework preset **Vite**. `vercel.json` already routes `/api/*` to the function and everything else to the SPA.
2. Add the variables from `.env.example` (Production and Preview). Mark all secrets *Sensitive*. Minimum: `DATABASE_URL`, `APP_SECRET`, `SITE_URL`, `OWNER_MINECRAFT_UUID`, one AuthMe mode.
3. Deploy. Then add the domain (Project → Domains) `ninjamelon.cz` and follow the DNS instructions; HTTPS is automatic. Cookies use the `__Host-` prefix and `Secure` in production, so the site must be served over HTTPS on a single host.
4. Check Admin → **Bezpečnosť a systém** — every row should be green (SMTP, plugin key, Discord are optional).

## 4. First owner
1. Set `OWNER_MINECRAFT_UUID` (X4yl0n's UUID).
2. Sign in with the Minecraft nick + AuthMe password.
3. In-game run `/web link` (plugin per `docs/PLUGIN_SPEC.md`), enter the code in Účet. If the UUID matches, the Owner role is granted. There is no backdoor and no nick-only owner.
4. Create other roles/users in `/admin`. Admins cannot change the Owner or grant rights above their own priority.

## 5. Not implemented / needs your input
- **Payments**: no gateway is connected. Checkout answers “not active” and creates no order. Integrate a provider, then set `PAYMENT_PROVIDER`.
- **Plugin side** (`/web link`, Votifier listener): only the web API exists — see `docs/PLUGIN_SPEC.md`.
- **SMTP**: required for e-mail linking/reset. Without `SMTP_URL` these features report that mail is not configured.
- Online status of staff is not shown (no live server link).

## 6. Local development
```
cp .env.example .env   # fill DATABASE_URL, APP_SECRET, OWNER_MINECRAFT_UUID, AuthMe mode
npm run migrate && npm run seed
npm run dev:api        # API on :3001
npm run dev            # Vite on :5173, proxies /api
npm test               # needs a MariaDB test server (TEST_DB_BASE, default mysql://nm:nmpass@127.0.0.1:3307)
```
