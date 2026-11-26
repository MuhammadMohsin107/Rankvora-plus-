/**
 * Builders for every comparison export: row-level CSV, metric CSV, JSON and a standalone HTML report.
 * Pure (strings in, strings out), so they run on the server, in the browser and in tests. One builder per
 * format: the export menu, the list and the Reports module all use these.
 */
import { REASON_LABEL } from "@/features/comparison/engine";
import { basisText, countsText, percentText, pointsText, relativeText } from "@/features/comparison/metric-format";
import { formatShortDate } from "@/lib/format";
import type { ComparisonDetail, MetricResult } from "@/types/comparison";

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Prompt text and ids are user content: a cell that starts like a formula is neutralised with a leading quote. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const num = (v: number | null, digits = 2) => (v === null ? "" : Number(v.toFixed(digits)));

/** One row per slot: matched, unmatched and excluded, so nothing is hidden. */
export function rowLevelCsv(result: ComparisonDetail["result"]): string {
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
  const empty = ["", "", "", "", "", "", "", ""];
  const unmatched = result.unmatched.map((u) => ["unmatched", `${REASON_LABEL[u.reason]} (${u.detail})`, u.promptId, u.promptVersion, u.channelId, u.sample, ...empty]);
  const excluded = result.excluded.map((e) => ["excluded", `${REASON_LABEL[e.reason]} (${e.detail})`, e.promptId, e.promptVersion, e.channelId, e.sample, ...empty]);
  return toCsv(header, [...matched, ...unmatched, ...excluded]);
}

function metricRow(m: MetricResult): (string | number)[] {
  return [
    m.id,
    m.label,
    m.basis,
    m.baselineRate === null ? "N/A" : num(m.baselineRate * 100),
    m.currentRate === null ? "N/A" : num(m.currentRate * 100),
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

export function aggregateCsv(result: ComparisonDetail["result"]): string {
  const header = [
    "metric_id",
    "metric",
    "basis",
    "baseline_rate_pct",
    "current_rate_pct",
    "baseline_count",
    "baseline_total",
    "current_count",
    "current_total",
    "point_change_pp",
    "relative_change_pct",
    "count_change",
    "total_change",
    "baseline_ci_low_pct",
    "baseline_ci_high_pct",
    "current_ci_low_pct",
    "current_ci_high_pct",
    "matched_slots",
    "sample_status",
  ];
  return toCsv(header, [...result.headline, result.successRate, ...result.competitors].map(metricRow));
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function comparisonJson(detail: ComparisonDetail): string {
  const { result, record, baseline, current } = detail;
  return JSON.stringify(
    {
      comparison: record.id,
      title: record.title,
      type: record.type,
      methodologyVersion: record.methodologyVersion,
      verdict: result.verdict,
      aggregation: result.aggregation === "pooled" ? "pooled" : "average of matched slots",
      scope: detail.filters,
      coverage: result.coverage,
      matchedPairs: result.matchedPairs,
      sources: { baseline: baseline.reference, current: current.reference, runs: result.runs },
      checks: result.checks,
      metrics: [...result.headline, result.successRate, ...result.competitors].map((m) => ({
        id: m.id,
        label: m.label,
        basis: m.basis,
        baselineRatePct: m.baselineRate === null ? null : num(m.baselineRate * 100),
        currentRatePct: m.currentRate === null ? null : num(m.currentRate * 100),
        baselineCounts: m.baseline,
        currentCounts: m.current,
        pointChange: m.pointChange === null ? null : num(m.pointChange),
        relativeChange: m.zeroBaseline ? "new from zero" : m.relativeChange === null ? null : num(m.relativeChange),
        baselineCi: m.baselineCi,
        currentCi: m.currentCi,
        sample: m.sample,
        na: m.na ?? null,
      })),
      unmatched: result.unmatched.length,
      excluded: result.excluded.length,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// HTML report (standalone, print friendly)
// ---------------------------------------------------------------------------

const esc = (value: string | number): string =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ReportMeta = { website: string; createdBy: string; createdAt: string; rules: string[]; details: string[]; limitations: string[]; verdictLabel: string };

const CSS = `
*{box-sizing:border-box}body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#171923;margin:32px auto;max-width:880px;padding:0 24px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e6e8ef;padding-bottom:4px}
p,li{color:#344054}.muted{color:#667085;font-size:12px}table{border-collapse:collapse;width:100%;margin:8px 0}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef0f4;vertical-align:top;font-size:13px}th{color:#667085;font-weight:600}
.bar{position:relative;height:10px;background:#f1f3f6;border-left:1px solid #667085;min-width:120px}.bar>i{position:absolute;left:0;top:0;bottom:0;display:block}
.base>i{background:repeating-linear-gradient(45deg,#898781,#898781 3px,#c9c8c4 3px,#c9c8c4 6px)}.cur>i{background:#5145d8}
.badge{display:inline-block;border:1px solid #d0d5dd;border-radius:999px;padding:1px 8px;font-size:12px}
@media print{body{margin:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}}
`;

function bar(rate: number | null, kind: "base" | "cur"): string {
  if (rate === null) return '<span class="muted">N/A</span>';
  return `<div class="bar ${kind}" role="img" aria-label="${(rate * 100).toFixed(1)}%"><i style="width:${Math.max(0, Math.min(100, rate * 100)).toFixed(1)}%"></i></div>`;
}

function metricTable(metrics: MetricResult[]): string {
  const rows = metrics
    .map(
      (m) => `<tr><td>${esc(m.label)}<div class="muted">${esc(basisText(m))}</div></td>
<td>${esc(percentText(m, "baseline"))}${bar(m.baselineRate, "base")}<div class="muted">${esc(countsText(m, "baseline") ?? "")}</div></td>
<td>${esc(percentText(m, "current"))}${bar(m.currentRate, "cur")}<div class="muted">${esc(countsText(m, "current") ?? "")}</div></td>
<td>${esc(pointsText(m))}<div class="muted">relative ${esc(relativeText(m))}</div></td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Metric</th><th>Baseline</th><th>Current</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table><p class="muted">Bars run from 0% to 100%. Change is in percentage points (pp).</p>`;
}

/** A standalone HTML document with inline CSS: the same content the app shows, readable offline and printable. */
export function reportHtml(detail: ComparisonDetail, meta: ReportMeta): string {
  const { result, record, baseline, current } = detail;
  const computed = result.verdict !== "not_comparable";
  const counts = result.verdict === "insufficient_data";
  const scope = Object.entries(detail.filters).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));
  const checks = result.checks.filter((c) => c.state !== "pass");
  const body = [
    `<h1>${esc(record.title)}</h1>`,
    `<p class="muted">${esc(meta.website)} · created ${esc(meta.createdAt)} by ${esc(meta.createdBy)} · Demonstration data</p>`,
    `<h2>Summary</h2>`,
    `<p><span class="badge">${esc(meta.verdictLabel)}</span> ${result.coverage.n} of ${result.coverage.d} slots matched · ${result.unmatched.length} unmatched · ${result.excluded.length} excluded.</p>`,
    `<p>Baseline: ${esc(baseline.label)}. Current: ${esc(current.label)}.${scope.length ? ` Scope: ${scope.map(([k, v]) => `${esc(k)} ${esc(Array.isArray(v) ? v.join(", ") : String(v))}`).join("; ")}.` : ""}</p>`,
    checks.length ? `<ul>${checks.map((c) => `<li>${esc(c.label)}: ${esc(c.detail)}</li>`).join("")}</ul>` : "",
    computed
      ? `<h2>Headline</h2>${counts ? '<p class="muted">Fewer than 20 matched pairs: counts only, no trend is concluded.</p>' : ""}${metricTable(result.headline)}`
      : `<p>A hard check failed, so no rate or change is computed for this comparison.</p>`,
    computed && result.channels.length
      ? `<h2>Platforms</h2>${metricTable(result.channels.map((c) => ({ ...c.mention, label: c.label })))}`
      : "",
    computed && result.competitors.length ? `<h2>Competitors</h2>${metricTable(result.competitors)}` : "",
    detail.fixes.length
      ? `<h2>Fixes context</h2><p class="muted">Context, not cause. Tasks are placed by completion date.</p><table><thead><tr><th>Task</th><th>Status</th><th>Date</th></tr></thead><tbody>${detail.fixes
          .map((f) => `<tr><td>${esc(f.taskId)} ${esc(f.title)}</td><td>${esc(f.status.replace(/_/g, " "))}</td><td>${f.placedBy === "completed" ? "Completed" : "Due"} ${esc(formatShortDate(f.placedAt))}</td></tr>`)
          .join("")}</tbody></table>`
      : "",
    `<h2>Method and limits</h2><ul>${[...meta.rules, ...meta.details, ...meta.limitations].map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`,
    `<p class="muted">Methodology ${esc(record.methodologyVersion)}</p>`,
  ].join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(record.title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** Everything the export menu needs, built once on the server so the browser only saves or prints it. */
export type ExportBundle = { rowCsv: string; aggregateCsv: string; json: string; html: string; fileBase: string };

export function buildExportBundle(detail: ComparisonDetail, meta: ReportMeta): ExportBundle {
  return {
    rowCsv: rowLevelCsv(detail.result),
    aggregateCsv: aggregateCsv(detail.result),
    json: comparisonJson(detail),
    html: reportHtml(detail, meta),
    fileBase: detail.record.id.length > 40 ? `comparison-${detail.record.type}` : detail.record.id,
  };
}
