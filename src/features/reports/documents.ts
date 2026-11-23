/**
 * Report documents: one plain, serialisable model per report. The page, the HTML preview, the print view and the
 * CSV and JSON downloads are all generated from it, so every export matches what is displayed.
 * Pure functions over data the services already load: no React, no demo imports.
 */
import { responseEvidenceIds } from "@/features/responses/response-model";
import { formatRate } from "@/lib/format";
import { humanize, statusMeta } from "@/lib/status";
import type { AuditReportData, ComparisonDetail, MetricResult, MonitoringReportData, PairRowWithResponses, ReportRecord } from "@/types/comparison";
import type { Rate } from "@/types/core";
import type { EvidenceIds, ReportCell, ReportDocument, ReportEvidenceItem, ReportMetric, ReportTable, ResponseSample } from "@/types/shared-records";

const pct = (r: Rate | null) => (r ? formatRate(r.n, r.d) : "N/A");

/** "21 of 48 successful responses (43.8%)" or "no data". */
function ofText(label: string, r: Rate | null, noun: string): string {
  return r ? `${label} in ${r.n} of ${r.d} ${noun} (${pct(r)})` : `${label}: no data`;
}

function rateMetric(id: string, label: string, current: Rate | null, previous: Rate | null | undefined, extra: Partial<ReportMetric> = {}): ReportMetric {
  return { id, label, n: current ? current.n : null, d: current ? current.d : null, previous: previous === undefined ? undefined : previous, ...extra };
}

const rateCell = (r: Rate | null): ReportCell => (r ? { n: r.n, d: r.d } : null);

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export function auditDocument(args: {
  report: ReportRecord;
  data: AuditReportData;
  websiteName: string;
  limitations: string[];
  /** Evidence ids per finding id (from the evidence service). */
  findingIds: Record<string, EvidenceIds>;
  storeId: string;
}): ReportDocument {
  const { report, data, websiteName, limitations, findingIds, storeId } = args;
  const { audit } = data;
  const lanes = audit.pages ? "AI visibility, Website readiness" : "AI visibility";
  const failedNote = audit.failedJobs > 0 ? `; ${audit.failedJobs} failed and are excluded from rates` : "";

  const evidence: ReportEvidenceItem[] = [
    ...data.findings.slice(0, 6).map((f) => ({
      id: f.id,
      title: f.title,
      note: `${humanize(f.severity)} severity · ${humanize(f.status)}`,
      ids: findingIds[f.id] ?? { storeId, findingId: f.id },
    })),
    ...data.evidence.map((r) => ({ id: r.id, title: r.promptText, note: `${r.providerLabel} API · sample ${r.sample} · recommended`, ids: responseEvidenceIds(r), response: r })),
  ];

  const providers: ReportTable = {
    id: "providers",
    title: "By provider",
    columns: [
      { id: "provider", label: "Provider", kind: "text" },
      { id: "mention", label: "Mention", kind: "rate", align: "right" },
      { id: "recommendation", label: "Recommendation", kind: "rate", align: "right" },
      { id: "citation", label: "Owned citation", kind: "rate", align: "right" },
      { id: "failed", label: "Failed", kind: "number", align: "right" },
    ],
    rows: data.channels.map((c) => ({ provider: c.label, mention: rateCell(c.mention), recommendation: rateCell(c.recommendation), citation: rateCell(c.citation), failed: c.failed })),
  };

  return {
    type: "audit",
    title: report.title,
    websiteName,
    period: report.period,
    generatedAt: report.createdAt,
    version: report.version,
    source: { id: audit.id, label: "Audit", href: report.sourceHref, snapshotIds: audit.snapshotId ? [audit.snapshotId] : [] },
    summary: [
      `${ofText("Brand mentioned", audit.mention, "successful responses")}.`,
      `${ofText("Recommended", audit.recommendation, "successful responses")}.`,
      `${audit.succeededJobs} of ${audit.plannedJobs} planned requests succeeded${failedNote}.`,
    ],
    metrics: [
      rateMetric("mention-rate", "Brand mention rate", audit.mention, undefined, { basis: "Successful responses", naReason: audit.mention ? undefined : "No completed analysis" }),
      rateMetric("recommendation-rate", "Recommendation rate", audit.recommendation, undefined, { basis: "Successful responses", naReason: audit.recommendation ? undefined : "No completed analysis" }),
      rateMetric("page-coverage", "Page coverage", audit.pages, undefined, { unit: "pages", basis: "Pages assessed of in-scope pages", naReason: audit.pages ? undefined : "Website lane not run" }),
      { id: "findings", label: "Findings created", n: audit.findingsCreated, d: null },
    ],
    tables: data.channels.length > 0 ? [providers] : [],
    coverage: [
      { label: "Requests succeeded", n: audit.succeededJobs, d: audit.plannedJobs },
      ...(audit.pages ? [{ label: "Pages assessed", n: audit.pages.n, d: audit.pages.d }] : []),
    ],
    scope: [
      { label: "Audit type", value: humanize(audit.type) },
      { label: "Lanes", value: `${lanes}, reported separately` },
      { label: "Started (UTC)", value: audit.startedAt },
      { label: "Completed (UTC)", value: audit.completedAt ?? "Not completed" },
      { label: "Created by", value: audit.createdBy },
    ],
    evidence,
    limitations,
    methodology: [report.version, "Rates use successful, eligible responses only.", "AI visibility and website readiness are never blended into one score."],
  };
}

// ---------------------------------------------------------------------------
// Monitoring
// ---------------------------------------------------------------------------

const EVENT_LABEL = { new_mention: "New mention", lost_mention: "Lost mention", new_recommendation: "New recommendation", recommendation_lost: "Recommendation lost" } as const;

export function monitoringDocument(args: {
  report: ReportRecord;
  data: MonitoringReportData;
  websiteName: string;
  limitations: string[];
  /** Original answers worth reading, for the evidence list. */
  responses: ResponseSample[];
  storeId: string;
}): ReportDocument {
  const { report, data, websiteName, limitations, responses, storeId } = args;
  const { run } = data;
  const gained = data.events.filter((e) => e.kind === "new_mention" || e.kind === "new_recommendation").length;
  const lost = data.events.length - gained;

  const providers: ReportTable = {
    id: "providers",
    title: "By provider",
    columns: [
      { id: "provider", label: "Provider", kind: "text" },
      { id: "mention", label: "Mention", kind: "rate", align: "right" },
      { id: "previous", label: "Previous run", kind: "rate", align: "right" },
      { id: "recommendation", label: "Recommendation", kind: "rate", align: "right" },
      { id: "failed", label: "Failed", kind: "number", align: "right" },
    ],
    rows: data.channels.map((c) => ({ provider: c.label, mention: rateCell(c.mention), previous: rateCell(c.previousMention), recommendation: rateCell(c.recommendation), failed: c.failed })),
  };
  const events: ReportTable = {
    id: "changes",
    title: "Changes since the previous run",
    columns: [
      { id: "event", label: "Change", kind: "text" },
      { id: "prompt", label: "Prompt", kind: "text" },
      { id: "provider", label: "Provider", kind: "text" },
    ],
    rows: data.events.slice(0, 10).map((e) => ({ event: EVENT_LABEL[e.kind], prompt: e.promptText, provider: e.channelLabel })),
  };

  const evidence: ReportEvidenceItem[] = [
    { id: run.id, title: `Run ${run.id}`, note: "Metrics above come from this run", ids: { storeId, sourceId: run.id, metricId: "mention-rate" } },
    ...responses.slice(0, 3).map((r) => ({
      id: r.id,
      title: r.promptText,
      note: `${r.providerLabel} API · sample ${r.sample} · ${r.brandMentioned === "yes" ? "brand mentioned" : "brand absent"}`,
      ids: responseEvidenceIds(r),
      response: r,
    })),
  ];

  const previousText = data.previousRunId ? `Compared with ${data.previousRunId} on matching slots only.` : "No previous run to compare with.";
  return {
    type: "monitoring",
    title: report.title,
    websiteName,
    period: report.period,
    generatedAt: report.createdAt,
    version: report.version,
    source: { id: run.id, label: "Monitoring run", href: report.sourceHref, snapshotIds: [run.snapshotId] },
    summary: [
      `${ofText("Brand mentioned", data.mention.current, "successful responses")}.`,
      data.previousRunId ? `${gained} gained and ${lost} lost mentions or recommendations since ${data.previousRunId}.` : previousText,
      `${run.succeededJobs} of ${run.plannedJobs} planned requests succeeded${run.failedJobs > 0 ? `; ${run.failedJobs} failed and are excluded from rates` : ""}.`,
    ],
    metrics: [
      rateMetric("mention-rate", "Brand mention rate", data.mention.current, data.mention.previous, { basis: "Successful responses" }),
      rateMetric("recommendation-rate", "Recommendation rate", data.recommendation.current, data.recommendation.previous, { basis: "Successful responses" }),
      rateMetric("citation-rate", "Owned citation rate", data.citation.current, data.citation.previous, { basis: "Responses with citation data", naReason: data.citation.current ? undefined : "No provider returned citation data" }),
    ],
    tables: [...(data.channels.length > 0 ? [providers] : []), ...(data.events.length > 0 ? [events] : [])],
    coverage: [{ label: "Requests succeeded", n: run.succeededJobs, d: run.plannedJobs }],
    scope: [
      { label: "Scheduled for (UTC)", value: run.scheduledFor },
      { label: "Run status", value: humanize(run.status) },
      { label: "Schedule", value: run.scheduleId },
      { label: "Alerts raised", value: String(data.alerts.length) },
      { label: "Compared with", value: data.previousRunId ?? "None" },
    ],
    evidence,
    limitations,
    methodology: [report.version, "Rates use successful, eligible responses only.", previousText],
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/** Integer rate for a metric side. Prefers the pooled counts so a macro average is never printed as a count. */
function wholeRate(rate: Rate | null | undefined): Rate | null {
  return rate && Number.isInteger(rate.n) && Number.isInteger(rate.d) ? { n: rate.n, d: rate.d } : null;
}

function comparisonMetric(m: MetricResult): ReportMetric {
  const current = wholeRate(m.pooledCurrent) ?? wholeRate(m.current);
  const baseline = wholeRate(m.pooledBaseline) ?? wholeRate(m.baseline);
  return { id: m.id, label: m.label, n: current ? current.n : null, d: current ? current.d : null, previous: baseline, basis: "Pooled responses in the matched cohort", naReason: m.na ?? (current ? undefined : "No whole-count rate for this metric") };
}

export function comparisonDocument(args: {
  report: ReportRecord;
  detail: ComparisonDetail;
  websiteName: string;
  limitations: string[];
  methodology: { version: string; matching: string; aggregation: string; rules: string[] };
  /** Slots where the mention changed, with their original answers. */
  changedRows: PairRowWithResponses[];
  storeId: string;
}): ReportDocument {
  const { report, detail, websiteName, limitations, methodology, changedRows, storeId } = args;
  const { result, record, baseline, current, fixes } = detail;
  const verdict = statusMeta("comparability", result.verdict);
  const blocked = result.verdict === "not_comparable";
  const countsOnly = result.verdict === "insufficient_data";

  const summary: string[] = [
    `${baseline.label} (${baseline.reference}) against ${current.label} (${current.reference}).`,
    blocked
      ? "A hard check failed, so no rate, change or breakdown is reported."
      : `${result.matchedPairs} matched pairs, coverage ${result.coverage.n} of ${result.coverage.d} (${pct(result.coverage)}).${countsOnly ? " Counts only: no trend is concluded." : ""}`,
  ];

  const tables: ReportTable[] = [];
  if (blocked) {
    tables.push({
      id: "checks",
      title: "Checks",
      columns: [
        { id: "check", label: "Check", kind: "text" },
        { id: "state", label: "Result", kind: "text" },
        { id: "detail", label: "Detail", kind: "text" },
      ],
      rows: result.checks.map((c) => ({ check: c.label, state: humanize(c.state), detail: c.detail })),
    });
  } else if (result.channels.length > 0) {
    tables.push({
      id: "providers",
      title: "Mention rate by provider",
      columns: [
        { id: "provider", label: "Provider", kind: "text" },
        { id: "baseline", label: "Baseline", kind: "rate", align: "right" },
        { id: "current", label: "Current", kind: "rate", align: "right" },
        { id: "pairs", label: "Matched pairs", kind: "number", align: "right" },
      ],
      rows: result.channels.map((c) => ({
        provider: c.label,
        baseline: rateCell(wholeRate(c.mention.pooledBaseline) ?? wholeRate(c.mention.baseline)),
        current: rateCell(wholeRate(c.mention.pooledCurrent) ?? wholeRate(c.mention.current)),
        pairs: c.matchedPairs,
      })),
    });
  }

  const evidence: ReportEvidenceItem[] = [
    ...(blocked
      ? []
      : changedRows.slice(0, 4).map((row) => ({
          id: row.key,
          title: row.promptText,
          note: `${row.channelLabel} · mention ${row.change}`,
          ids: { storeId, comparisonId: record.id, promptId: row.promptId, sourceId: current.runIds[0], ...(row.currentResponse ? { responseId: row.currentResponse.id } : {}) } satisfies EvidenceIds,
          response: row.currentResponse ?? undefined,
        }))),
    ...fixes
      .filter((f) => f.completed)
      .slice(0, 4)
      .map((f) => ({
        id: f.taskId,
        title: f.title,
        note: f.before && f.after ? `Mention rate before and after this task was completed: ${f.before.rate.n} / ${f.before.rate.d} to ${f.after.rate.n} / ${f.after.rate.d}. Context, not proof of cause.` : "No monitoring run on both sides of this task.",
        ids: { storeId, taskId: f.taskId, comparisonId: record.id },
      })),
  ];

  return {
    type: "comparison",
    title: report.title,
    websiteName,
    period: report.period,
    generatedAt: report.createdAt,
    version: report.version,
    source: { id: record.id, label: "Comparison", href: report.sourceHref, snapshotIds: [baseline.reference, current.reference] },
    summary,
    verdict: { label: verdict.label, tone: verdict.tone === "info" || verdict.tone === "accent" ? "neutral" : verdict.tone },
    metrics: blocked ? [] : result.headline.map(comparisonMetric),
    tables,
    coverage: blocked ? [] : [{ label: "Matched pairs of the larger side", n: result.coverage.n, d: result.coverage.d }, { label: "Prompts included", n: result.promptCoverage.n, d: result.promptCoverage.d }],
    scope: [
      { label: "Type", value: humanize(record.type) },
      { label: "Baseline", value: `${baseline.label} · ${baseline.reference}` },
      { label: "Current", value: `${current.label} · ${current.reference}` },
      { label: "Created by", value: record.createdBy },
    ],
    evidence,
    limitations,
    methodology: [`Methodology ${methodology.version}`, methodology.matching, "Rates are pooled counts of successful responses in the matched cohort.", ...methodology.rules.slice(0, 3)],
  };
}

