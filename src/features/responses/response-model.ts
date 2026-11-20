/** Pure helpers for the response drawer. No React, no demo data. */
import type { EvidenceIds } from "@/features/evidence/chain";
import type { CitationSource, ResponseCitation, ResponseSample } from "@/types/shared-records";

export const API_SAMPLE_LABEL = "API answer sample, not a consumer-app result";

export type ConfidenceLevel = "high" | "medium" | "low";

/** Analysis confidence (0-1) as a level: 80% and above is high, 60% and above is medium, otherwise low. */
export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export const confidencePercent = (confidence: number) => Math.round(Math.min(1, Math.max(0, confidence)) * 100);

/** Citations split by who owns the source, in the order owned, competitor, third party. Empty groups are kept. */
export function groupCitations(citations: readonly ResponseCitation[]): { source: CitationSource; items: ResponseCitation[] }[] {
  return (["owned", "competitor", "third_party"] as const).map((source) => ({ source, items: citations.filter((c) => c.source === source) }));
}

/** How many highlighted spans of each kind the answer has (only spans that lie inside the text). */
export function spanCounts(response: Pick<ResponseSample, "answerText" | "brandSpans">): { brand: number; competitor: number } {
  const counts = { brand: 0, competitor: 0 };
  for (const span of response.brandSpans) {
    if (span.start < 0 || span.end <= span.start || span.end > response.answerText.length) continue;
    counts[span.kind] += 1;
  }
  return counts;
}

/** "Sample 2 of 3" when the other samples are known, otherwise "Sample 2". Samples are ordered by sample number. */
export function sampleLabel(response: Pick<ResponseSample, "sample">, samples?: readonly Pick<ResponseSample, "sample">[]): string {
  const total = samples && samples.length > 0 ? new Set(samples.map((s) => s.sample)).size : 0;
  return total > 1 ? `Sample ${response.sample} of ${total}` : `Sample ${response.sample}`;
}

/** Seconds between request and completion; null when the request has not completed. */
export function latencySeconds(response: Pick<ResponseSample, "requestedAt" | "completedAt">): number | null {
  if (!response.completedAt) return null;
  const ms = Date.parse(response.completedAt) - Date.parse(response.requestedAt);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 100) / 10 : null;
}

/** Same prompt, provider and run: the samples a reader can flip between. Sorted by sample number. */
export function siblingSamples(response: ResponseSample, all: readonly ResponseSample[]): ResponseSample[] {
  return all
    .filter((r) => r.runId === response.runId && r.promptId === response.promptId && r.channelId === response.channelId)
    .sort((a, b) => a.sample - b.sample);
}

/**
 * Evidence ids a response contributes: its run as the metric source, its prompt, itself, and the citation that matters
 * (the first owned one, else the first returned). `extra` adds finding, fix and so on.
 */
export function responseEvidenceIds(response: ResponseSample, extra: Partial<EvidenceIds> = {}): EvidenceIds {
  const citation = response.citations.find((c) => c.source === "owned") ?? response.citations[0];
  return {
    storeId: response.storeId,
    sourceId: response.runId,
    metricId: response.status === "succeeded" ? "mention-rate" : undefined,
    promptId: response.promptId,
    responseId: response.id,
    citation: citation?.domain,
    ...extra,
  };
}

export const REVIEW_FIELDS = [
  { value: "mention", label: "Brand mention" },
  { value: "recommendation", label: "Recommendation" },
  { value: "sentiment", label: "Sentiment" },
  { value: "ownership", label: "Citation ownership" },
  { value: "position", label: "Position" },
] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number]["value"];

/** A human review request stored next to the machine result. The machine result itself is never changed. */
export type ReviewRequest = { requested: boolean; field: ReviewField; reason: string; at: string | null };
export const NO_REVIEW: ReviewRequest = { requested: false, field: "mention", reason: "", at: null };

export const reviewSettingKey = (responseId: string) => `response.review.${responseId}`;
