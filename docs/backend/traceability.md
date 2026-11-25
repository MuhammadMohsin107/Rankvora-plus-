# Feature traceability

UI actions mapped to the backend. The UI does not call the API yet. "Perm" is the minimum permission.
Acceptance tests for Phase 1 are the checklist in the [runbook](runbook.md). Endpoint shapes are in
[api.md](api.md). For later phases, rows are action groups and the contracts are not designed yet.

## Phase 1 (built, not run)

| Page → action | Service (`src/server/modules`) | Records | External | Perm | Failure the user sees |
| --- | --- | --- | --- | --- | --- |
| New pages → sign up, sign in, reset, sessions, MFA, delete account | `auth/` | users, user_sessions, auth_* | Email | own account | Field or auth error; email not sent |
| Shell → organization switcher, account menu | organizations | organizations, members | | member | |
| New pages → members and invitations | members, invitations | organization_members, invitations | Email | member.manage | Limit, last owner, delivery failed |
| Websites list → search, filter, open | websites | websites, website_domains | | website.read | Not found |
| Add website → create | websites | websites, website_domains, activity_logs | | website.create | Validation, domain in use, limit |
| Website settings → profile | websites | websites | | website.update | Validation, version conflict |
| Website settings → ready, pause, resume, archive, restore | websites | websites | | website.lifecycle | Invalid transition, conflict |
| Websites list and settings → delete | websites | websites, domains (soft) | | website.remove | Not archived, name mismatch |
| Website settings → domains, change main domain | websites/domains | website_domains | | website.domain.manage | In use, invalid |
| New control → verify ownership | websites/verification | domain_verifications | DNS-over-HTTPS | website.verify | Record not found, mismatch, claimed |
| Website settings → activity | history | activity_logs | | activity.read | |
| Billing → usage | usage | entitlements, usage_* | | usage.read | |

## Later phases

| Page → actions | Records to add | External | Perm | Phase |
| --- | --- | --- | --- | :-: |
| Settings → brand versions, facts, FAQs, source pages, competitors, products | brand_*, competitors, products_services | | website.update, prompt.write | 2 |
| Prompts → create, versions, groups, templates, bulk, CSV import, copy | prompts, prompt_versions, groups, assignments | | prompt.write | 2 |
| Prompts → AI suggestions | suggestions | AI provider | prompt.write | 3 |
| Integrations → connect, replace key, test, disconnect | provider_connections, credentials | AI providers | integration.manage | 3 |
| Responses drawer → view, request review | responses, citations, analyses, reviews | R2 | audit.read | 3-4 |
| Audit → wizard, draft, start, pause, resume, cancel, rerun, progress | audit_runs, jobs, snapshots | Providers, crawler, PageSpeed, CrUX, queues | audit.create | 5 |
| Audit → results, pages, checks, findings, exports | crawl_*, checks, findings, evidence | | audit.read, report.export | 5 |
| Fixes → review findings, recommendations | findings, observations, recommendations | | fix.recommend | 6 |
| Fixes → tasks, drafts, approval, stage, apply, publish, verify, roll back | fix_* | CMS, AI provider | fix.edit, fix.approve, fix.publish | 6 |
| Monitoring → schedules, run now, retry, cancel | schedules, versions, runs | Cron, queues, providers | monitoring.configure | 7 |
| Monitoring → observations, alerts, delivery retry, usage; shell notifications | observations, events, alerts, deliveries | Email, webhooks | monitoring.read | 7, 9 |
| Comparison → preview, create, archive, tabs, exports | comparisons, sources, matches, metrics | | comparison.create | 8 |
| Reports → generate, retry, archive, view, download | reports, versions, files | R2 | report.export | 9 |
| Dashboard → metrics, trend, next action, activity; search | aggregates of the above | | website.read | 5-9 |
| Website settings → connectors, Search Console; notification matrix | integration_connections, preferences | CMS, Google | integration.manage | 6, 9, 10 |
| Billing → plans, change plan, invoices, pay | plans, subscriptions, invoices | Payment provider | billing.manage | 10 |
| Help → contact support | support_tickets | Email | signed in | 9 (scope undecided) |
