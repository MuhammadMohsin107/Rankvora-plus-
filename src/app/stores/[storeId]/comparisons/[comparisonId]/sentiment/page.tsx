import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StackedBar, type Segment } from "@/components/charts/bars";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { HeadlineCard } from "@/features/comparison/headline";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { SentimentCounts } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison sentiment" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

const segments = (c: SentimentCounts): Segment[] => [
  { id: "positive", label: "Positive", value: c.positive, tone: "success" },
  { id: "neutral", label: "Neutral", value: c.neutral, tone: "neutral" },
  { id: "mixed", label: "Mixed", value: c.mixed, tone: "warning" },
  { id: "negative", label: "Negative", value: c.negative, tone: "danger" },
  { id: "unknown", label: "Unknown", value: c.unknown, tone: "info" },
];

function Distribution({ title, counts }: { title: string; counts: SentimentCounts }) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</h3>
      {counts.total > 0 ? <StackedBar segments={segments(counts)} unit="mentions" /> : <p className="text-[13px] text-fg-muted">No response mentions the brand, so sentiment is N/A.</p>}
    </div>
  );
}

async function ComparisonSentimentPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/sentiment">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result } = detail;
  const positive = result.headline.find((m) => m.id === "positive-sentiment")!;

  return (
    <div className="flex flex-col gap-5">
      <HeadlineCard metric={positive} aggregation={result.aggregation} countsOnly={result.verdict === "insufficient_data"} />

      <Card>
        <CardHeader title="Distribution" subtitle="Responses that mention the brand" />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
          <Distribution title="Baseline" counts={result.sentiment.baseline} />
          <Distribution title="Current" counts={result.sentiment.current} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Where sentiment changed" info="Matched slots where the brand was mentioned on one side and the sentiment label differs. Open the Prompts tab to read the full responses." />
        <CardBody className="pt-2">
          {result.sentiment.excerpts.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No matched slot changed sentiment.</p>
          ) : (
            <ul className="divide-y divide-line">
              {result.sentiment.excerpts.map((e) => (
                <li key={e.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-fg" title={e.promptText}>{e.promptText}</p>
                    <p className="truncate text-xs text-fg-subtle">{e.channelLabel}</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                    {[
                      { label: "Baseline", sentiment: e.baselineSentiment, quote: e.baselineQuote },
                      { label: "Current", sentiment: e.currentSentiment, quote: e.currentQuote },
                    ].map((side) => (
                      <figure key={side.label} className="min-w-0 rounded-control border border-line bg-surface-2/50 p-2.5">
                        <figcaption className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-fg-muted">{side.label}</span>
                          <span className="capitalize text-fg-subtle">{side.sentiment}</span>
                        </figcaption>
                        <blockquote className="text-[13px] text-fg-muted">{side.quote ? `“${side.quote}”` : "No quote"}</blockquote>
                      </figure>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function ComparisonSentimentPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/sentiment">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonSentimentPageContent {...props} />
    </Suspense>
  );
}
