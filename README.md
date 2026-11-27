# Rankvora Plus

Next.js (App Router) + React + TypeScript + Tailwind CSS 4, deployed to Cloudflare Workers with OpenNext.
The app is a frontend-only demo: demo data and simulated actions. There is no backend and no database; demo
changes are saved in the browser.

## Requirements

- Node.js 24+ (Node 26 LTS recommended, see `.nvmrc`)
- npm

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Script                | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Production build                             |
| `npm start`           | Run the production build                     |
| `npm run lint`        | Lint with ESLint                             |
| `npm run typecheck`   | Type check the web app and the Jobs Worker   |
| `npm run format`      | Format with Prettier                         |
| `npm test`            | Run the tests                                |
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

## Project structure

```
src/
  app/         routes and pages (website routes live under /stores/[storeId], shown to people as "Website")
  components/  shell, shared UI and charts
  features/    one folder per module: audit, fixes, monitoring, comparison, prompts, reports, settings, stores
  services/    read demo data for the pages
  demo/        demo records (consistent ids across modules)
  demo-state/  browser-side state for simulated actions
  lib/ types/  helpers and shared types
docs/          design-system.md, ui-screen-inventory.md, feature-ownership.md
```

The UI is frontend only: demo data, simulated actions, no real AI provider, CMS or scheduler calls. See
[docs/feature-ownership.md](docs/feature-ownership.md) for which screen owns which feature.

### Backend folders (structure only, no backend features yet)

Frontend and backend live in this one project, in separate folders. Each folder has a README with its rules,
and `npm run lint` fails on imports that cross the line.

```
src/server/     backend code
src/app/api/    API routes
src/domain/     rules shared by screens and backend
src/contracts/  data shapes shared by screens and backend
workers/jobs/   second Worker for background work (placeholder, not deployed)
migrations/     database changes
tests/          tests that sit outside src
```

Plan: [docs/backend/backend-plan.md](docs/backend/backend-plan.md), section 4.
