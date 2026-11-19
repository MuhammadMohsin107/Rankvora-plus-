/** CSV builders for comparison exports. Pure, so they can run on the server or in the browser. */
import { REASON_LABEL } from "@/features/comparison/engine";
import type { ComparisonResult, MetricResult } from "@/types/comparison";

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const num = (v: number | null, digits = 2) => (v === null ? "" : Number(v.toFixed(digits)));

/** One row per slot: matched, unmatched and excluded, so nothing is hidden. */
export function rowLevelCsv(result: ComparisonResult): string {
  const header = [
    "status",
    "reason",
    "prompt_id",
    "prompt_version",
    "provider_model_search_mode",
    "sample",
    "baseline_mentioned",
    "baseline_successful",
    "baseline_recommended",
    "current_mentioned",
    "current_successful",
    "current_recommended",
    "mention_change",
    "baseline_response_id",
    "current_response_id",
  ];
  const matched = result.matchedRows.map((r) => [
    "matched",
    "",
    r.promptId,
    r.promptVersion,
    r.channelLabel,
    r.sample,
    r.baseline.n,
    r.baseline.d,
    r.baseline.recommended,
    r.current.n,
    r.current.d,
    r.current.recommended,
    r.change,
    r.baseline.latestResponseId,
    r.current.latestResponseId,
  ]);
  const unmatched = result.unmatched.map((u) => ["unmatched", `${REASON_LABEL[u.reason]} (${u.detail})`, u.promptId, u.promptVersion, u.channelId, u.sample, "", "", "", "", "", "", "", "", ""]);
  const excluded = result.excluded.map((e) => ["excluded", `${REASON_LABEL[e.reason]} (${e.detail})`, e.promptId, e.promptVersion, e.channelId, e.sample, "", "", "", "", "", "", "", "", ""]);
  return toCsv(header, [...matched, ...unmatched, ...excluded]);
}

function metricRow(m: MetricResult, aggregation: string): (string | number)[] {
  return [
    m.id,
    m.label,
    aggregation,
    m.baseline ? m.baseline.n : "N/A",
    m.baseline ? m.baseline.d : "N/A",
    m.current ? m.current.n : "N/A",
    m.current ? m.current.d : "N/A",
    num(m.pointChange),
    m.zeroBaseline ? "new from zero" : m.relativeChange === null ? "N/A" : num(m.relativeChange),
    m.countChange ?? "N/A",
    m.denominatorChange ?? "N/A",
    m.baselineCi ? num(m.baselineCi[0]) : "",
    m.baselineCi ? num(m.baselineCi[1]) : "",
    m.currentCi ? num(m.currentCi[0]) : "",
    m.currentCi ? num(m.currentCi[1]) : "",
    m.cohort,
    m.sample,
  ];
}

export function aggregateCsv(result: ComparisonResult): string {
  const header = [
    "metric_id",
    "metric",
    "aggregation",
    "baseline_numerator",
    "baseline_denominator",
    "current_numerator",
    "current_denominator",
    "point_change_pp",
    "relative_change_pct",
    "count_change",
    "denominator_change",
    "baseline_ci_low",
    "baseline_ci_high",
    "current_ci_low",
    "current_ci_high",
    "matched_slots",
    "sample_status",
  ];
  const rows = [...result.headline, result.successRate, ...result.competitors].map((m) => metricRow(m, m.id === "share-of-voice" || m.id === "success-rate" ? "pooled" : result.aggregation));
  return toCsv(header, rows);
}
