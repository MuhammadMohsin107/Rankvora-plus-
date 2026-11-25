# Phase 0: discovery (2026-11-25)

State of the repository before the backend work, read from the code. Line-level UI detail came from three
read-only passes over every route in `src/app` and `src/features`.

## Stack, verified

| Item | Found | Blueprint said |
| --- | --- | --- |
| Next.js / React / TypeScript | 16.4.6 / 19.3.0 / 5.x, App Router | same |
| Styling | Tailwind CSS 4.3.3 | same |
| Hosting | Cloudflare Workers via OpenNext 1.20.17; push to `main` deploys | same |
| ORM | Drizzle 0.45.4, SQLite dialect | same |
| PostgreSQL driver `pg` | **Not present.** The PostgreSQL layer was deleted on 2026-11-23 | listed as present |
| Database | Cloudflare D1 `rankvora-plus` (APAC), 106 kB | recommended PostgreSQL |
| Cloudflare plan | **Workers Free** (owner's statement) | not stated |

**Decision (owner, 2026-11-25): D1 is the only database.** No PostgreSQL, Hyperdrive or local database.

## Code inventory (before this work)

| Area | State |
| --- | --- |
| `src/app` pages | Complete UI for all modules, driven by demo data. `generateStaticParams` over demo website ids |
| `src/features`, `src/components` | UI and pure logic. Client-side validation only. No role is enforced outside a few Fixes buttons |
| `src/services` | "Data access" that returns constants from `src/demo` |
| `src/demo` | Four demo websites: records, generated AI answers, billing |
| `src/demo-state` | Browser state in localStorage, mirrored to D1 as one JSON document |
| `src/db-d1` | One table `workspaces`; identity is an anonymous cookie |
| API routes | `/api/demo-state`, `/api/health` only |
| Authentication, tenancy, jobs, providers, crawler, email, billing | **Missing** |

Duplicate logic that must have one server-side home: schedule estimates (`services/monitoring.ts` and
`features/monitoring/schedule-logic.ts`), recommendation-rate definition (audits use `recommendation`,
prompts use `outcome`), CSV formula escaping (two copies; the audit export has none).

Reusable as server code: `features/comparison/engine.ts` (pure), `features/monitoring/schedule-logic.ts`
(pure, but fix the defects below first), `features/prompts/import-parse.ts` and `text.ts`,
`lib/stats.ts`, `lib/domain.ts` (already reused).

## Database audit

Remote D1 held `workspaces` only; migration `0000` applied; no pending migrations. Read-only queries.
D1 facts that shape the design (Cloudflare documentation, read 2026-11-25):

| Fact | Consequence |
| --- | --- |
| No interactive transactions; `batch()` is atomic | Guarded SQL inside batches (`src/server/db/atomic.ts`) |
| Foreign keys enforced by default | Composite tenant foreign keys are real constraints |
| 100 bound parameters per query; 2 MB per row | Large provider responses go to R2 (Phase 3) |
| 500 MB per database and 50 queries per invocation on Free | Keep request query counts low; revisit before Phase 3 |
| 10 ms CPU per request on Free | Password hashing is expected to exceed it, see the runbook |

## Dependency audit

Added `better-auth` and `@better-auth/drizzle-adapter` 1.7.28 (peer ranges accept the installed Drizzle,
Next, Zod and Vitest). `npm audit --omit=dev` before the change: 3 moderate, from `minimatch` under
`@opennextjs/cloudflare`; the offered fix is a breaking downgrade, so it was left.

## Data flow

Before: `page → src/services → src/demo constants`, plus `browser action → localStorage → /api/demo-state → D1 (one blob)`.

Backend path added in Phase 1:
`request → route (src/app/api/v1) → apiHandler (origin, session, body) → tenancy guard → module service → D1`.
The UI does not call it yet.

## What the current UI fakes (must not survive wiring)

- Provider "Test connection" is scripted (Perplexity always fails, others always pass). Connector
  authorize, verify and Search Console connect always succeed with invented accounts.
- Billing upgrade and "Pay now" mark invoices paid. The support form stores nothing.
- Audit, monitoring and report runs are timers replaying stored answers. Report retry always succeeds.
- CMS stage, apply and publish always succeed; the user picks the verification result.
- Webhook "Send test" and alert delivery retry always succeed.
- The uncommitted change to `src/app/settings/billing/page.tsx` (not made by this work) removes the
  "Demo" and "No real payments" badges while invoices are still invented.

## UI defects to resolve when each phase takes over the rules

| Phase | Defect |
| --- | --- |
| 2 Websites | Tracking mode cannot be saved alone. "Ready" has two meanings (wizard and settings). Website delete leaves related records. Pause and archive do not stop schedules. Domain history dates are wrong after a second change. Authorization "Cancel" does not cancel |
| 2 Prompts | Active-prompt limit enforced on one screen only. Audit wizard ignores prompt scope, so monitoring-only prompts are audited |
| 3-5 Audit | URL list and selected groups are not saved. Local audits show 0 findings. Evidence links break for new audits. Citation highlight compares a domain with a URL |
| 6 Fixes | **Approval is not bound to the written content** (static hash; unsaved edits can be written; reopening keeps "approved"). Tasks created from the inbox lose the recommendation. Edited recommendation text is ignored. Most actions bypass the state machine. Several dead ends after failed verification or rollback |
| 7 Monitoring | New York skipped 02:30 resolves backwards. Cron rejects `1-7` and finds no run for 29 February. Activate and Resume skip validation. "Run now" on a paused schedule can run another one. Retry ignores paused or cancelled. UI promises missed-run catch-up that does not exist |
| 8 Comparison | Comparison ids collide across websites and hold no stored result or method version. Point changes still show below 20 samples in some views |
| 9 Reports | A report from a wizard comparison never opens. Nothing is stored; documents are rebuilt from current data, and use different aggregation from the comparison screen |
