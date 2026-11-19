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
