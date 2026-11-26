# Feature traceability

UI actions mapped to the backend. The UI does not call the API yet. "Perm" is the minimum permission.
Acceptance tests for Phase 1 are the checklist in the [runbook](runbook.md). Endpoint shapes are in
[api.md](api.md). For later phases, rows are action groups and the contracts are not designed yet.

## Phase 1 (built and tested through the API; the screens do not call it)

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

## Phase 2 (built and tested through the API; the screens do not call it)

| Page → action | Service (`src/server/modules`) | Records | Perm | Failure the user sees |
| --- | --- | --- | --- | --- |
| Settings → brand versions, content summary | brand/profile | brand_profile_versions | website.update | Version conflict, nothing changed |
| Settings → facts, FAQs | brand/facts | brand_facts, brand_fact_versions, brand_fact_sources | website.update, brand.confirm | Source required, version conflict |
| Settings → source pages | brand/source-pages | website_source_pages | website.update | Not this website, duplicate |
| Settings → competitors | competitors | competitors, competitor_domains, competitor_revisions | website.update | Own domain, taken domain or name |
| Settings → products and services | products | products_services, product_service_versions | website.update | Validation, version conflict |
| Domains → HTTPS and redirect check (new control) | websites/inspect | domain_checks | website.domain.manage | Unreachable, unsafe address |
| Prompts → create, versions, approve, status, delete | prompts/service, versions | prompts, prompt_versions, prompt_tags, prompt_products | prompt.write, prompt.approve, prompt.delete | Duplicate, approval needed, active limit |
| Prompts → groups, bulk, CSV import | prompts/groups, bulk, import | prompt_groups | prompt.write | Skipped rows with reasons |
| Prompts → tracking: assignments | prompts/assignments | prompt_assignments | audit.create, monitoring.configure | Scope, pin, version conflict |

Not built: prompt templates (the screens' own fill-in texts need no server) and copying prompts to
another website.

## Later phases

| Page → actions | Records to add | External | Perm | Phase |
| --- | --- | --- | --- | :-: |
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
