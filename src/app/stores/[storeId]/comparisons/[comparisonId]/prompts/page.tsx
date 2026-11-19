import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Callout, Section } from "@/components/ui/card";
import { ExcludedTable, MatchedTable, UnmatchedTable } from "@/features/comparison/prompts-tables";
import { comparisonStaticParams, engineContext, getComparisonDetail, getPromptRows } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison prompts" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

async function ComparisonPromptsPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/prompts">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const [rows, ctx] = await Promise.all([getPromptRows(storeId, comparisonId), engineContext(storeId)]);
  const { result } = detail;
  const context = { promptText: ctx.promptText, channelLabels: ctx.channelLabels };

  return (
    <div className="flex flex-col gap-8">
      {result.verdict === "insufficient_data" ? (
        <Callout tone="warning" title="Directional sample: read these rows as examples, not as a trend" />
      ) : null}

      <div id="matched" className="scroll-mt-24">
        <Section title="Matched" actions={<Badge tone="neutral">{rows.length} pairs</Badge>}>
          <MatchedTable rows={rows} ctx={context} />
        </Section>
      </div>

      <div id="unmatched" className="scroll-mt-24">
        <Section title="Unmatched" actions={<Badge tone="warning" icon="alert-triangle">{result.unmatched.length} slots</Badge>}>
          <UnmatchedTable rows={result.unmatched} ctx={context} />
        </Section>
      </div>

      <div id="excluded" className="scroll-mt-24">
        <Section title="Excluded" actions={<Badge tone="danger" icon="x-circle">{result.excluded.length} slots</Badge>}>
          <ExcludedTable rows={result.excluded} ctx={context} />
        </Section>
      </div>
    </div>
  );
}

export default function ComparisonPromptsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/prompts">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonPromptsPageContent {...props} />
    </Suspense>
  );
}
