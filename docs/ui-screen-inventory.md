# Rankvora Plus — UI screen inventory

Source of truth for the UI/UX phase. Derived from the four specifications: Multi-Store AI Prompt Tracking, Audit & Fixes, Monitoring, Comparison. Frontend only. All data on screen is **demo data** from `src/demo/`, read through `src/services/` so real services can replace it later.

## 0. Product rules the UI must honour

| Rule | UI consequence |
|---|---|
| API channels are not consumer apps | Label results "API answer sample"; always show provider + model + search mode + market + language where a result appears. Never "exact ChatGPT result". |
| Failed request ≠ brand absent | Failures are counted separately (coverage / success rate), never as "not mentioned". |
| Every % shows numerator / denominator | `Metric` component renders `18 / 48` next to every rate; also sample count and period. |
| Not applicable / unsupported ≠ 0 | Render "N/A" or "Not supported", never 0%. Zero baseline → "new from zero", relative change N/A. |
| AI visibility and website readiness stay separate | Never one blended score. Two distinct areas in Audit. |
| No causal claims | Fixes timeline wording: "visibility changed after this task was completed". |
| Applied ≠ published ≠ verified | Four separate states shown for a Fix task. |
| Org area vs store data | Org area visually distinct (own sidebar section + label). Store area always shows active store context. There is no org-wide roll-up page. |
| Raw responses immutable | Response screens are read-only; reviews show machine result and reviewed result separately. |
| Copy restraint | Short labels, tooltips/drawers for secondary info. No explanatory paragraphs. |
| No dead controls | Every control does something (navigates, filters, sorts, opens a dialog, toggles local state). |

## 1. Information architecture

```
Organization area (neutral chrome, label "Organization")
  /                          (redirects to /stores)
  /stores                    Stores (table/cards)
  /stores/new                Add store (stepper)
  /settings/billing          Billing

Store area (accent chrome, label = store name + market)
  /stores/[storeId]                     Dashboard
  /stores/[storeId]/prompts             Prompt library
  /stores/[storeId]/prompts/new         Create prompt (manual | AI suggestions | import)
  /stores/[storeId]/prompts/[promptId]  Prompt detail (config, versions, results)
  /stores/[storeId]/audits              Audit overview + history
  /stores/[storeId]/audits/new          Start audit wizard
  /stores/[storeId]/audits/[auditId]    Audit run (progress or results; tabs)
  /stores/[storeId]/fixes               Findings inbox
  /stores/[storeId]/fixes/tasks         Task board/list
  /stores/[storeId]/fixes/findings/[findingId]   Finding detail + recommendations
  /stores/[storeId]/fixes/tasks/[taskId]         Task detail (tabs)
  /stores/[storeId]/monitoring          Overview
  /stores/[storeId]/monitoring/schedules, /schedules/new, /schedules/[scheduleId]
  /stores/[storeId]/monitoring/runs, /runs/[runId]
  /stores/[storeId]/monitoring/observations
  /stores/[storeId]/monitoring/alerts
  /stores/[storeId]/monitoring/usage
  /stores/[storeId]/comparisons, /comparisons/new, /comparisons/[comparisonId]
  /stores/[storeId]/reports, /reports/[reportId]
  /stores/[storeId]/settings
```

Shell: sidebar (Organization group, Store group), compact top bar (organization selector, active store selector, notifications popover, user menu), page header (title, store context chip, one primary action). Mobile: sidebar becomes a drawer.

## 2. Vocabulary (statuses and enums, exact from the specs)

- **Store status:** draft, needs review, ready, active, paused, disconnected, archived.
- **Site type** (internally `StorePlatform`): wordpress, webflow, wix, squarespace, woocommerce, shopify, custom, manual. Shopify and WooCommerce are two options among many; nothing in the product depends on commerce.
- **Prompt status:** draft, active, paused, archived. **Tracking scope:** audit, monitoring, both. **Creation source:** manual, ai-generated, imported, research-derived, template.
- **Prompt intent:** discovery, recommendation, comparison, alternative, product/service, local/market, informational.
- **AI channels (first release):** OpenAI Responses API + web_search; Gemini API + Google Search grounding; Perplexity Agent API + web_search. Optional later: Claude (Messages API web search). Copilot: not offered. Search modes: model-only, web-grounded (required), web-grounded (optional/auto).
- **Audit type:** initial, full, focused, verification, triggered, scheduled. **Audit status:** draft, validating, queued, in progress, completed, completed with warnings, partially completed, blocked, failed, cancelled.
- **Assessment lanes:** AI visibility, website readiness.
- **Check result:** pass, fail, warning, not applicable, not assessed, inconclusive, blocked, error.
- **Job status:** queued, running, retry scheduled, succeeded, failed, cancelled. **Monitoring run status:** queued, running, completed, completed with warnings, partially completed, failed, cancelled, skipped.
- **Schedule status:** draft, validating, active, paused, needs attention, cancelled. Frequencies: daily, every N days, weekly, monthly, custom.
- **Finding lifecycle:** new, under review, confirmed, in remediation, awaiting verification, verified resolved, reopened, accepted risk, false positive. **Severity:** critical, high, medium, low, informational. **Priority:** P0–P3. **Confidence:** high, medium, low. **Effort:** small, medium, large. **Category:** technical, content, entity, schema, AI visibility, product.
- **Fix task status:** suggested, pending approval, approved, queued, in progress, blocked, draft ready, staged, applied, published, verification pending, verified success, partially verified, failed, rolled back, rejected/cancelled, superseded.
- **Execution mode:** guidance only, AI draft/patch, CMS staged draft, approved apply/publish. **Risk level:** low, medium, high, critical. **Cause classification:** confirmed, likely, hypothesis.
- **Alert severity:** info, low, medium, high, critical. **Alert status:** new, read, acknowledged, resolved, muted. **Delivery:** pending, sent, failed, retrying. **Channels:** in-app, email, webhook.
- **Monitoring events:** new mention, lost mention, new recommendation, recommendation lost, new/lost owned citation, sentiment shift, competitor increase/decrease, rank movement, provider outage/error spike, run incomplete/late.
- **Comparison type:** snapshot vs snapshot, period vs period, initial audit vs latest monitoring, before vs after fixes, prompt/topic, platform, brand vs competitors. **Comparability:** comparable, partially comparable, comparable with warnings, not comparable, insufficient data. **Comparison status:** draft, validating, queued, running, completed, completed with warnings, partially comparable, not comparable, insufficient data, failed, cancelled, archived.
- **Roles:** owner, admin, editor, auditor, viewer.
- **Mention classification:** recommended / not recommended / merely mentioned / unclear. **Sentiment:** positive, neutral, negative, mixed, unknown. **Citation source type:** owned domain, competitor domain, third-party, none returned, not supported.

## 3. Metrics (always numerator / denominator / sample / period)

Brand mention rate, recommendation rate, recommendation conditional rate, owned-domain citation rate, competitor mention rate, positive / negative sentiment share, tracked-brand share of voice, top-list presence, average/median position (ranked lists only), prompt coverage, provider coverage, response success rate, citation count. Website readiness: check coverage, page coverage, technical pass rate, content-quality pass rate (separate). Changes: absolute count change, percentage-point change, relative change (N/A at zero baseline), denominator change, matched cohort coverage. Sample policy: headline trend only with ≥ 20 matched pairs; otherwise "directional / low confidence" with Wilson interval shown when available.

## 4. Screens

Legend — **P** primary action · **States** include loading, empty, error, success where relevant.

### A. Dashboard (store) — `/stores/[storeId]`
Metric row (mention rate, recommendation rate, owned citation rate, competitor visibility top 3) with counts. Trend chart of mention rate (monitoring runs). Important findings (top 5), pending tasks, monitoring status (last/next run, open alerts), recent activity, latest comparison trend. **P:** Start audit. The websites list (`/stores`) shows each website with the same metrics.

### B. Multi-store
- **Portfolio overview** (removed): `/` now redirects to `/stores`. The websites list carries the per-website cards and metrics.
- **Websites & Brands** `/stores`: table + card toggle; search; filter status/platform/market; sort. Row → store dashboard. Status chips, integration status (connected / disconnected / manual).
- **Add website** `/stores/new` (four steps in code: Basics, Brand profile, Connections, Review): 1 Basics (name, website, site type), 2 Connection (manual, or an optional publishing connector such as WordPress, Webflow, Wix, WooCommerce or Shopify), 3 Brand & market (brand name, aliases, industry, description, country, language, timezone), 4 Products/services, 5 Competitors (confirmed vs suggested), 6 AI channels + tracking mode + review & activate (checklist). Inline validation, back/next, draft status.
- **Store details**: Settings page (see I). **Store switching**: selector in top bar, with status dot; archived hidden unless toggled.

### C. Prompts — `/stores/[storeId]/prompts`
- **Library** table: prompt text, intent, group, topic, scope, status, version, source, last result (mention y/n per provider as small marks with labels), core flag. Search; filters (status, intent, group, scope, source, core); sort; bulk select (activate/pause/archive/move to group); group sidebar/filter; library summary strip (counts, neutral vs brand prompts warning). **P:** New prompt.
- **Create** `/prompts/new`: tabs — Manual (text, intent, topic, group, market/language, scope, status, products), AI suggestions (generate from store profile; list of suggestions with accept/edit/dismiss; duplicate warnings), Import CSV (template columns, dry-run preview table with created/duplicate/invalid rows). Duplicate / near-duplicate warning inline.
- **Detail** `/prompts/[promptId]`: header (text, status toggle), tracking config (scope, markets, channels it runs on, core flag, group, linked products), version history (v1…vN timeline with diff + "used by runs" count), results history (per provider/time), activity. Edit creates new version (confirmation shows impact on comparisons).
- **Groups**: manage in a drawer (create, rename, delete → prompts become ungrouped).
- **Templates**: copy from organization template (dialog).

### D. Audit — `/stores/[storeId]/audits`
- **Overview/history**: latest audit summary (AI lane metrics + website lane coverage, kept visibly separate), run history table (type, lanes, status, started, duration, coverage, findings count, snapshot id), coverage chips. **P:** Start audit.
- **Start audit wizard** `/audits/new`: 1 Type (initial/full/focused/verification) + lanes · 2 Prompts (all active / groups / ids; exact versions; paused/archived listed separately) · 3 AI channels (provider/model, search mode, market/language, samples) · 4 Website scope (start points, limits, page types, excluded paths) · 5 Criteria + integrations (Search Console, PageSpeed, CMS) and limits (max URLs/requests, concurrency, budget) · 6 Review: predicted usage (jobs = prompts × channels × samples, pages, cost estimate), limitations (providers without citations, missing connectors), confirm.
- **Run `/audits/[auditId]`** — in-progress state: overall progress, per-stage status, completed/failed jobs, current URL/provider, warnings, cancel. Completed state tabs:
  - **Overview**: run summary (store, type, scope, status, times, snapshot id), coverage (prompts, providers, pages, checks), limitations.
  - **AI visibility**: rates by provider / prompt group with n/d, competitor table, citations by source type, response list (filter provider, prompt, mention, recommendation, sentiment) → response drawer (exact prompt, provider/model/settings, original answer with highlighted mention spans, classification + evidence quote + confidence, citations, usage, raw payload ref, review path).
  - **Website readiness**: check coverage, page coverage, technical vs content pass rates (separate), AI crawler access (OAI-SearchBot, GPTBot, ChatGPT-User reported separately), checks table (group, status, affected), page list → page inspector (URL, crawl facts, title/meta/headings, robots/canonical, schema, links, performance, evidence).
  - **Findings**: register table (title, category, severity, priority, confidence, status, affected count) → finding detail.
  - **Report**: sections per spec §10.1, export (HTML/PDF/CSV/JSON), immutable snapshot id.
- **Finding detail** (shared with Fixes): description, expected vs actual, evidence list (links to response/page), affected URLs/prompts, history of observations, severity rationale, linked tasks, verification criteria. **P:** Create recommendation / task.

### E. Fixes — `/stores/[storeId]/fixes`
- **Findings inbox**: filters (severity, priority, category, confidence, status), duplicate indication, affected counts. Bulk select → create tasks.
- **Task board/list**: toggle list/board (board columns: Suggested/Pending approval · Approved/Queued/In progress/Blocked · Draft ready/Staged · Applied/Published · Verification pending · Done (verified/partially/failed/rolled back)). Card: title, assignee, due, priority, risk, blockers.
- **Finding → recommendation detail** (`/fixes/findings/[id]`): recommendation cards (problem, evidence refs, cause classification chip, proposed action, why it matters, expected outcome, effort, risk, dependencies, limitations, verification plan) with approve / edit / reject.
- **Task detail** `/fixes/tasks/[taskId]` tabs: **Overview** (status stepper showing completed → applied → published → verified as four separate states, assignee, due, execution mode, risk) · **Draft** (AI-assisted drafting: generate/regenerate, source facts used, unsupported-claim warnings, editor + live preview, before/after diff) · **Approval** (exact diff hash, required approver, approve/reject; role gating) · **Execution** (connector, granted scopes, remote version check, exact diff, per-field outcome, CMS state: guidance / draft / staged / applied) · **Verification** (checks re-run, before/after evidence, result, finding status effect) · **History** (drafts, approvals, executions, rollbacks). Rollback dialog with conflict warning. Batch fixes: affected URL list with per-resource result rows and exclusion reasons.

### F. Monitoring — `/stores/[storeId]/monitoring`
Tab bar: Overview · Schedules · Runs · Observations · Alerts · Usage.
- **Overview**: schedule status summary, last run / next run (store timezone), core metrics (n/d), mention-rate timeline with run markers, open alerts, recent changes (events), provider health.
- **Schedules** list (name, frequency, timezone, prompts × providers, status, next run, estimated usage); **P:** New schedule. **Create/edit** form: name, prompt selection (latest approved vs pinned version), providers + models + search mode, market/locale, frequency, timezone, local time, samples, run window, concurrency, retry policy, usage cap, alert rules, channels; estimate panel (jobs/run, jobs/month); validation checklist. **Detail**: configuration, version history, pause/resume/cancel, run-now (dialog with reason).
- **Runs** history table + **Run detail**: status, totals (planned/attempted/succeeded/failed/retried/analysed), provider split, job table (prompt, provider, sample, status, attempts, error class), failures list, usage/cost, config snapshot, provisional label while running.
- **Response detail** (drawer): same as Audit response inspector.
- **Observations**: per prompt/provider time series with dates, raw evidence link, filters (provider, prompt/group, market, event type).
- **Alerts**: events and alerts inbox (filters severity, state, type), evidence (previous vs current result, excerpts), acknowledge / mute / resolve, delivery status; separate tab/section for provider/data-quality events.
- **Usage**: requests, samples, search/tool calls, tokens, cost vs caps by provider and period.

### G. Comparison — `/stores/[storeId]/comparisons`
- **List**: title, type, baseline → current, status, comparability, created by; **P:** New comparison.
- **Create wizard**: 1 Type · 2 Baseline and current (snapshots or date windows; overlap warning) · 3 Filters (prompt group/prompt, provider/model, market, language, competitor, citation domain) and policy (matching, aggregation: matched-slot macro avg / pooled) · 4 **Compatibility preview** (hard checks, soft warnings, matched coverage, excluded rows, can/can't run) · 5 Run (sync) → opens comparison.
- **Comparison view** tabs: **Overview** (comparability verdict banner, headline metric rows: baseline vs current with n/d, pp change, relative change or "new from zero", sample status, CI; grouped-bar chart; trend chart) · **Prompts** (matched table: old/new result, provider, deltas, response links; unmatched and excluded separately) · **Platforms/models** (segments; model-change warning) · **Competitors** (same-cohort comparison, added/removed lists) · **Citations** (owned citation rate, cited URLs/domains, N/A for unsupported providers) · **Sentiment** (distribution with excerpts) · **Fixes timeline** (tasks between periods, context-only wording) · **Data quality** (success/failure counts, coverage, exclusions with reasons) · **Report/export** (CSV row-level + aggregate, PDF summary, methodology version, sources).
- Portfolio comparison was part of the removed Portfolio page and is not offered.

### H. Reports & history — `/stores/[storeId]/reports`
Unified history of audit, monitoring and comparison reports: type, title, period, snapshot/methodology version, created, status; filters (type, date), search; row → report detail (structured sections per type, limitations, source ids, timestamp) with export actions (CSV / PDF / JSON) producing a visible toast/state. Historical records tab: previous audits and runs.

### I. Settings & integrations
- **Billing** `/settings/billing` (`/settings` redirects here), three tabs: Plan (current plan, renewal, included limits, compare and change plan with prorated demo invoice) · Usage (limit bars for requests, search calls, websites, prompts and estimated cost; usage by website with the split by OpenAI, Gemini and Perplexity; usage by provider; six-month request chart) · Invoices (demo invoices, download as HTML or CSV). Everything is labelled demo. The product is single-user: no team, seats, roles, payment method, add-on packs or cancellation.
- **Integrations** `/integrations`: organization level. AI platforms (OpenAI/Gemini/Perplexity: connection status, model, search capability, masked demo key, test connection, own key; `/settings/ai-platforms` redirects here) only. Website connectors and Search Console are managed in Website settings > Connections.
- **Store** `/stores/[storeId]/settings`: tabs — Profile (name, platform, timezone, status transition with confirm) · Brand (current version + version history, aliases, differentiators) · Domains (canonical, aliases/redirects, former domains history) · Competitors (confirmed/suggested/archived, confirm action) · Products & services · Connections (this website's publishing connector and Search Console: state, granted scopes, property, disconnect confirm) · Notifications (events and channels for this website) · Activity log · Danger zone (pause / archive with confirmation).

## 5. Shared states (every list/detail)
Loading skeleton matching layout · Empty (one next action) · Error (cause + retry) · Success (toast) · No permission (role-based hide/disable with reason) · Demo-data marker in shell footer / banner.

## 6. Component inventory
Buttons/icon buttons/menu · Input, Textarea, Select, Combobox-lite, Checkbox, Radio group, Switch, Segmented control, Slider-less number input · Field (label, hint, error) · Card, Section, Metric (n/d, delta, sample status) · Tabs (link tabs + state tabs) · Table (sticky header, sort with aria-sort, selection, density, pagination, empty/loading) · Search field + filter bar + chips · Status badge (icon + text + tone) · Dialog + confirm dialog · Drawer · Popover/Dropdown menu · Tooltip · Progress / Stepper · Toast · Breadcrumb · KeyValue · Callout · Diff view · Timeline · Charts: Sparkline, Line (multi-series with run markers), Grouped bars (baseline vs current, CI whiskers), Stacked bar, Donut (≤ 5), Heat strip · Skeleton · EmptyState · ErrorState · Icon set (inline SVG, 1.5 stroke).
