/**
 * DEMONSTRATION DATA — not real. Static catalogs and copy for the Comparison and
 * Reports modules. Numbers are never stored here: they are computed from the
 * generated response samples by the comparison engine.
 */
import type { ComparisonType } from "@/types/comparison";

export type ComparisonTypeInfo = {
  value: ComparisonType;
  label: string;
  short: string;
  /** Opens on this tab of the finished comparison. */
  landing: "" | "platforms" | "prompts" | "competitors";
  /** Not runnable from the wizard. */
  portfolio?: boolean;
};

export const COMPARISON_TYPES: ComparisonTypeInfo[] = [
  { value: "snapshot_vs_snapshot", label: "Snapshot vs snapshot", short: "Two audit or monitoring snapshots.", landing: "" },
  { value: "period_vs_period", label: "Period vs period", short: "Two date windows of monitoring runs.", landing: "" },
  { value: "initial_vs_latest", label: "Initial audit vs latest monitoring", short: "Where you started against today.", landing: "" },
  { value: "before_after_fixes", label: "Before vs after fixes", short: "Two snapshots around completed tasks.", landing: "" },
  { value: "prompt_topic", label: "Prompt or topic", short: "Which prompts moved. Opens on Prompts.", landing: "prompts" },
  { value: "platform", label: "Platform", short: "Provider and model segments. Opens on Platforms.", landing: "platforms" },
  { value: "brand_vs_competitors", label: "Brand vs competitors", short: "Same-cohort competitor view.", landing: "competitors" },
  { value: "store_portfolio", label: "Store portfolio", short: "Compared on the Portfolio page.", landing: "", portfolio: true },
];

export const TYPE_LABEL: Record<ComparisonType, string> = Object.fromEntries(COMPARISON_TYPES.map((t) => [t.value, t.label])) as Record<ComparisonType, string>;

export type StoreComparisonConfig = {
  /** Brand domains for classifying cited domains. */
  ownedDomains: string[];
  competitorDomains: string[];
  /** Which saved comparison the wizard opens for each type when no saved comparison matches exactly. */
  defaultTargets: Record<ComparisonType, string>;
  /** Suggested starting selections per type (snapshot ids or windows). */
  presets: Record<ComparisonType, { baseline: string; current: string }>;
  windows: { id: string; label: string; from: string; to: string }[];
};

const PK_CONFIG: StoreComparisonConfig = {
  ownedDomains: ["runpro.pk"],
  competitorDomains: ["brandx.example", "swiftstride.example", "trailmate.example"],
  defaultTargets: {
    snapshot_vs_snapshot: "cmp-004",
    period_vs_period: "cmp-002",
    initial_vs_latest: "cmp-001",
    before_after_fixes: "cmp-003",
    prompt_topic: "cmp-004",
    platform: "cmp-001",
    brand_vs_competitors: "cmp-001",
    store_portfolio: "cmp-001",
  },
  presets: {
    snapshot_vs_snapshot: { baseline: "snap-aud-001", current: "snap-aud-002" },
    period_vs_period: { baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19" },
    initial_vs_latest: { baseline: "snap-aud-001", current: "snap-mon-008" },
    before_after_fixes: { baseline: "snap-aud-002", current: "snap-aud-003" },
    prompt_topic: { baseline: "snap-aud-001", current: "snap-aud-002" },
    platform: { baseline: "snap-aud-001", current: "snap-mon-008" },
    brand_vs_competitors: { baseline: "snap-aud-001", current: "snap-mon-008" },
    store_portfolio: { baseline: "snap-aud-001", current: "snap-mon-008" },
  },
  windows: [
    { id: "oct", label: "October 2026", from: "2026-10-01", to: "2026-10-31" },
    { id: "nov", label: "November 2026 (to 19 Nov)", from: "2026-11-01", to: "2026-11-19" },
    { id: "sep-oct", label: "29 Sep – 20 Oct", from: "2026-09-29", to: "2026-10-20" },
  ],
};

const AE_CONFIG: StoreComparisonConfig = {
  ownedDomains: ["runpro.ae"],
  competitorDomains: ["gulfrun.example", "desertrun.example", "brandx.example", "swiftstride.example"],
  defaultTargets: {
    snapshot_vs_snapshot: "cmp-ae-003",
    period_vs_period: "cmp-ae-002",
    initial_vs_latest: "cmp-ae-001",
    before_after_fixes: "cmp-ae-004",
    prompt_topic: "cmp-ae-003",
    platform: "cmp-ae-001",
    brand_vs_competitors: "cmp-ae-001",
    store_portfolio: "cmp-ae-001",
  },
  presets: {
    snapshot_vs_snapshot: { baseline: "snap-aud-ae-001", current: "snap-aud-ae-002" },
    period_vs_period: { baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19" },
    initial_vs_latest: { baseline: "snap-aud-ae-001", current: "snap-mon-ae-006" },
    before_after_fixes: { baseline: "snap-aud-ae-001", current: "snap-aud-ae-003" },
    prompt_topic: { baseline: "snap-aud-ae-001", current: "snap-aud-ae-002" },
    platform: { baseline: "snap-aud-ae-001", current: "snap-mon-ae-006" },
    brand_vs_competitors: { baseline: "snap-aud-ae-001", current: "snap-mon-ae-006" },
    store_portfolio: { baseline: "snap-aud-ae-001", current: "snap-mon-ae-006" },
  },
  windows: [
    { id: "oct", label: "October 2026", from: "2026-10-01", to: "2026-10-31" },
    { id: "nov", label: "November 2026 (to 19 Nov)", from: "2026-11-01", to: "2026-11-19" },
    { id: "early-oct", label: "14 – 21 Oct", from: "2026-10-14", to: "2026-10-21" },
  ],
};

/** A store with no audits or monitoring runs has nothing to compare: no domains, presets or windows. */
const EMPTY_CONFIG: StoreComparisonConfig = {
  ownedDomains: [],
  competitorDomains: [],
  defaultTargets: PK_CONFIG.defaultTargets,
  presets: PK_CONFIG.presets,
  windows: [],
};

const COMPARISON_CONFIG: Record<string, StoreComparisonConfig> = { "runpro-pk": PK_CONFIG, "runpro-ae": AE_CONFIG };

export function comparisonConfigFor(storeId: string): StoreComparisonConfig {
  return COMPARISON_CONFIG[storeId] ?? EMPTY_CONFIG;
}

/** Tasks in these states count as completed (applied or later). */
export const COMPLETED_TASK_STATES = ["applied", "published", "verification_pending", "verified_success", "partially_verified"];

export const METHODOLOGY = {
  version: "1.0",
  analysisVersion: "1.2",
  matching: "Strict exact: prompt id + prompt version + channel + sample + market + language + search mode.",
  aggregation: {
    matched_slot_macro: "Matched-slot macro average: each matched slot counts once with its own rate across the runs in the window.",
    pooled: "Pooled: every successful response in the matched cohort counts once.",
  },
  rules: [
    "Metrics use the matched cohort only. Unmatched and excluded slots are listed, never merged in.",
    "Failed requests are excluded and reported. They are never counted as the brand being absent.",
    "A slot where the model differs is excluded, not merged.",
    "Headline trends need at least 20 matched pairs. Below that the result is directional or insufficient.",
    "Percentage-point change compares the two rates. Relative change is N/A when the baseline is zero (shown as new from zero).",
    "95% intervals are Wilson score intervals on the numerator and denominator shown.",
  ],
  verdict: [
    "Not comparable: any hard check fails (store, brand, metric definitions, source overlap, no data).",
    "Insufficient data: fewer than 20 matched pairs.",
    "Partially comparable: a major difference (run type, model, search mode, market or language) or coverage below 60%.",
    "Comparable with warnings: coverage 60–74%.",
    "Comparable: coverage 75% or more.",
  ],
};

export const COMPARISON_LIMITATIONS = [
  "API answer samples differ from consumer apps and can change between requests.",
  "Excluded and unmatched slots can hide changes.",
  "Differences are context, not proof. Visibility changed after a task was completed does not mean the task caused it.",
  "Providers without citation support are N/A for citation metrics.",
];

export const AUDIT_REPORT_LIMITATIONS = [
  "AI results are API answer samples (provider API, model, search mode shown with each result). They may differ from consumer apps.",
  "Failed requests are excluded from rates and reported separately.",
  "Website readiness reflects the pages crawled within the configured limits. Lab measurements are not field data.",
  "Findings marked with medium or low confidence need review before action.",
];

export const MONITORING_REPORT_LIMITATIONS = [
  "A single run is a sample. Week-to-week changes of a few points are within normal variation.",
  "Failed requests are excluded from rates and reported separately.",
  "Providers without citation support are N/A for citation metrics.",
  "Events compare this run with the previous run on matching slots only.",
];
