# Rankvora Plus

Next.js (App Router) + TypeScript + Tailwind CSS 4 + PostgreSQL + Drizzle ORM.

## Requirements

- Node.js 24+ (Node 26 LTS recommended, see `.nvmrc`)
- npm
- A locally installed PostgreSQL server (no Docker needed)

## Run locally

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your env file**

   ```bash
   cp .env.example .env.local
   ```

   Open `.env.local` and set `DATABASE_URL` to your local PostgreSQL:

   ```
   DATABASE_URL=postgresql://<user>:<password>@localhost:5432/rankvora_plus
   ```

3. **Create the database** (once). With PostgreSQL running locally, use psql or pgAdmin:

   ```bash
   psql -U postgres -c "CREATE DATABASE rankvora_plus;"
   ```

4. **Run migrations**

   ```bash
   npm run db:migrate
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

6. **Test the health route** at <http://localhost:3000/api/health>. It should return:

   ```json
   { "status": "ok", "db": "connected" }
   ```

## Scripts

| Script                | What it does                                 |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Production build                             |
| `npm start`           | Run the production build                     |
| `npm run lint`        | Lint with ESLint                             |
| `npm run format`      | Format with Prettier                         |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations                             |
| `npm run db:push`     | Push the schema directly (dev only)          |
| `npm run db:studio`   | Open Drizzle Studio                          |
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
in `wrangler.jsonc`. Before the first Cloudflare deploy create the database and
put its id into `wrangler.jsonc` (the committed value is a placeholder, so the
Git-connected build fails until you do). Local setup, remote steps, backup and
data policy: [docs/d1-setup.md](docs/d1-setup.md).

## Tests

```bash
npm run test:unit   # pure logic, no database needed
npm run test:db     # tenant-isolation and service tests against your local PostgreSQL
npm test            # everything
```

Database tests run every case inside a transaction that is always rolled back,
so they never leave data behind. Run `npm run db:migrate` first.

## Project structure

```
src/
  app/         routes and pages
  components/  reusable UI components
  lib/         helpers
  db/          database client and schema
  types/       shared TypeScript types
drizzle/       generated SQL migrations (committed)
```
