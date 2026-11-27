# src/server — backend code

Business rules, database access, login and permissions. No backend code exists yet.

Used by the web app (pages and API routes) and by the Jobs Worker (`workers/jobs`).

Rules (`npm run lint` checks the import rules):

- No imports from screens or demo data (`app`, `features`, `components`, `services`, `demo`, `demo-state`).
- Only `server/next` may import Next.js. Other server code must not import `server/next`, because Jobs has no Next.js.
- Start each server file with `import "server-only";`. It stops the browser app from including the file.
  Jobs and the tests replace it with an empty file (see `workers/jobs/wrangler.jsonc` and `vitest.config.mts`).

Planned layout: `docs/backend/backend-plan.md`, section 4.
