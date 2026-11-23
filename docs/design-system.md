# Rankvora AI: design system & build rules

Direction (from the ui-ux-pro-max skill, filtered through the brief): **Minimalism & Swiss + data-dense dashboard**. Premium, restrained, one accent (indigo), neutral surfaces, subtle borders, tiny shadows, Geist type with tabular numbers. Light and dark themes designed together. Frontend only.

Read first: `docs/ui-screen-inventory.md` (what to build, vocabulary, spec rules).

## 1. Hard rules

1. **Minimal text.** Short headings and labels. No explanatory paragraphs. Secondary info → tooltip (`CardHeader info`, `Metric info`), drawer, or expandable section. One subtitle line max.
2. **No dead controls.** Every button/link/menu item must do something: navigate, open a dialog/drawer, filter/sort, toggle local state, or push a toast confirming the (demo) action. Never an inert button.
3. **Every percentage** uses `<Metric>` or `<BarCompare>` so numerator / denominator / sample are visible. N/A is "N/A", never 0%. Zero baseline → "new from zero".
4. **Failed ≠ absent.** Failed requests are shown separately (coverage / success rate), never counted as "not mentioned".
5. **Honest channel labels.** Show provider API · model · search mode · market · language (use `channelLabel()` / `ResponseInspector`). Say "API answer sample". Never "exact ChatGPT result".
6. **No causal claims.** Fixes ↔ visibility: "visibility changed after this task was completed".
7. **Status = icon + text + tone** via `<Status kind value />` (vocabulary in `src/lib/status.ts`). Never colour alone. Charts also use line styles / markers / direct labels.
8. **Org vs website** (internally `store`). Organization pages show the Organization sidebar group only and no website in the header (breadcrumb: Organization / page); website pages add the Website group and the website selector (Organization / Website / section / page) and live under `/stores/[storeId]/…` and the shell already shows the store context. There is no organization-wide roll-up page (the Portfolio page was removed).
9. **Demo data** only via `src/services/*` reading `src/demo/*`. Fixed timestamps only (`DEMO_NOW = 2026-11-19T09:00:00Z`). **Never** call `new Date()` (no args), `Date.now()`, `Math.random()`, `crypto.randomUUID()` during render — Next 16 Cache Components fails the build. Use `formatRelative(iso)` / `formatDateTime(iso, tz)` from `src/lib/format.ts`.
10. **Registry is law.** `src/demo/registry.ts` fixes ids, titles, dates, statuses and headline numbers for audits, runs, schedules, comparisons, tasks, reports; `src/demo/shared-records.ts` has findings and the response generator. Use them. Add detail around them; never contradict them.
11. **Tailwind CSS 4 only.** No UI libraries, no icon libraries, no chart libraries, no extra npm packages. Use semantic tokens (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`, `text-danger`…). **No raw hex, no arbitrary colours.**
12. **Grids:** always start with a `grid-cols-[minmax(0,1fr)]` base (`grid grid-cols-[minmax(0,1fr)] md:grid-cols-2`), otherwise cards overflow on mobile. Every flex child that holds text needs `min-w-0` + `truncate` or wrapping. No horizontal page scroll at 375px.
13. **Accessibility:** labelled inputs (use `Field`), visible focus (global), 4.5:1 text contrast (tokens already comply), icon-only buttons need `label`, tables via `DataTable`, one `h1` per page (`PageHeader`), headings in order.
14. **Next.js 16.** Read `node_modules/next/dist/docs/` before unfamiliar APIs (`AGENTS.md`). `params` is a Promise. Cache Components is on: every dynamic route segment needs `generateStaticParams` returning all demo ids (parent + child params together), or `notFound()` for unknown ids. Use `PageProps<'/stores/[storeId]/…'>` for typing. Do not use `export const dynamic`.

## 2. Tokens (see `src/app/globals.css`)

Three layers: **primitive** (`--p-*`, raw palette, never used by components), **semantic** (purpose aliases below), **component** (sizing knobs). Light is the default; `data-theme="dark"` keeps the structure but is not polished.

| Group | Tokens (Tailwind utilities) |
|---|---|
| Surfaces | `canvas` #F5F6FA (page) · `surface` #FFF (cards) · `surface-2` #F8F9FC · `surface-3` (tracks/fills) · `sidebar` |
| Lines | `line` #E6E8EF · `line-soft` #EEF0F4 (row dividers) · `line-strong` (control borders) |
| Text | `fg` #171923 · `fg-muted` #667085 · `fg-subtle` #6A7183 (helper text, 4.5:1) · `fg-faint` #9299A8 (**icons / disabled only**, 2.9:1) |
| Accent | `accent` #5145D8 · `accent-hover` · `accent-soft` · `accent-fg` · `accent-text` · `ring` (focus, = accent) |
| Status | `success|warning|danger|info` (bright: fills, borders, dots) · `-soft` (backgrounds) · `-text` (any text, >= 4.5:1) · `-icon` (bright, icons) · `danger-solid` + `danger-fg` (destructive button) |
| Chart | `series-1..5` (#5145D8 #EB6834 #1BAF7A #2A78D6 #E87BA4) · `series-other` (#898781) · `grid` |
| Sidebar text | `sidebar-fg`, `sidebar-fg-muted` (the sidebar tint fails 4.5:1 with `fg-muted`) |

**Text on status colours:** use `text-*-text`. As a safety net `text-success|warning|danger|info` already resolve to the `-text` tone; use `text-*-icon` for the bright tone on icons.

Sizes (component tokens, utilities in brackets): control height 40 (`h-control`, sm 32, lg 44) · button 36 (`h-btn`, sm 32, lg 40; all 44 on coarse pointers) · card padding 20 (`p-card`, `px-card`) · radius card 12 / control 8 (`rounded-card`, `rounded-control`) · sidebar 248 (`w-sidebar`) · header 64 (`h-header`) · page padding 16 / 24 (sm) / 32 (xl) (`px-page`, `.rv-page-x`).

Type scale (`text-*`): `title` 26 (`.rv-page-title`) · `section` 17 (`.rv-section-title`) · `card-title` 15 (`.rv-card-title`) · `body` 14 · `body-sm` 13 · `label` 12.5 (`.rv-label`) · `helper` 12 (`.rv-helper`) · `metric` 26 for metric values. No arbitrary `text-[Npx]`; nothing below 12px. Numbers: add `tnum`.

Motion: 120-180ms on colour, transform and opacity only; buttons press at `scale(0.98)`; everything honours `prefers-reduced-motion`. Shadows: `shadow-card`, `shadow-pop` only. Focus: 2px `ring` outline on every interactive element.

## 3. Components (import from `@/components/ui/*`)

| Need | Use |
|---|---|
| Page title + one primary action | `PageHeader` (`@/components/shell/page-header`): `title`, `subtitle?`, `breadcrumb?`, `meta?`, `actions?`, `tabs?` |
| Route tabs / in-page tabs | `LinkTabs` (deep-linkable, active from URL) · `Tabs` (state; panels as `content`) |
| Cards | `Card` (`variant`: content, metric, chart, action, alert), `CardHeader({title, subtitle, info, actions})`, `CardBody`, `Section`, `KeyValue`, `Callout`; ready-made `ChartCard` |
| Metrics | `Metric`, `MetricGrid` + `MetricCell` |
| Status | `Status kind value` (adds kind `demo`: `Demo`, `Simulated`), `Badge`, `DemoBadge`, `SimulatedBadge`, `Chip`. Always icon + label |
| Buttons | `Button` (variants `primary|secondary|ghost|danger|danger-ghost`, sizes `sm|md|lg`, `icon`, `loading`), `ButtonLink`, `IconButton` (needs `label`) |
| Forms | `Field` (render-prop gives `id`, `describedBy`, `invalid`), `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Segmented`, `RadioCards`, `SearchField` |
| Tables | `DataTable` (search, filters, sort, selection, pagination, empty state). Columns: `{id, header, cell, sort?, align?, width?, hideBelow?}` |
| Overlays | `Dialog`, `ConfirmDialog` (destructive / external writes), `Drawer`, `Menu`, `Tooltip`, `useToast()` |
| Feedback | `EmptyState` (one next action), `ErrorState`, `Skeleton*`, `Progress`, `Stepper`, `Spinner` |
| Multi-step flow | `WizardFrame` (`@/components/ui/wizard`) |
| Misc | `Breadcrumb`, `Timeline`, `DiffView`, `HighlightedText`, `Mono` |
| Charts (`@/components/charts/*`) | `LineChart` (one y axis from 0, legend + direct labels, sample counts under the x axis, tooltip with n/d, arrow-key points, data table), `BarCompare` (0-100% axis, baseline hatched, pp change), `StackedBar`, `HeatStrip` (glyph + tone), `Sparkline`; states `ChartEmpty`, `ChartSkeleton`, `ChartError` (`chart-states.tsx`) |
| AI answers | `ResponseInspector`, `ResponseButton` (`@/features/responses/response-inspector`) |
| Layout | `SplitLayout` (main + 320px aside) |

Chart rules: series colours only from `series-*`; every series also gets its own dash and marker shape; text never takes the series colour; rates show numerator/denominator and sample size; changes in rates are "pp", never "%"; failed or missing data is "No data", never 0.

User-facing wording lives in `src/lib/labels.ts` (`PLATFORM_LABEL`, `SITE_TYPE_ORDER`, `siteTypeLabel`): "Website" / "Websites & Brands", site type is one option among many. Status vocabulary lives in `src/lib/status.ts`.

Row actions: `Menu` with an `IconButton icon="more" label="Row actions"` trigger. Destructive: `ConfirmDialog` stating exactly what happens.

## 4. Page recipe

```tsx
// src/app/stores/[storeId]/<section>/page.tsx  — server component
import type { Metadata } from "next";
import { notFound } from "next/navigation";
export const metadata: Metadata = { title: "Prompts" };
export async function generateStaticParams() { return storeIds(); }       // from "@/services/core"
export default async function Page(props: PageProps<"/stores/[storeId]/prompts">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId); if (!store) notFound();
  const data = await listThings(storeId);                                // from your module service
  if (data.length === 0) return <><PageHeader … /><EmptyState … action={<ButtonLink …/>} /></>;
  return (<><PageHeader title="…" actions={<ButtonLink variant="primary" …/>} />…</>);
}
```
Interactive parts live in `src/features/<module>/*.tsx` marked `"use client"`, receive serializable props, and never import from `src/demo`. Detail routes (`…/[auditId]`) need `generateStaticParams` returning `{storeId, auditId}` pairs, and `notFound()` for unknown ids.

Stores without data (`runpro-ae`, `homefit-uk`) must show a designed `EmptyState` with one clear next action, not an error. Full data exists for `runpro-pk` only.

## 5. File ownership (avoid collisions)

Each module owns: `src/app/stores/[storeId]/<its routes>`, `src/features/<module>/`, `src/types/<module>.ts`, `src/demo/<module>.ts`, `src/services/<module>.ts`. Do **not** edit shared files (`src/components/ui/*`, `src/components/shell/*`, `src/components/charts/*`, `src/lib/*`, `src/types/core.ts`, `src/types/shared-records.ts`, `src/demo/shared*.ts`, `src/demo/registry.ts`, `src/services/core.ts`, `src/services/records.ts`, `globals.css`). If you need a new reusable primitive, add a NEW file under `src/components/ui/` and say so in your report. If a shared component has a bug or missing prop, report it instead of editing.

## 6. Verify (do not run `next build` or a dev server — the lead does that)

```bash
npx next typegen        # once, after adding routes
npx tsc --noEmit        # filter output to your own files; other modules are being written in parallel
npm run lint            # same
```
Lint rules to respect: no refs read during render, no `setState` directly inside effects, no unused vars, `<Link>` not `<a>` for internal navigation.
