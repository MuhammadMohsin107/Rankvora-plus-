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
