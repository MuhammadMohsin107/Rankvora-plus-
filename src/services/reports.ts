/**
 * Data access for Reports and history. Reads the registry (reports, audits,
 * runs, comparisons) and builds the per-type report content from the generated
 * response samples, so every number agrees with the source it reports on.
 */
import { AUDIT_REPORT_LIMITATIONS, COMPARISON_LIMITATIONS, MONITORING_REPORT_LIMITATIONS } from "@/demo/comparison";
import { matchSlots } from "@/features/comparison/engine";
import { auditDocument, comparisonDocument, monitoringDocument } from "@/features/reports/documents";
import { channelLabel } from "@/lib/labels";
import { METHODOLOGY, getComparisonDetail, getPromptRows, getSourceRows } from "@/services/comparison";
import { getStore, listAlertHeadlines, listChannels, listPromptsBase, storeIds } from "@/services/core";
import { evidenceIdsForFinding, listFindings, listRunResponses, registry } from "@/services/records";
import type {
  AuditReportData,
  ChannelRates,
  HistoricalRecord,
  MonitoringEvent,
  MonitoringReportData,
  ReportData,
  ReportRecord,
} from "@/types/comparison";
import type { Rate } from "@/types/core";
import { DEMO_NOW, formatDate, formatShortDate } from "@/lib/format";
import type { EvidenceIds, ReportDocument, ReportRow, ResponseSample } from "@/types/shared-records";

export { AUDIT_REPORT_LIMITATIONS, COMPARISON_LIMITATIONS, MONITORING_REPORT_LIMITATIONS };

function recordsFor(storeId: string): ReportRecord[] {
  return registry.reports(storeId).map((r) => ({
    ...r,
    sourceHref:
      r.type === "audit" ? `/stores/${storeId}/audits/${r.sourceId}` : r.type === "monitoring" ? `/stores/${storeId}/monitoring/runs/${r.sourceId}` : `/stores/${storeId}/comparisons/${r.sourceId}`,
    sourceLabel: r.sourceId,
  }));
}

export async function listReports(storeId: string): Promise<ReportRecord[]> {
  return recordsFor(storeId);
}

/** Reports of a website as list rows (the shape demo-state overlays), with the website id on each. */
export async function listReportRows(storeId: string): Promise<ReportRow[]> {
  return recordsFor(storeId).map((r) => ({ ...r, storeId }));
}

export async function getReport(storeId: string, reportId: string): Promise<ReportRecord | null> {
  return recordsFor(storeId).find((r) => r.id === reportId) ?? null;
}

/** All {storeId, reportId} pairs, for generateStaticParams. */
export async function reportStaticParams(): Promise<{ storeId: string; reportId: string }[]> {
  return storeIds().flatMap(({ storeId }) => recordsFor(storeId).map((r) => ({ storeId, reportId: r.id })));
}

export async function listHistorical(storeId: string): Promise<HistoricalRecord[]> {
  const reports = registry.reports(storeId);
  const reportFor = (sourceId: string) => reports.find((r) => r.sourceId === sourceId)?.id ?? null;
  const audits: HistoricalRecord[] = registry.audits(storeId).map((a) => ({
    id: a.id,
    kind: "audit",
    title: a.title,
    at: a.startedAt,
    status: a.status,
    snapshotId: a.snapshotId,
    href: `/stores/${storeId}/audits/${a.id}`,
    reportId: reportFor(a.id),
  }));
  const runs: HistoricalRecord[] = registry.runs(storeId).map((r) => ({
    id: r.id,
    kind: "monitoring",
    title: `Weekly monitoring — ${r.id}`,
    at: r.scheduledFor,
    status: r.status,
    snapshotId: r.snapshotId,
    href: `/stores/${storeId}/monitoring/runs/${r.id}`,
    reportId: reportFor(r.id),
  }));
  const comparisons: HistoricalRecord[] = registry.comparisons(storeId).map((c) => ({
    id: c.id,
    kind: "comparison",
    title: c.title,
    at: c.createdAt,
    status: c.status,
    snapshotId: null,
    href: `/stores/${storeId}/comparisons/${c.id}`,
    reportId: reportFor(c.id),
  }));
  return [...audits, ...runs, ...comparisons].sort((a, b) => (a.at < b.at ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Per-type report content
// ---------------------------------------------------------------------------

function channelRates(responses: ResponseSample[], labels: Record<string, string>): ChannelRates[] {
  const ids = [...new Set(responses.map((r) => r.channelId))];
  return ids.map((id) => {
    const all = responses.filter((r) => r.channelId === id);
    const ok = all.filter((r) => r.status === "succeeded");
    const withCitations = ok.filter((r) => r.citationSupport === "returned");
    const supported = ok.some((r) => r.citationSupport !== "not_supported");
    return {
      id,
      label: labels[id] ?? id,
      mention: { n: ok.filter((r) => r.brandMentioned === "yes").length, d: ok.length },
      recommendation: { n: ok.filter((r) => r.recommendation === "recommended").length, d: ok.length },
      citation: supported ? { n: withCitations.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: withCitations.length } : null,
      failed: all.length - ok.length,
    };
  });
}

function failures(responses: ResponseSample[]) {
  const map = new Map<string, number>();
  for (const r of responses) if (r.status === "failed") map.set(r.failure?.class ?? "unknown", (map.get(r.failure?.class ?? "unknown") ?? 0) + 1);
  return [...map.entries()].map(([cls, count]) => ({ cls, count })).sort((a, b) => b.count - a.count || a.cls.localeCompare(b.cls));
}

async function channelLabels(): Promise<Record<string, string>> {
  return Object.fromEntries((await listChannels()).map((c) => [c.id, channelLabel(c)]));
}

export async function getAuditReportData(storeId: string, auditId: string): Promise<AuditReportData | null> {
  const audit = registry.audits(storeId).find((a) => a.id === auditId);
  if (!audit) return null;
  const [responses, findings, labels] = await Promise.all([listRunResponses(storeId, auditId), listFindings(storeId), channelLabels()]);
  const linked = findings.filter((f) => f.auditId === auditId);
  const tasks = registry.tasks(storeId).filter((t) => linked.some((f) => f.id === t.findingId));
  const evidence = responses.filter((r) => r.status === "succeeded" && r.outcome === "recommended").slice(0, 3);
  return {
    kind: "audit",
    audit: {
      id: audit.id,
      title: audit.title,
      type: audit.type,
      status: audit.status,
      startedAt: audit.startedAt,
      completedAt: audit.completedAt,
      snapshotId: audit.snapshotId,
      plannedJobs: audit.plannedJobs,
      succeededJobs: audit.succeededJobs,
      failedJobs: audit.failedJobs,
      findingsCreated: audit.findingsCreated,
      pages: audit.pages,
      createdBy: audit.createdBy,
      mention: audit.mention,
      recommendation: audit.recommendation,
    },
    channels: channelRates(responses, labels),
    failedByClass: failures(responses),
    findings: linked.map((f) => ({ id: f.id, title: f.title, severity: f.severity, priority: f.priority, status: f.status, category: f.category, lane: f.lane })),
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, findingId: t.findingId })),
    evidence,
  };
}

export async function getMonitoringReportData(storeId: string, runId: string): Promise<MonitoringReportData | null> {
  const runs = registry.runs(storeId);
  const index = runs.findIndex((r) => r.id === runId);
  if (index < 0) return null;
  const run = runs[index];
  const previous = index > 0 ? runs[index - 1] : null;

  const [responses, previousResponses, labels, prompts, alerts, rows, previousRows] = await Promise.all([
    listRunResponses(storeId, run.id),
    previous ? listRunResponses(storeId, previous.id) : Promise.resolve([] as ResponseSample[]),
    channelLabels(),
    listPromptsBase(storeId),
    listAlertHeadlines(),
    getSourceRows(storeId, run.id),
    previous ? getSourceRows(storeId, previous.id) : Promise.resolve([]),
  ]);

  const rate = (list: ResponseSample[], pick: (r: ResponseSample) => boolean): Rate => {
    const ok = list.filter((r) => r.status === "succeeded");
    return { n: ok.filter(pick).length, d: ok.length };
  };
  const citationRate = (list: ResponseSample[]): Rate | null => {
    const withData = list.filter((r) => r.status === "succeeded" && r.citationSupport === "returned");
    return withData.length ? { n: withData.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: withData.length } : null;
  };

  const promptText = Object.fromEntries(prompts.map((p) => [p.id, p.text]));
  const events: MonitoringEvent[] = [];
  if (previous) {
    for (const pair of matchSlots(previousRows, rows).pairs) {
      const before = pair.baseline.find((r) => r.ok);
      const after = pair.current.find((r) => r.ok);
      if (!before || !after) continue;
      const base = { promptText: promptText[pair.promptId] ?? pair.promptId, channelLabel: labels[pair.channelId] ?? pair.channelId };
      if (!before.mentioned && after.mentioned) events.push({ id: `${pair.key}-nm`, kind: "new_mention", ...base });
      if (before.mentioned && !after.mentioned) events.push({ id: `${pair.key}-lm`, kind: "lost_mention", ...base });
      if (!before.recommended && after.recommended) events.push({ id: `${pair.key}-nr`, kind: "new_recommendation", ...base });
      if (before.recommended && !after.recommended) events.push({ id: `${pair.key}-rl`, kind: "recommendation_lost", ...base });
    }
  }

  const runStart = run.scheduledFor;
  const runEnd = new Date(Date.parse(run.scheduledFor) + 24 * 3_600_000).toISOString();
  const previousChannels = channelRates(previousResponses, labels);

  return {
    kind: "monitoring",
    run: {
      id: run.id,
      scheduleId: run.scheduleId,
      scheduledFor: run.scheduledFor,
      status: run.status,
      plannedJobs: run.plannedJobs,
      succeededJobs: run.succeededJobs,
      failedJobs: run.failedJobs,
      costUsd: run.costUsd,
      snapshotId: run.snapshotId,
    },
    previousRunId: previous?.id ?? null,
    mention: { current: rate(responses, (r) => r.brandMentioned === "yes"), previous: previous ? rate(previousResponses, (r) => r.brandMentioned === "yes") : null },
    recommendation: { current: rate(responses, (r) => r.recommendation === "recommended"), previous: previous ? rate(previousResponses, (r) => r.recommendation === "recommended") : null },
    citation: { current: citationRate(responses), previous: previous ? citationRate(previousResponses) : null },
    channels: channelRates(responses, labels).map((c) => ({ ...c, previousMention: previousChannels.find((p) => p.id === c.id)?.mention ?? null })),
    events,
    alerts: alerts.filter((a) => a.storeId === storeId && a.at >= runStart && a.at <= runEnd).map((a) => ({ id: a.id, severity: a.severity, title: a.title, at: a.at })),
    usage: {
      requests: responses.length,
      inputTokens: responses.reduce((sum, r) => sum + r.usage.inputTokens, 0),
      outputTokens: responses.reduce((sum, r) => sum + r.usage.outputTokens, 0),
      searchCalls: responses.reduce((sum, r) => sum + r.usage.searchCalls, 0),
      costUsd: run.costUsd,
    },
    failedByClass: failures(responses),
  };
}

export async function getReportData(storeId: string, report: ReportRecord): Promise<ReportData | null> {
  if (report.type === "audit") return getAuditReportData(storeId, report.sourceId);
  if (report.type === "monitoring") return getMonitoringReportData(storeId, report.sourceId);
  return { kind: "comparison", comparisonId: report.sourceId };
}

/** Progress of the source behind a report that is still generating. */
export async function getGeneratingProgress(storeId: string, report: ReportRecord): Promise<{ jobs: { done: number; total: number }; pages: { done: number; total: number } | null } | null> {
  if (report.type !== "audit") return null;
  const audit = registry.audits(storeId).find((a) => a.id === report.sourceId);
  if (!audit) return null;
  return {
    jobs: { done: audit.succeededJobs + audit.failedJobs, total: audit.plannedJobs },
    pages: audit.pages ? { done: audit.pages.n, total: audit.pages.d } : null,
  };
}

// ---------------------------------------------------------------------------
// Report documents: the model the page, the exports and the print view share
// ---------------------------------------------------------------------------

export const reportDocumentKey = (type: string, sourceId: string) => `${type}:${sourceId}`;

/** The document for one report, built from the same data as the audit, run or comparison it reports on. */
export async function getReportDocument(storeId: string, report: ReportRecord): Promise<ReportDocument | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const websiteName = store.name;
  if (report.type === "audit") {
    const data = await getAuditReportData(storeId, report.sourceId);
    if (!data) return null;
    const findings = await listFindings(storeId);
    const findingIds: Record<string, EvidenceIds> = {};
    for (const f of findings.filter((x) => data.findings.some((d) => d.id === x.id))) findingIds[f.id] = evidenceIdsForFinding(f);
    return auditDocument({ report, data, websiteName, limitations: AUDIT_REPORT_LIMITATIONS, findingIds, storeId });
  }
  if (report.type === "monitoring") {
    const data = await getMonitoringReportData(storeId, report.sourceId);
    if (!data) return null;
    const answers = (await listRunResponses(storeId, report.sourceId)).filter((r) => r.status === "succeeded");
    const gaps = answers.filter((r) => r.brandMentioned === "no");
    return monitoringDocument({ report, data, websiteName, limitations: MONITORING_REPORT_LIMITATIONS, responses: [...gaps, ...answers.filter((r) => r.brandMentioned !== "no")], storeId });
  }
  const detail = await getComparisonDetail(storeId, report.sourceId);
  if (!detail) return null;
  const rows = detail.result.verdict === "not_comparable" ? [] : await getPromptRows(storeId, report.sourceId);
  return comparisonDocument({
    report,
    detail,
    websiteName,
    limitations: COMPARISON_LIMITATIONS,
    methodology: { version: METHODOLOGY.version, matching: METHODOLOGY.matching, aggregation: METHODOLOGY.aggregation[detail.result.aggregation], rules: METHODOLOGY.rules },
    changedRows: rows.filter((r) => r.change !== "unchanged"),
    storeId,
  });
}

/** Documents for every report source of a website, keyed by `type:sourceId`. Used to render reports created in the browser. */
export async function getReportDocuments(storeId: string): Promise<Record<string, ReportDocument>> {
  const out: Record<string, ReportDocument> = {};
  for (const source of await listReportSources(storeId)) {
    const record: ReportRecord = { id: source.id, type: source.type, title: source.title, sourceId: source.id, period: source.period, createdAt: DEMO_NOW, version: source.version, status: "ready", sourceHref: source.href, sourceLabel: source.id };
    const doc = await getReportDocument(storeId, record);
    if (doc) out[reportDocumentKey(source.type, source.id)] = { ...doc, title: source.title };
  }
  return out;
}

export type ReportSource = { type: "audit" | "monitoring" | "comparison"; id: string; title: string; period: string; version: string; href: string; date: string; hasReport: boolean };

/** Sources a report can be generated from: finished audits and runs, and every comparison. */
export async function listReportSources(storeId: string): Promise<ReportSource[]> {
  const reports = registry.reports(storeId);
  const has = (id: string) => reports.some((r) => r.sourceId === id);
  const audits = registry.audits(storeId)
    .filter((a) => a.completedAt !== null)
    .map((a): ReportSource => ({ type: "audit", id: a.id, title: a.title, period: formatDate(a.startedAt), version: "Criteria 2.1", href: `/stores/${storeId}/audits/${a.id}`, date: a.startedAt, hasReport: has(a.id) }));
  const runs = registry.runs(storeId)
    .filter((r) => r.status !== "running" && r.status !== "skipped" && r.status !== "failed")
    .map((r): ReportSource => ({ type: "monitoring", id: r.id, title: `Weekly monitoring — ${formatShortDate(r.scheduledFor)}`, period: formatDate(r.scheduledFor), version: "Analysis 1.2", href: `/stores/${storeId}/monitoring/runs/${r.id}`, date: r.scheduledFor, hasReport: has(r.id) }));
  const comparisons = registry.comparisons(storeId).map((c): ReportSource => ({ type: "comparison", id: c.id, title: c.title, period: formatDate(c.createdAt), version: `Methodology ${c.methodologyVersion}`, href: `/stores/${storeId}/comparisons/${c.id}`, date: c.createdAt, hasReport: has(c.id) }));
  return [...audits, ...runs, ...comparisons].sort((a, b) => (a.date < b.date ? 1 : -1));
}
