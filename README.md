# Rankvora Plus

Next.js (App Router) + React + TypeScript + Tailwind CSS 4, deployed to Cloudflare Workers with OpenNext.
The screens are still a demo: demo data, simulated actions, optional saving of demo state to Cloudflare D1.

A real backend on D1 is being built under `src/server` and `/api/v1`. In Phase 1, accounts,
organizations and team passed a live test against a test database; **websites and domains are not yet
tested**. It is not deployed, and the screens do not use it yet. Start with
[docs/backend/status.md](docs/backend/status.md); read
[docs/backend/runbook.md](docs/backend/runbook.md) before deploying it.

## Requirements

- Node.js 24+ (Node 26 LTS recommended, see `.nvmrc`)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The optional D1 health check is at <http://localhost:3000/api/health>
(it reports `binding_missing` until the local D1 tables exist, see [docs/d1-setup.md](docs/d1-setup.md)). The app works without it.

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
| `npm run test:d1`     | SQL tests against an in-memory local D1      |
| `npm run preview`     | Build for Cloudflare and run it locally      |
| `npm run deploy`      | Build for Cloudflare and deploy the Worker   |
| `npm run upload`      | Upload a new Worker version without deploying |

## Deploy to Cloudflare Workers

The app runs on Cloudflare **Workers** through the OpenNext adapter
(`@opennextjs/cloudflare`); Cloudflare Pages is not supported by the adapter.
Config lives in `wrangler.jsonc` (Worker name `rankvora-plus`) and
`open-next.config.ts`.

Cache Components are switched off for the Cloudflare build only (see
`next.config.ts`) because the adapter still has open bugs with them. Local
`npm run dev` and `npm run build` keep them on.

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

**Database (Cloudflare D1):** demo state is saved to a D1 database bound as `DB`
in `wrangler.jsonc`. The database `rankvora-plus` already exists in the Cloudflare account that
deploys this Worker and its real id is committed. Without a valid id the deploy fails
(`binding DB of type d1 must have a valid database_id`). Local setup, remote steps, backup and
data policy: [docs/d1-setup.md](docs/d1-setup.md).

## Tests

```bash
npm run test:unit   # pure logic, no database needed
npm run test:d1     # SQL tests against an in-memory local D1
npm test            # everything
```

## Project structure

```
src/
  app/         routes and pages (website routes live under /stores/[storeId], shown to people as "Website")
  components/  shell, shared UI and charts
  features/    one folder per module: audit, fixes, monitoring, comparison, prompts, reports, settings, stores
  services/    read demo data for the pages (the seam a future backend replaces)
  demo/        demo records (consistent ids across modules)
  demo-state/  browser-side state for simulated actions
  lib/ types/  helpers and shared types
  db-d1/       optional Cloudflare D1 saving of demo state (the UI works without it)
migrations/    D1 migrations (committed)
docs/          design-system.md, ui-screen-inventory.md, feature-ownership.md, d1-setup.md
```

The UI is frontend only: demo data, simulated actions, no real AI provider, CMS or scheduler calls. See
[docs/feature-ownership.md](docs/feature-ownership.md) for which screen owns which feature.
