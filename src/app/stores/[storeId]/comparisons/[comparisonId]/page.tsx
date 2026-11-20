import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { OverviewView } from "@/features/comparison/overview-view";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonOverviewPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  return <OverviewView detail={detail} base={`/stores/${storeId}/comparisons/${comparisonId}`} />;
}

export default function ComparisonOverviewPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonOverviewPageContent {...props} />
    </Suspense>
  );
}
