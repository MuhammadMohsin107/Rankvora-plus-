/** Types for the Comparison and Reports modules. */
import type { Rate, SearchMode } from "@/types/core";
import type { ResponseOutcome, ResponseSample } from "@/types/shared-records";

/**
 * The four comparison types offered by the wizard. "platform" is a legacy value some saved records
 * carry; prompt, platform and competitor views are breakdown tabs and scope filters, not types.
 */
export type ComparisonType = "snapshot_vs_snapshot" | "period_vs_period" | "initial_vs_latest" | "before_after_fixes" | "platform";

export type Comparability = "comparable" | "partially_comparable" | "comparable_with_warnings" | "not_comparable" | "insufficient_data";
export type ComparisonStatusValue = "completed" | "completed_with_warnings" | "partially_comparable" | "not_comparable" | "insufficient_data";
export type AggregationPolicy = "matched_slot_macro" | "pooled";
export type SampleStatus = "ok" | "directional" | "insufficient";

/** Minimal facts about one response slot: enough to match slots across two sources. */
export type SlotCore = {
  storeId: string;
  /** Audit id (aud-…) or monitoring run id (run-…). */
  runId: string;
  promptId: string;
  promptVersion: number;
  groupId: string | null;
  /** Prompt topic, when the prompt has one. */
  topic?: string | null;
  channelId: string;
  model: string;
  sample: number;
  market: string;
  language: string;
  searchMode: SearchMode;
  /** false = the request failed (never counted as brand absent). */
  ok: boolean;
  mentioned: boolean;
  analysisVersion: string;
};

/** A slot with everything the metrics need. */
export type SlotRow = SlotCore & {
  responseId: string;
  outcome: ResponseOutcome;
  recommended: boolean;
  sentiment: ResponseSample["sentiment"];
  citationSupport: ResponseSample["citationSupport"];
  ownedCited: boolean;
  domains: string[];
  urls: { url: string; title: string; domain: string }[];
  competitors: string[];
  quote: string | null;
  failureClass: string | null;
  requestedAt: string;
};

export type ComparisonFilters = {
  groupId?: string;
  topic?: string;
  promptId?: string;
  /** One provider API + model + search mode. */
  channelId?: string;
  /** Every channel of one provider (used when no single model is chosen). */
  channelIds?: string[];
  market?: string;
  language?: string;
  competitorId?: string;
  domain?: string;
};

/** Where one side of a comparison comes from. */
export type SideInfo = {
  label: string;
  /** Snapshot ids (snap-…) or a date window. */
  reference: string;
  kind: "audit" | "monitoring" | "mixed";
  runIds: string[];
  from: string;
  to: string;
  brand: string;
};

export type SnapshotRef = {
  snapshotId: string;
  sourceId: string;
  kind: "audit" | "monitoring";
  title: string;
  date: string;
};

export type ExclusionReason = "failed_baseline" | "failed_current" | "failed_both" | "model_changed";
export type UnmatchedReason = "version_changed" | "search_mode_changed" | "locale_differs" | "not_run";

export type SlotLabel = {
  key: string;
  promptId: string;
  promptVersion: number;
  channelId: string;
  sample: number;
};

export type UnmatchedSlot = SlotLabel & { presentOn: "baseline" | "current"; reason: UnmatchedReason; detail: string };
export type ExcludedSlot = SlotLabel & { reason: ExclusionReason; detail: string };

export type CheckState = "pass" | "warn" | "fail";
export type Check = {
  id: string;
  kind: "hard" | "soft";
  state: CheckState;
  /** Major soft warnings cap the verdict at "partially comparable". */
  severity?: "major" | "minor";
  label: string;
  detail: string;
};

export type MetricResult = {
  id: string;
  label: string;
  unit: string;
  info?: string;
  /**
   * Integer counts of the matched cohort (every successful response counted once). Never fractional.
   * Under the "average" basis the headline rate is `baselineRate`, not n / d.
   */
  baseline: Rate | null;
  current: Rate | null;
  /** Same integer counts as baseline / current, kept for older readers. */
  pooledBaseline: Rate | null;
  pooledCurrent: Rate | null;
  /** "average": headline rate is the mean of per-slot rates. "pooled": headline rate is n / d. */
  basis: "average" | "pooled";
  /** Headline rates as fractions 0 to 1 (null when not available). */
  baselineRate: number | null;
  currentRate: number | null;
  /** Matched slots that qualify for this metric. */
  cohort: number;
  pointChange: number | null;
  relativeChange: number | null;
  zeroBaseline: boolean;
  countChange: number | null;
  denominatorChange: number | null;
  baselineCi: [number, number] | null;
  currentCi: [number, number] | null;
  sample: SampleStatus;
  /** Why the metric is N/A (never shown as 0%). */
  na?: string;
  goodWhen: "up" | "down";
};

export type PairSummary = {
  n: number;
  d: number;
  recommended: number;
  /** Responses citing the owned domain, out of `citationD` responses that returned citation data. */
  cited: number;
  citationD: number;
  failed: number;
  outcome: ResponseOutcome | null;
  latestResponseId: string | null;
};

export type PairRow = SlotLabel & {
  promptText: string;
  channelLabel: string;
  baseline: PairSummary;
  current: PairSummary;
  /** Mention change between the two sides. */
  change: "gained" | "lost" | "unchanged";
  recommendationChange: "gained" | "lost" | "unchanged";
  citationChange: "gained" | "lost" | "unchanged" | "n/a";
};

export type PairRowWithResponses = PairRow & { baselineResponse: ResponseSample | null; currentResponse: ResponseSample | null };

export type ChannelSegment = {
  channelId: string;
  label: string;
  matchedPairs: number;
  mention: MetricResult;
  recommendation: MetricResult;
  citation: MetricResult;
  baselineModels: string[];
  currentModels: string[];
  modelChanged: boolean;
};

export type PromptSegment = {
  promptId: string;
  text: string;
  versions: number[];
  matchedPairs: number;
  mention: MetricResult;
};

export type SideQuality = {
  label: string;
  attempted: Rate;
  success: Rate;
  failedByClass: { cls: string; count: number }[];
};

export type SentimentCounts = { positive: number; neutral: number; negative: number; mixed: number; unknown: number; total: number };

export type DomainRow = { domain: string; source: "owned" | "competitor" | "third_party"; baseline: Rate; current: Rate };

export type UrlRow = { url: string; title: string; domain: string; baseline: Rate; current: Rate };

export type TrendPoint = { runId: string; side: "baseline" | "current"; at: string; mention: Rate; recommendation: Rate };

export type ComparisonResult = {
  verdict: Comparability;
  aggregation: AggregationPolicy;
  matchedPairs: number;
  baselineSlots: number;
  currentSlots: number;
  /** matched pairs ÷ the larger side's slot count. */
  coverage: Rate;
  checks: Check[];
  headline: MetricResult[];
  competitors: MetricResult[];
  channels: ChannelSegment[];
  prompts: PromptSegment[];
  promptCoverage: Rate;
  successRate: MetricResult;
  matchedRows: PairRow[];
  unmatched: UnmatchedSlot[];
  excluded: ExcludedSlot[];
  quality: { baseline: SideQuality; current: SideQuality };
  sentiment: { baseline: SentimentCounts; current: SentimentCounts; excerpts: { key: string; promptText: string; channelLabel: string; baselineQuote: string | null; currentQuote: string | null; baselineSentiment: string; currentSentiment: string }[] };
  domains: DomainRow[];
  urls: UrlRow[];
  competitorAppeared: string[];
  competitorGone: string[];
  trend: TrendPoint[];
  /** Whole-source totals (not matched cohort) for reconciliation with the source headline. */
  wholeSource: { baseline: Rate; current: Rate };
  /** Distinct run ids per side. */
  runs: { baseline: string[]; current: string[] };
};

/** What a created comparison is made of. It is encoded into the comparison id, so any id can be recomputed. */
export type ComparisonDefinition = {
  type: ComparisonType;
  /** Snapshot id or a date window ("2026-10-01 – 2026-10-31"). */
  baseline: string;
  current: string;
  filters: ComparisonFilters;
  aggregation: AggregationPolicy;
  /** Fix task for before-after comparisons. */
  taskId?: string;
};

export type ComparisonRecord = {
  id: string;
  /** Website the comparison belongs to (route segment). */
  storeId: string;
  title: string;
  type: ComparisonType;
  baseline: string;
  current: string;
  filters: ComparisonFilters;
  aggregation: AggregationPolicy;
  taskId?: string;
  status: ComparisonStatusValue;
  comparability: Comparability;
  createdAt: string;
  createdBy: string;
  methodologyVersion: string;
  /** Report generated from this comparison, when one exists. */
  reportId: string | null;
  /** Archived comparisons stay readable and keep their history. */
  archived: boolean;
  /** Matched slots out of the larger side, shown in the list. */
  matched: Rate | null;
  /** True for comparisons created in this browser (demo-state). */
  simulated?: boolean;
};

export type FixTimelineItem = {
  taskId: string;
  title: string;
  status: string;
  priority: string;
  findingId: string;
  findingTitle: string;
  dueAt: string | null;
  /** When the task was completed (applied, published or marked complete). Null when not completed. */
  completedAt: string | null;
  /** The date the item is placed by on the timeline: completion date, else the due date. */
  placedAt: string;
  placedBy: "completed" | "due";
  /** Run or audit that verified the task, when it was verified. */
  verificationId: string | null;
  /** Completed (applied / published / verification stage) vs not. */
  completed: boolean;
  before: { runId: string; date: string; rate: Rate } | null;
  after: { runId: string; date: string; rate: Rate } | null;
};

export type ComparisonDetail = {
  record: ComparisonRecord;
  baseline: SideInfo;
  current: SideInfo;
  filters: ComparisonFilters;
  result: ComparisonResult;
  fixes: FixTimelineItem[];
  rangeFrom: string;
  rangeTo: string;
};

/** Static copy and presets for the wizard (from services, never imported from demo in client code). */
export type WizardCatalog = {
  types: { value: ComparisonType; label: string; short: string }[];
  presets: Record<ComparisonType, { baseline: string; current: string }>;
  aggregation: Record<AggregationPolicy, string>;
  windows: { id: string; label: string; from: string; to: string }[];
  matching: string;
};

/** What the wizard needs to run the compatibility preview live. */
export type WizardData = {
  snapshots: SnapshotRef[];
  cores: Record<string, SlotCore[]>;
  prompts: { id: string; text: string; groupId: string | null; topic: string | null }[];
  groups: { id: string; name: string }[];
  topics: string[];
  channels: { id: string; label: string; provider: string; providerLabel: string; model: string }[];
  /** Fix tasks that were completed, for before-after comparisons. */
  tasks: { id: string; title: string; completedAt: string }[];
  competitors: { id: string; name: string }[];
  domains: string[];
  markets: string[];
  languages: string[];
  /** Existing comparisons, so the wizard can say "this comparison already exists". */
  registry: { id: string; baseline: string; current: string }[];
  brand: string;
};

/** Reports */
export type ReportStatus = "ready" | "generating" | "failed";
export type ReportType = "audit" | "monitoring" | "comparison";

export type ReportRecord = {
  id: string;
  /** Set on reports created in this browser, so they appear under the right website. */
  storeId?: string;
  type: ReportType;
  title: string;
  sourceId: string;
  period: string;
  createdAt: string;
  version: string;
  status: ReportStatus;
  sourceHref: string;
  sourceLabel: string;
};

export type HistoricalRecord = {
  id: string;
  kind: "audit" | "monitoring" | "comparison";
  title: string;
  at: string;
  status: string;
  snapshotId: string | null;
  href: string;
  reportId: string | null;
};

export type ChannelRates = {
  id: string;
  label: string;
  mention: Rate;
  recommendation: Rate;
  /** null = provider does not return citation data. */
  citation: Rate | null;
  failed: number;
};

export type AuditReportData = {
  kind: "audit";
  audit: {
    id: string;
    title: string;
    type: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    snapshotId: string | null;
    plannedJobs: number;
    succeededJobs: number;
    failedJobs: number;
    findingsCreated: number;
    pages: Rate | null;
    createdBy: string;
    mention: Rate | null;
    recommendation: Rate | null;
  };
  channels: ChannelRates[];
  failedByClass: { cls: string; count: number }[];
  findings: { id: string; title: string; severity: string; priority: string; status: string; category: string; lane: string }[];
  tasks: { id: string; title: string; status: string; priority: string; findingId: string }[];
  evidence: ResponseSample[];
};

export type MonitoringEvent = { id: string; kind: "new_mention" | "lost_mention" | "new_recommendation" | "recommendation_lost"; promptText: string; channelLabel: string };

export type MonitoringReportData = {
  kind: "monitoring";
  run: {
    id: string;
    scheduleId: string;
    scheduledFor: string;
    status: string;
    plannedJobs: number;
    succeededJobs: number;
    failedJobs: number;
    costUsd: number;
    snapshotId: string;
  };
  previousRunId: string | null;
  mention: { current: Rate; previous: Rate | null };
  recommendation: { current: Rate; previous: Rate | null };
  citation: { current: Rate | null; previous: Rate | null };
  channels: (ChannelRates & { previousMention: Rate | null })[];
  events: MonitoringEvent[];
  alerts: { id: string; severity: string; title: string; at: string }[];
  usage: { requests: number; inputTokens: number; outputTokens: number; searchCalls: number; costUsd: number };
  failedByClass: { cls: string; count: number }[];
};

export type ReportData = AuditReportData | MonitoringReportData | { kind: "comparison"; comparisonId: string };
