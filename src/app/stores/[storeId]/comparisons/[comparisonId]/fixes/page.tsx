import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { FixesView } from "@/features/comparison/fixes-view";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison fixes" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonFixesPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/fixes">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  return <FixesView detail={detail} />;
}

export default function ComparisonFixesPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/fixes">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonFixesPageContent {...props} />
    </Suspense>
  );
}
