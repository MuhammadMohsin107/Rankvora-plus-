# Rankvora AI: feature ownership

One feature, one purpose, one primary management location. Other screens may show a summary, a metric or a link, never a second copy of the workflow.
Frontend only: every record is demo data and every action is simulated in browser state (`src/demo-state`).

Routes keep the internal name `/stores/[storeId]`; everything a person reads says "Website" (see `src/lib/labels.ts`).

## Primary modules (website level)

| Module | Owns | Does not own (links instead) |
|---|---|---|
| **Audit** `/audits` | Audit creation wizard (initial, full, focused and verification audits; recurring runs belong to Monitoring), configuration and scope, progress, history, snapshot results, AI visibility and website readiness lanes (kept separate), response and page inspection, finding evidence, audit report preview | Fix workflow (a finding links to Fixes), prompt editing (Prompt Library) |
| **Fixes** `/fixes` | Findings inbox, recommendations, task board and list, draft, approval, simulated execution, verification, rollback, fix history | Evidence capture (links back to the Audit response or page), trend measurement (Monitoring, Comparison) |
| **Monitoring** `/monitoring` | Schedules (daily, weekly, monthly), simulated runs and jobs, observations, visibility trends, competitor observations, alerts, usage and caps | Prompt text and groups (Prompt Library), notification settings (Website settings) |
| **Comparison** `/comparisons` | New comparison wizard, history, snapshot, period, audit-to-monitoring and before-and-after-fix comparisons, compatibility and data quality, matched, unmatched and excluded rows, fixes timeline, export | Raw audit and run records (it reads them) |

Workflow: **Audit → Findings → Fixes → Monitoring → Comparison**. A finding opens in Fixes; a task links back to its audit evidence; a verification run is a Monitoring run; Comparison reads saved snapshots and runs and lists fixes between periods as context only (no causal claims).

## Supporting sections (website level)

| Section | Owns |
|---|---|
| Dashboard | Summary only: headline metrics, biggest problem, next action, trend, recent activity |
| Prompt Library `/prompts` | Prompts, groups, versions, templates, import, AI suggestions, per-prompt results history |
| Reports `/reports` | Generated report history and export for audit, monitoring and comparison sources |
| Website settings `/settings` | Profile and site type, brand and knowledge, domains, competitors, products and services (optional), **Connections** (publishing connector and Search Console of this website), notifications (which events notify the team and on which channels; the only place they are set), activity, pause and archive |

## Organization level

| Section | Owns |
|---|---|
| Websites & Brands `/stores` | Website list, add website wizard, status changes |
| Integrations `/integrations` | AI platform connections (shared by all websites). Website connectors and Search Console are not here; they are in Website settings |
| Billing `/settings/billing` | Plan and plan change, usage by website and by AI provider against the plan limits, demo invoices. No payment method, add-on packs or cancellation: nothing is really charged |
| Help & Support `/help` | Help center |

`/settings/ai-platforms` redirects to `/integrations`; `/settings` redirects to Billing. Export and reset of demo data are in the account menu.

## Rules that keep ownership clean

- A connection is managed once: AI platforms in Integrations, per-website connectors in Website settings. The Integrations page does not list website connections.
- Anything simulated carries a Demo or Simulated marker. Applied, Published and Verified stay separate task states and are never presented as real external writes.
- Counts, rates and averages are never mixed: rates show numerator and denominator, averages are labelled as averages, and failed requests are never counted as "not mentioned".
- Shopify, WooCommerce, WordPress, Webflow, Wix and Squarespace are equal site types. Products and services are optional website data, not a requirement.
