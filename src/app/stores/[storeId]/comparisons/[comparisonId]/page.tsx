import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Metric, Section } from "@/components/ui/card";
import { VerdictBanner } from "@/features/comparison/compatibility";
import { HeadlineCard } from "@/features/comparison/headline";
import { TrendChart } from "@/features/comparison/trend-chart";
import { formatShortDate } from "@/lib/format";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { ComparisonDetail } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

function trendFor(detail: ComparisonDetail) {
  const { trend } = detail.result;
  const points = trend.map((t) => ({ x: formatShortDate(t.at), mention: t.mention, recommendation: t.recommendation, at: t.at, side: t.side }));
  const markers = new Map<string, string[]>();
  const add = (x: string, label: string) => markers.set(x, [...(markers.get(x) ?? []), label]);
  const firstCurrent = points.find((p) => p.side === "current");
  if (firstCurrent) add(firstCurrent.x, "Current period");
  for (const fix of detail.fixes.filter((f) => f.completed && f.dueAt)) {
    const next = points.find((p) => p.at > fix.dueAt!);
    if (next) add(next.x, fix.taskId.replace("task-", "Task "));
  }
  return { points, markers: [...markers.entries()].map(([x, labels]) => ({ x, label: labels.join(" · ") })) };
}

async function ComparisonOverviewPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result, record } = detail;

  // The header already shows the verdict, so the banner leads with coverage and the main reasons.
  const banner = (
    <VerdictBanner
      verdict={result.verdict}
      coverage={result.coverage}
      unmatched={result.unmatched.length}
      excluded={result.excluded.length}
      checks={result.checks}
      showVerdict={false}
    />
  );

  if (result.verdict === "not_comparable") return banner;

  const countsOnly = result.verdict === "insufficient_data";
  const isPeriod = record.type === "period_vs_period";
  const trend = isPeriod && result.trend.length >= 2 ? trendFor(detail) : null;

  return (
    <div className="flex flex-col gap-6">
      {banner}

      <Section
        title="Headline metrics"
        actions={
          <span className="flex items-center gap-2">
            {countsOnly ? <span className="text-xs text-fg-subtle">Counts only, no trend</span> : null}
            <Badge tone="neutral" icon="layers">{result.aggregation === "pooled" ? "Pooled" : "Matched-slot macro average"}</Badge>
          </span>
        }
      >
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {result.headline.map((metric) => (
            <HeadlineCard key={metric.id} metric={metric} countsOnly={countsOnly} aggregation={result.aggregation} grouped />
          ))}
        </div>
      </Section>

      {trend ? (
        <Card>
          <CardHeader title="Trend by run" info="Per-run rates on matched slots only; each point shows its sample. Task markers are context, not causes." />
          <CardBody>
            <TrendChart
              points={trend.points.map((p) => ({ x: p.x, mention: p.mention, recommendation: p.recommendation }))}
              markers={trend.markers}
              summary={`Mention rate across ${trend.points.length} runs from ${trend.points[0].x} to ${trend.points[trend.points.length - 1].x}.`}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Whole-source mention rate" info="All successful responses of each source, including slots outside the matched cohort. Reconciles with the source's own headline." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
          <Metric label="Baseline" numerator={result.wholeSource.baseline.n} denominator={result.wholeSource.baseline.d} />
          <Metric label="Current" numerator={result.wholeSource.current.n} denominator={result.wholeSource.current.d} />
        </CardBody>
      </Card>
    </div>
  );
}

export default function ComparisonOverviewPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonOverviewPageContent {...props} />
    </Suspense>
  );
}
