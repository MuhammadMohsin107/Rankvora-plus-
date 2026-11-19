# Rankvora Plus — design system & build rules

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
8. **Org vs store.** Org pages show no store nav; store pages live under `/stores/[storeId]/…` and the shell already shows the store context. Roll-ups are labelled "pooled" or "unweighted".
9. **Demo data** only via `src/services/*` reading `src/demo/*`. Fixed timestamps only (`DEMO_NOW = 2026-11-19T09:00:00Z`). **Never** call `new Date()` (no args), `Date.now()`, `Math.random()`, `crypto.randomUUID()` during render — Next 16 Cache Components fails the build. Use `formatRelative(iso)` / `formatDateTime(iso, tz)` from `src/lib/format.ts`.
10. **Registry is law.** `src/demo/registry.ts` fixes ids, titles, dates, statuses and headline numbers for audits, runs, schedules, comparisons, tasks, reports; `src/demo/shared-records.ts` has findings and the response generator. Use them. Add detail around them; never contradict them.
11. **Tailwind CSS 4 only.** No UI libraries, no icon libraries, no chart libraries, no extra npm packages. Use semantic tokens (`bg-surface`, `text-fg-muted`, `border-line`, `bg-accent`, `text-danger`…). **No raw hex, no arbitrary colours.**
12. **Grids:** always start with a `grid-cols-[minmax(0,1fr)]` base (`grid grid-cols-[minmax(0,1fr)] md:grid-cols-2`), otherwise cards overflow on mobile. Every flex child that holds text needs `min-w-0` + `truncate` or wrapping. No horizontal page scroll at 375px.
13. **Accessibility:** labelled inputs (use `Field`), visible focus (global), 4.5:1 text contrast (tokens already comply), icon-only buttons need `label`, tables via `DataTable`, one `h1` per page (`PageHeader`), headings in order.
14. **Next.js 16.** Read `node_modules/next/dist/docs/` before unfamiliar APIs (`AGENTS.md`). `params` is a Promise. Cache Components is on: every dynamic route segment needs `generateStaticParams` returning all demo ids (parent + child params together), or `notFound()` for unknown ids. Use `PageProps<'/stores/[storeId]/…'>` for typing. Do not use `export const dynamic`.

## 2. Tokens (see `src/app/globals.css`)

Surfaces: `canvas` (page) · `surface` (cards) · `surface-2/3` (subtle fills). Lines: `line`, `line-strong`. Text: `fg`, `fg-muted`, `fg-subtle`. Accent: `accent`, `accent-soft`, `accent-text`, `accent-fg`. Semantic: `success|warning|danger|info` + `-soft`. Chart: `series-1…5`, `grid`. Radius: `rounded-control` (8px), `rounded-card` (12px). Shadows: `shadow-card`, `shadow-pop`. Numbers: add class `tnum`. Spacing on a 4px grid; page padding is handled by the shell. Motion: 120–180ms only, honours reduced motion.

## 3. Components (import from `@/components/ui/*`)

| Need | Use |
|---|---|
| Page title + one primary action | `PageHeader` (`@/components/shell/page-header`): `title`, `subtitle?`, `breadcrumb?`, `meta?`, `actions?`, `tabs?` |
| Route tabs / in-page tabs | `LinkTabs` (deep-linkable, active from URL) · `Tabs` (state; panels as `content`) |
| Cards | `Card`, `CardHeader({title, subtitle, info, actions})`, `CardBody`, `Section`, `KeyValue`, `Callout` |
| Metrics | `Metric`, `MetricGrid` + `MetricCell` |
| Status | `Status kind value`, `Badge`, `StatusDot`, `Chip` |
| Buttons | `Button` (variants `primary|secondary|ghost|danger|danger-ghost`, `icon`, `loading`), `ButtonLink`, `IconButton` (needs `label`) |
| Forms | `Field` (render-prop gives `id`, `describedBy`, `invalid`), `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Segmented`, `RadioCards`, `SearchField` |
| Tables | `DataTable` — built-in search, filters, sort, selection, bulk actions, pagination, empty state. Columns: `{id, header, cell, sort?, align?, width?, hideBelow?}` |
| Overlays | `Dialog`, `ConfirmDialog` (destructive / external writes), `Drawer` (detail panels), `Menu` (actions), `Tooltip`, `useToast()` |
| Feedback | `EmptyState` (one next action), `ErrorState`, `Skeleton*`, `Progress`, `Stepper`, `Spinner` |
| Multi-step flow | `WizardFrame` (`@/components/ui/wizard`) — use for every wizard |
| Misc | `Breadcrumb`, `Timeline`, `DiffView` (before/after), `HighlightedText`, `Mono` |
| Charts (`@/components/charts/*`) | `LineChart` (multi-series, markers, tooltip, table fallback), `BarCompare` (baseline vs current, n/d, CI), `StackedBar`, `HeatStrip`, `Sparkline` |
| AI answers | `ResponseInspector`, `ResponseButton` (`@/features/responses/response-inspector`) — the only way to show a response |
| Layout | `SplitLayout` (main + 320px aside) |

Row actions: `Menu` with an `IconButton icon="more" label="Row actions"` trigger. Destructive → `ConfirmDialog` stating exactly what happens.

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
