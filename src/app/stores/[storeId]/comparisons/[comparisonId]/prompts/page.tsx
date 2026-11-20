import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { NotComputed } from "@/features/comparison/compatibility";
import { leftOutRows } from "@/features/comparison/left-out-rows";
import { PromptsView } from "@/features/comparison/prompts-view";
import { comparisonStaticParams, engineContext, getComparisonDetail, getPromptRows } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison prompts" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonPromptsPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/prompts">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result } = detail;
  if (result.verdict === "not_comparable") return <NotComputed checks={result.checks} what="Prompt pairs" />;
  const [rows, ctx] = await Promise.all([getPromptRows(storeId, comparisonId), engineContext(storeId)]);
  const context = { promptText: ctx.promptText, channelLabels: ctx.channelLabels };

  return (
    <PromptsView
      storeId={storeId}
      comparisonId={comparisonId}
      rows={rows}
      leftOut={leftOutRows(result.unmatched, result.excluded, context)}
      channelLabels={ctx.channelLabels}
      verdict={result.verdict}
    />
  );
}

export default function ComparisonPromptsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/prompts">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonPromptsPageContent {...props} />
    </Suspense>
  );
}
