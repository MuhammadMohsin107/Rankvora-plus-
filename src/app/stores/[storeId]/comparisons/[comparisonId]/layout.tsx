import { Suspense } from "react";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { COMPARISON_LIMITATIONS, METHODOLOGY } from "@/demo/comparison";
import { ComparisonHeader } from "@/features/comparison/comparison-header";
import { buildExportBundle } from "@/features/comparison/export";
import { formatDate, formatShortDate } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import { getStore } from "@/services/core";

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  const { storeId, comparisonId } = await params;
  // Seeded ids are prerendered. A comparison created in the wizard carries its definition in the id and is
  // computed on demand by the same engine; its title, author and archive state come from this browser.
  const [detail, store] = await Promise.all([getComparisonDetail(storeId, comparisonId), getStore(storeId)]);
  if (!detail) notFound();
  const { record, baseline, current, result, fixes } = detail;
  const base = `/stores/${storeId}/comparisons/${comparisonId}`;
  const computed = result.verdict !== "not_comparable";

  const exports = computed
    ? buildExportBundle(detail, {
        website: store?.name ?? storeId,
        createdBy: record.createdBy,
        createdAt: formatDate(record.createdAt),
        rules: METHODOLOGY.rules,
        details: [METHODOLOGY.matching, ...METHODOLOGY.details],
        limitations: COMPARISON_LIMITATIONS,
        verdictLabel: STATUS.comparability[result.verdict].label,
      })
    : null;

  return (
    <>
      <ComparisonHeader
        storeId={storeId}
        record={record}
        seeded={!record.simulated}
        baselineLabel={baseline.label}
        currentLabel={current.label}
        period={`${formatShortDate(detail.rangeFrom)} – ${formatShortDate(detail.rangeTo)}`}
        exports={exports}
        tabs={[
          { href: base, label: "Overview", exact: true },
          { href: `${base}/prompts`, label: "Prompts", count: computed ? result.matchedPairs : undefined },
          { href: `${base}/breakdowns`, label: "Breakdowns" },
          { href: `${base}/fixes`, label: "Fixes", count: fixes.length || undefined },
          { href: `${base}/quality`, label: "Data quality" },
        ]}
      />
      {children}
    </>
  );
}

export default function ComparisonLayout(props: LayoutProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonLayoutContent {...props} />
    </Suspense>
  );
}
