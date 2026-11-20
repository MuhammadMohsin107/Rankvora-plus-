/** Records shared by Audit, Fixes, Monitoring, Comparison and Reports. */

export type FindingCategory = "technical" | "content" | "entity" | "schema" | "ai_visibility" | "product";
export type Severity = "critical" | "high" | "medium" | "low" | "informational";
export type Priority = "P0" | "P1" | "P2" | "P3";
export type Confidence = "high" | "medium" | "low";
export type FindingStatus =
  | "new"
  | "under_review"
  | "confirmed"
  | "in_remediation"
  | "awaiting_verification"
  | "verified_resolved"
  | "reopened"
  | "accepted_risk"
  | "false_positive";

export type Finding = {
  id: string;
  storeId: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  priority: Priority;
  confidence: Confidence;
  status: FindingStatus;
  /** Which assessment lane produced it. */
  lane: "ai_visibility" | "website_readiness";
  firstDetectedAt: string;
  lastObservedAt: string;
  /** Audit (aud-…) or monitoring run (run-…) that first detected it. */
  auditId: string;
  affectedUrls: string[];
  affectedPromptIds: string[];
  /** Observed condition vs what should be true. */
  expected: string;
  actual: string;
  recurrenceCount: number;
  taskIds: string[];
};

export type ResponseOutcome = "recommended" | "mentioned" | "absent" | "uncertain" | "failed";
export type ResponseStatus = "succeeded" | "failed";
export type CitationSource = "owned" | "competitor" | "third_party";

export type ResponseCitation = { url: string; title: string; domain: string; source: CitationSource };

export type ResponseSample = {
  id: string;
  storeId: string;
  runKind: "audit" | "monitoring";
  /** audit id (aud-…) or monitoring run id (run-…) */
  runId: string;
  promptId: string;
  promptVersion: number;
  promptText: string;
  channelId: string;
  providerLabel: string;
  model: string;
  searchMode: "model_only" | "web_grounded_required" | "web_grounded_auto";
  searchExecuted: boolean;
  market: string;
  language: string;
  sample: number;
  status: ResponseStatus;
  /** Present when status = failed. Failed ≠ brand absent. */
  failure?: { class: "timeout" | "rate_limit" | "provider_error" | "refusal"; message: string; attempts: number };
  outcome: ResponseOutcome;
  answerText: string;
  brandSpans: { start: number; end: number; kind: "brand" | "competitor" }[];
  brandMentioned: "yes" | "no" | "uncertain";
  recommendation: "recommended" | "merely_mentioned" | "not_recommended" | "unclear" | "none";
  sentiment: "positive" | "neutral" | "negative" | "mixed" | "unknown";
  /** 0–1 */
  confidence: number;
  evidenceQuote: string | null;
  /** Only for an explicit ordered list. */
  position: number | null;
  competitors: { id: string; name: string; mentioned: boolean }[];
  citations: ResponseCitation[];
  citationSupport: "returned" | "none_returned" | "not_supported";
  usage: { inputTokens: number; outputTokens: number; searchCalls: number };
  providerRequestId: string;
  rawPayloadRef: string;
  requestedAt: string;
  completedAt: string | null;
  analysisVersion: string;
};

// ---------------------------------------------------------------------------
// Evidence chain ids
// ---------------------------------------------------------------------------

export type EvidenceKind = "metric" | "prompt" | "response" | "citation" | "finding" | "fix" | "verification" | "observation" | "comparison";

/** Ids that identify one evidence chain. Every field except `storeId` is optional: a chain shows what exists. */
export type EvidenceIds = {
  /** Website id (route segment `/stores/{storeId}`). */
  storeId: string;
  /** Metric the evidence supports, e.g. "mention-rate". */
  metricId?: string;
  /** Audit (aud-...) or monitoring run (run-...) that produced the metric and the response. */
  sourceId?: string;
  promptId?: string;
  /** Response sample id: resp-{runId}-{n}. */
  responseId?: string;
  /** Cited domain or URL. */
  citation?: string;
  findingId?: string;
  /** Fixes task id (task-...). */
  taskId?: string;
  /** Audit or run that verified the fix. */
  verificationId?: string;
  /** Monitoring run id, or "{promptId}|{channelId}" observation key. */
  observationId?: string;
  comparisonId?: string;
  /** Replaces the default chip text per kind, for example a prompt's text or a finding's title. */
  labels?: Partial<Record<EvidenceKind, string>>;
};

// ---------------------------------------------------------------------------
// Reports: list rows and the document every export is generated from
// ---------------------------------------------------------------------------

export type ReportKind = "audit" | "monitoring" | "comparison";
export type ReportState = "ready" | "generating" | "failed";

/** One row of the reports list: seeded from the registry, or created in this browser (demo-state `reports`). */
export type ReportRow = {
  id: string;
  storeId: string;
  type: ReportKind;
  title: string;
  /** Audit, monitoring run or comparison id the report is built from. */
  sourceId: string;
  period: string;
  createdAt: string;
  version: string;
  status: ReportState;
  sourceHref: string;
  sourceLabel: string;
  /** Simulated generation window (created or retried locally): started and the time it becomes ready. */
  startedAt?: string;
  readyAt?: string;
  archived?: boolean;
};

/** A table cell: text, a number, a rate with numerator and denominator, or null for "not available". */
export type ReportCell = string | number | null | { n: number; d: number };

export type ReportTable = {
  id: string;
  title: string;
  columns: { id: string; label: string; kind: "text" | "number" | "rate"; align?: "left" | "right" }[];
  rows: Record<string, ReportCell>[];
};

export type ReportMetric = {
  id: string;
  label: string;
  /** Numerator and denominator are integers. null on both = not available (never zero). */
  n: number | null;
  d: number | null;
  /** The same rate for the previous run or the baseline side. */
  previous?: { n: number; d: number } | null;
  unit?: string;
  /** One short line: what the denominator counts. */
  basis?: string;
  naReason?: string;
};

export type ReportEvidenceItem = {
  id: string;
  title: string;
  note?: string;
  ids: EvidenceIds;
  /** The original answer, for the response drawer. Not part of exports. */
  response?: ResponseSample;
};

export type ReportDocument = {
  type: ReportKind;
  title: string;
  websiteName: string;
  period: string;
  /** Generation time of the seeded report; local reports show their own creation time. */
  generatedAt: string;
  /** Criteria, analysis or methodology version. */
  version: string;
  source: { id: string; label: string; href: string; snapshotIds: string[] };
  /** At most three short lines. */
  summary: string[];
  /** Comparison only: whether the two sides may be compared. */
  verdict?: { label: string; tone: "success" | "warning" | "danger" | "neutral" };
  metrics: ReportMetric[];
  tables: ReportTable[];
  /** What the numbers rest on: samples, failures, pages, prompts. */
  coverage: { label: string; n: number; d: number }[];
  scope: { label: string; value: string }[];
  evidence: ReportEvidenceItem[];
  limitations: string[];
  methodology: string[];
};
