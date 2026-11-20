import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { QualityView } from "@/features/comparison/quality-view";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison data quality" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonQualityPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/quality">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  return <QualityView detail={detail} base={`/stores/${storeId}/comparisons/${comparisonId}`} />;
}

export default function ComparisonQualityPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/quality">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonQualityPageContent {...props} />
    </Suspense>
  );
}
