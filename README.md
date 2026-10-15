# BDZONE — Minecraft Survival Server Website

A complete, standalone website for a Minecraft survival server community — a pixel-art homepage, a donation store, a voting hub, a staff roster, a news blog, a cart, and Microsoft/Xbox sign-in, all built and wired together as a single React SPA.

**🔗 Live demo:** https://minecraft-01.vercel.app/

## Features

- **Pixel-art hero** with a layered, animated parallax background and a one-tap "copy server IP" button (clipboard API with a legacy fallback)
- **Store** — overview stats plus tabbed Ranks, Crates, Currency Packs, and Top Donators
- **Vote hub** — voting sites list, rewards, leaderboards, wall of fame, and player search
- **Staff page** — tiered roster (Owner, Admin, Moderator, Helper) with Discord links and online status
- **News** — homepage teaser, full listing page, and single-post detail pages
- **Cart** with a live item-count badge in the header, via a shared cart context
- **Sign-in** with a Microsoft/Xbox-style flow (currently mocked — see [Auth](#auth) below)
- **Custom pixel-bordered UI kit** — `PixelBox`, `PixelButton`, `PixelPanel` with reusable tone variants
- **Config-driven content** — nav links, game modes, "why play" reasons, staff, and footer columns all come from a single data file per section, so re-skinning for another server is mostly a data/asset swap, not a component rewrite
- **Per-page SEO** — dynamic titles, meta descriptions, canonical URLs, and Open Graph/Twitter tags via a small dependency-free `useSeo` hook
- **Auto-generated `sitemap.xml`** on every build
- Fully responsive, with a mobile slide-out nav

## Tech Stack

- [React 19](https://react.dev/)
- [React Router 7](https://reactrouter.com/)
- [Tailwind CSS 4](https://tailwindcss.com/) (via `@tailwindcss/vite`)
- [Lucide React](https://lucide.dev/) for icons
- [Vite 8](https://vitejs.dev/) for dev server and build

No backend, database, or CMS is required to run the front end — store, vote, and auth data are currently mock data, ready to be swapped for real API calls.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (bundled with Node.js)

### Installation

```bash
git clone https://github.com/Tasin-Hossain/Minecraft-01.git
cd Minecraft-01
npm install
```

### Development

```bash
npm run dev
```

Starts the Vite dev server with hot module reloading.

### Build

```bash
npm run build
```

Runs `sitemap` automatically (via `prebuild`) to regenerate `public/sitemap.xml`, then builds the production bundle with Vite.

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Project Structure

```
src/
├── assets/          # Images, animated sprites, logos, icons
├── components/
│   ├── Header/      # Nav bar, mobile menu, logo
│   ├── Footer/       # Site footer with link columns
│   ├── landing/      # Homepage sections (Hero, GameModes, WhyPlayBdZone, LatestNews, HowToJoin)
│   ├── store/        # Store tabs (Ranks, Crates, Currency, Top Donators)
│   ├── vote/         # Vote tabs (Voting Sites, Rewards, Leaderboards, Wall of Fame)
│   └── ui/           # Shared pixel-art UI kit (PixelBox, PixelButton, PixelPanel, PlayButton)
├── config/          # Site-wide SEO config (site name, URL, default meta)
├── context/          # Auth and cart context/providers
├── data/            # Mock data + "API layer" for store, votes, news, staff
├── hooks/            # useSeo — per-page meta tag management
├── layouts/          # RootLayout (Header + Outlet + Footer)
├── pages/            # Route-level pages (Home, Store, Votes, Staff, News, Cart, Login)
├── router/           # React Router route definitions
├── scripts/          # generate-sitemap.mjs — build-time sitemap generator
└── styles/           # Fonts, hero background CSS, CSS custom properties
```

## Auth

Sign-in currently simulates a Microsoft OAuth round trip (see `src/context/AuthProvider.jsx`) so the UI and flow can be built and tested without a live Azure App Registration. To wire up real authentication, replace the body of `signInWithMicrosoft` with the [`@azure/msal-browser`](https://www.npmjs.com/package/@azure/msal-browser) popup/redirect flow — no other part of the app needs to change.

## Data Layer

Files under `src/data/` (`store.js`, `votes.js`, `news.js`, `staff.js`) export `fetchX()`-style functions that resolve from local mock data after a simulated network delay. They're written to match the shape of a real API call, so swapping the function body for a real `fetch("/api/...")` request doesn't require touching any component.

## Deployment

The project builds to static files (`dist/`) and can be deployed to any static host — [Vercel](https://vercel.com/), [Netlify](https://www.netlify.com/), or your own server. The live demo is hosted on Vercel.

## License

Add your license of choice here (e.g. MIT) before publishing, or remove this section if the project is closed-source.

## Contact

For questions or support, open an issue on this repository or reach out via Discord.
"# nm-website" 
