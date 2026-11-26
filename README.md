# Rankvora Plus

Next.js (App Router) + React + TypeScript + Tailwind CSS 4, deployed to Cloudflare Workers with OpenNext.
There is no demo or sample data. The screens show only what the API returns for the signed-in
organization; features without a backend show "Not available yet".

> **Live site:** pushing `main` deploys it. The live backend is not set up yet, so until it is, the
> live site shows only "Accounts are not set up on this server yet" (steps:
> [docs/backend/runbook.md](docs/backend/runbook.md)).

The backend on D1 lives in `src/server` and `/api/v1`. Phase 1 (accounts, organizations, team,
websites and domains) and Phase 2 (brand knowledge, competitors, products and the prompt library)
passed live tests against a test database, **except a successful DNS ownership check, which is still
waiting for its DNS record**. The screens use it for accounts and websites; website settings and the
prompt library are connected next. Start with [docs/backend/status.md](docs/backend/status.md).

## Requirements

- Node.js 24+ (Node 26 LTS recommended, see `.nvmrc`)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Signing in needs the backend settings in `.dev.vars` (see
[.dev.vars.example](.dev.vars.example)) and the database tables ([docs/backend/runbook.md](docs/backend/runbook.md)).

## Scripts

| Script                | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Production build                             |
| `npm start`           | Run the production build                     |
| `npm run lint`        | Lint with ESLint                             |
| `npm run format`      | Format with Prettier                         |
| `npm run db:d1:migrate:local` | Create the local D1 tables (see docs/d1-setup.md) |
| `npm run db:d1:generate` | Generate a D1 migration from `src/db-d1/schema.ts` |
| `npm run preview`     | Build for Cloudflare and run it locally      |
| `npm run deploy`      | Build for Cloudflare and deploy the Worker   |
| `npm run upload`      | Upload a new Worker version without deploying |

## Deploy to Cloudflare Workers

The app runs on Cloudflare **Workers** through the OpenNext adapter
(`@opennextjs/cloudflare`); Cloudflare Pages is not supported by the adapter.
Config lives in `wrangler.jsonc` (Worker name `rankvora-plus`) and
`open-next.config.ts`.

Cache Components are switched off (see `next.config.ts`).

**Git-connected deploy (Workers Builds):** in the Cloudflare dashboard go to
Workers & Pages, Create, import the GitHub repository, and use:

| Setting        | Value                                 |
| -------------- | ------------------------------------- |
| Build command  | `npx opennextjs-cloudflare build`     |
| Deploy command | `npx opennextjs-cloudflare deploy`    |
| Preview command | `npx opennextjs-cloudflare upload`   |

The Worker name in the dashboard must be `rankvora-plus` (the `name` in
`wrangler.jsonc`). Workers Builds sets `WORKERS_CI=1`, which selects the
Cloudflare build. If the build image cannot provide the Node version in
`.nvmrc`, set the build variable `NODE_VERSION` to `24`.

**From your machine:** run `npx wrangler login` once, then `npm run deploy`.

**Database (Cloudflare D1):** the app uses a D1 database bound as `DB`
in `wrangler.jsonc`. The database `rankvora-plus` already exists in the Cloudflare account that
deploys this Worker and its real id is committed. Without a valid id the deploy fails
(`binding DB of type d1 must have a valid database_id`). Local setup, remote steps, backup and
data policy: [docs/backend/runbook.md](docs/backend/runbook.md).

## Tests

```bash
npm test            # pure logic, no database needed
```

## Project structure

```
src/
  app/         routes: account pages, websites (under /stores/[storeId], shown as "Website") and /api/v1
  features/    screens: auth, session, websites
  server/      the backend: database schema, modules and API handlers
  components/  shell, shared UI and charts
  lib/ types/  helpers and shared types
  db-d1/       D1 binding helpers and the unused table of the former demo (kept for migration history)
migrations/    D1 migrations (committed)
design-archive/ earlier screen designs, switched off until their backend exists
docs/          backend/, design-system.md, ui-screen-inventory.md
```
