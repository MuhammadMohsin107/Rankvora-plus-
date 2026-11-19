import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ErrorState } from "@/components/ui/feedback";
import { aggregateCsv, toCsv } from "@/features/comparison/export";
import { ExportActions, RetryReport } from "@/features/reports/export-actions";
import { AuditReport } from "@/features/reports/audit-report";
import { ComparisonReport } from "@/features/reports/comparison-report";
import { GeneratingState } from "@/features/reports/generating-state";
import { MonitoringReport } from "@/features/reports/monitoring-report";
import { ReportTypeBadge } from "@/features/reports/report-parts";
import { COMPARISON_LIMITATIONS, getComparisonDetail, getPromptRows, METHODOLOGY } from "@/services/comparison";
import {
  AUDIT_REPORT_LIMITATIONS,
  MONITORING_REPORT_LIMITATIONS,
  getGeneratingProgress,
  getReport,
  getReportData,
  reportStaticParams,
} from "@/services/reports";
import type { AuditReportData, MonitoringReportData, ReportRecord } from "@/types/comparison";

export const metadata: Metadata = { title: "Report" };

export async function generateStaticParams() {
  return reportStaticParams();
}

const rate = (r: { n: number; d: number } | null) => (r ? [r.n, r.d] : ["N/A", "N/A"]);

function auditFiles(data: AuditReportData) {
  const rows = [
    ["headline", "Brand mention rate", ...rate(data.audit.mention)],
    ["headline", "Recommendation rate", ...rate(data.audit.recommendation)],
    ["headline", "Pages assessed", ...rate(data.audit.pages)],
    ["jobs", "Jobs succeeded", data.audit.succeededJobs, data.audit.plannedJobs],
    ...data.channels.flatMap((c) => [
      [c.label, "Mention rate", c.mention.n, c.mention.d],
      [c.label, "Recommendation rate", c.recommendation.n, c.recommendation.d],
      [c.label, "Owned citation rate", ...rate(c.citation)],
    ]),
  ];
  return { csv: toCsv(["section", "metric", "numerator", "denominator"], rows), json: JSON.stringify(data, null, 2) };
}

function monitoringFiles(data: MonitoringReportData) {
  const rows = [
    ["Brand mention rate", data.mention.current.n, data.mention.current.d, ...rate(data.mention.previous)],
    ["Recommendation rate", data.recommendation.current.n, data.recommendation.current.d, ...rate(data.recommendation.previous)],
    ["Owned citation rate", ...rate(data.citation.current), ...rate(data.citation.previous)],
    ...data.channels.map((c) => [`${c.label} mention rate`, c.mention.n, c.mention.d, ...rate(c.previousMention)]),
  ];
  return { csv: toCsv(["metric", "numerator", "denominator", "previous_numerator", "previous_denominator"], rows), json: JSON.stringify(data, null, 2) };
}

async function ReportPageContent(props: PageProps<"/stores/[storeId]/reports/[reportId]">) {
  const { storeId, reportId } = await props.params;
  const report = await getReport(storeId, reportId);
  if (!report) notFound();

  const header = (actions: React.ReactNode) => (
    <PageHeader
      title={report.title}
      subtitle={`${report.period} · ${report.version}`}
      breadcrumb={[{ label: "Reports", href: `/stores/${storeId}/reports` }, { label: report.id }]}
      meta={<ReportTypeBadge type={report.type} />}
      actions={actions}
    />
  );

  if (report.status === "generating") {
    const progress = await getGeneratingProgress(report);
    return (
      <>
        {header(null)}
        <GeneratingState report={report} progress={progress} />
      </>
    );
  }

  if (report.status === "failed") {
    return (
      <>
        {header(null)}
        <ErrorState title="The report could not be generated" detail="The source data is intact. Retry to build it again." action={<RetryReport title={report.title} />} />
      </>
    );
  }

  return <ReadyReport storeId={storeId} report={report} header={header} />;
}

async function ReadyReport({ storeId, report, header }: { storeId: string; report: ReportRecord; header: (actions: React.ReactNode) => React.ReactNode }) {
  const data = await getReportData(storeId, report);
  if (!data) notFound();

  if (data.kind === "audit") {
    const files = auditFiles(data);
    return (
      <>
        {header(<ExportActions baseName={report.id} csv={files.csv} json={files.json} />)}
        <AuditReport report={report} data={data} storeId={storeId} limitations={AUDIT_REPORT_LIMITATIONS} />
      </>
    );
  }

  if (data.kind === "monitoring") {
    const files = monitoringFiles(data);
    return (
      <>
        {header(<ExportActions baseName={report.id} csv={files.csv} json={files.json} />)}
        <MonitoringReport report={report} data={data} storeId={storeId} limitations={MONITORING_REPORT_LIMITATIONS} />
      </>
    );
  }

  const detail = await getComparisonDetail(storeId, data.comparisonId);
  if (!detail) notFound();
  const promptRows = await getPromptRows(storeId, data.comparisonId);
  const evidence = promptRows.filter((r) => r.change !== "unchanged").slice(0, 4);
  const json = JSON.stringify({ report: report.id, comparison: detail.record.id, verdict: detail.result.verdict, coverage: detail.result.coverage, metrics: detail.result.headline }, null, 2);
  return (
    <>
      {header(<ExportActions baseName={report.id} csv={aggregateCsv(detail.result)} json={json} />)}
      <ComparisonReport
        report={report}
        detail={detail}
        storeId={storeId}
        limitations={COMPARISON_LIMITATIONS}
        methodology={{ version: METHODOLOGY.version, matching: METHODOLOGY.matching, aggregation: METHODOLOGY.aggregation[detail.result.aggregation], rules: METHODOLOGY.rules }}
        evidence={evidence}
      />
    </>
  );
}

export default function ReportPage(props: PageProps<"/stores/[storeId]/reports/[reportId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReportPageContent {...props} />
    </Suspense>
  );
}
