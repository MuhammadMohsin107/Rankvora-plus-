# Cloudflare D1 setup (demo state)

The demo state (prompts, websites, schedules, task and alert actions, reports,
settings, events) is saved in a Cloudflare D1 database, one workspace per
browser. localStorage stays the instant local copy; the app works without D1
(status "Saved on this device").

How it fits together: `wrangler.jsonc` binds D1 as `DB`; schema in
`src/db-d1/schema.ts`; SQL migrations in `migrations/`; API in
`src/app/api/demo-state/route.ts`; health check at `/api/health`.

## Local

1. Install: `npm install`
2. Create the local database tables (a SQLite file under `.wrangler/state`, git-ignored):
   ```bash
   npm run db:d1:migrate:local
   ```
3. Run the app: `npm run dev` (only `next dev` attaches the local D1 binding).
4. Check it: open <http://localhost:3000/api/health>. Expected: `{"status":"ok","d1":"connected"}`.
   A 503 with `detail` tells you what is missing: `binding_missing` (dev server could not start the
   binding, see its log), `migrations_not_applied` (run step 2).
5. Reset the local database (deletes the local file and re-applies migrations): `npm run db:d1:reset:local`
6. Tests: `npm run test:unit` needs no database. `npm run test:d1` runs the SQL against an in-memory
   local D1 (no login, no network).
7. Change the schema: edit `src/db-d1/schema.ts`, run `npm run db:d1:generate`, commit the new file in `migrations/`,
   then `npm run db:d1:migrate:local`.

## Remote (you run these; they need your Cloudflare login)

1. Log in once: `npx wrangler login`
2. Create the database: `npx wrangler d1 create rankvora-plus`
   Copy the printed `database_id` into `wrangler.jsonc` (`d1_databases[0].database_id`, replacing
   `REPLACE_WITH_DATABASE_ID`). The id is not a secret; commit it.
3. Apply the migrations: `npx wrangler d1 migrations apply rankvora-plus --remote`
4. Deploy: `npm run deploy`, or push to the repository connected to Workers Builds.
5. Verify: open `https://<your-worker>.workers.dev/api/health`. Expected `{"status":"ok","d1":"connected"}`.

Status: steps 1 to 3 are done for the account that deploys the Worker (database `rankvora-plus`, id committed
in `wrangler.jsonc`, `0000` migration applied remotely). A placeholder or wrong id makes the Git-connected build fail at
the deploy step with `binding DB of type d1 must have a valid database_id [code: 10021]`. If you have more than one
Cloudflare account, create the database in the account shown in the build log (`/accounts/<id>/workers/...`).

### Optional: apply migrations on every deploy

In Workers Builds, change the Deploy command to:

```bash
npx wrangler d1 migrations apply DB --remote && npx opennextjs-cloudflare deploy
```

Already-applied migrations are skipped. The build token needs D1 edit permission.

## Troubleshooting

- `/api/health` returns `binding_missing` on Cloudflare: `database_id` is still the placeholder, or the
  deploy ran before the binding existed. Fix `wrangler.jsonc`, redeploy.
- `migrations_not_applied`: run `wrangler d1 migrations apply ... --remote` (or `--local` for dev).
- Deploy fails with "D1 database not found" or an invalid id: the `database_id` in `wrangler.jsonc` does
  not match `npx wrangler d1 list`.
- Local dev works but changes do not reach the server: look at the indicator and the Network tab for
  `/api/demo-state`. 503 means no database, 403 means the Origin header did not match the Host
  (reverse proxies that rewrite Host), 409 is normal when two tabs save (the server copy wins).
- `npm run cf-typegen` writes a large `cloudflare-env.d.ts` that conflicts with the DOM typings. Do not keep it;
  the bindings are typed by hand in `src/db-d1/cloudflare-env.d.ts`. Update that file when you add a binding.

## Backup and export

```bash
npx wrangler d1 export rankvora-plus --remote --output backup.sql   # full dump
npx wrangler d1 export rankvora-plus --remote --no-schema --output data.sql
```

D1 also keeps point-in-time recovery (Time Travel): `npx wrangler d1 time-travel info rankvora-plus`.

## Data policy

- Demo data only. Never store secrets, API keys, real cards or personal data in the demo state.
- There is no login. Anyone who can open the site can use and change the shared demo; each browser gets
  its own workspace through the httpOnly cookie `rv_ws` (random UUID, SameSite=Lax, Secure in production).
  Clearing cookies starts a fresh workspace; the old row stays in D1 until someone deletes it.
- Anyone holding the cookie can read and replace that workspace; it is not private storage.
- Writes are limited to 512 KB per workspace and checked against the demo-state schema. State is never logged.
- The real backend phase will add proper relational tables and authentication; this table is a stopgap.
