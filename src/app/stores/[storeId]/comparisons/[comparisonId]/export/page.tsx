import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExportPanel } from "@/features/comparison/export-panel";
import { aggregateCsv, rowLevelCsv } from "@/features/comparison/export";
import { formatDateTime } from "@/lib/format";
import { comparisonStaticParams, getComparisonDetail, METHODOLOGY } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison export" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

export default async function ComparisonExportPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/export">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result, record, baseline, current } = detail;

  const json = JSON.stringify(
    {
      comparison: record.id,
      title: record.title,
      methodologyVersion: record.methodologyVersion,
      verdict: result.verdict,
      aggregation: result.aggregation,
      coverage: result.coverage,
      matchedPairs: result.matchedPairs,
      sources: { baseline: baseline.reference, current: current.reference, runs: result.runs },
      checks: result.checks,
      metrics: [...result.headline, result.successRate, ...result.competitors].map((m) => ({
        id: m.id,
        baseline: m.baseline,
        current: m.current,
        pointChange: m.pointChange,
        relativeChange: m.zeroBaseline ? "new from zero" : m.relativeChange,
        baselineCi: m.baselineCi,
        currentCi: m.currentCi,
        sample: m.sample,
        na: m.na ?? null,
      })),
    },
    null,
    2,
  );

  return (
    <ExportPanel
      comparisonId={record.id}
      methodologyVersion={record.methodologyVersion}
      analysisVersion={METHODOLOGY.analysisVersion}
      matching={METHODOLOGY.matching}
      aggregation={METHODOLOGY.aggregation[result.aggregation]}
      sources={[
        { label: `Baseline · ${baseline.label}`, reference: baseline.reference, runs: baseline.runIds },
        { label: `Current · ${current.label}`, reference: current.reference, runs: current.runIds },
      ]}
      rowCsv={rowLevelCsv(result)}
      aggregateCsv={aggregateCsv(result)}
      json={json}
      createdBy={record.createdBy}
      createdAtLabel={formatDateTime(record.createdAt)}
    />
  );
}
