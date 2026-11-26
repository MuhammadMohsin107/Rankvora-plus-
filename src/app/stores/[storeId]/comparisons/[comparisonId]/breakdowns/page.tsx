import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { BreakdownsView } from "@/features/comparison/breakdowns-view";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison breakdowns" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonBreakdownsPageContent(props: { params: Promise<{ storeId: string; comparisonId: string }> }) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result } = detail;
  return (
    <BreakdownsView
      data={{
        verdict: result.verdict,
        checks: result.checks,
        channels: result.channels,
        brand: result.headline.find((m) => m.id === "mention") ?? null,
        competitors: result.competitors,
        appeared: result.competitorAppeared,
        gone: result.competitorGone,
        domains: result.domains,
        urls: result.urls,
        sentiment: result.sentiment,
      }}
    />
  );
}

export default function ComparisonBreakdownsPage(props: { params: Promise<{ storeId: string; comparisonId: string }> }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonBreakdownsPageContent {...props} />
    </Suspense>
  );
}
