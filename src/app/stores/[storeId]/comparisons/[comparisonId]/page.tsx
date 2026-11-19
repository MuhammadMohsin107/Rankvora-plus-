import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { CheckList, VerdictBanner } from "@/features/comparison/compatibility";
import { HeadlineCard } from "@/features/comparison/headline";
import { TrendChart } from "@/features/comparison/trend-chart";
import { formatShortDate } from "@/lib/format";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { ComparisonDetail } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

const KIND = { audit: "Audit", monitoring: "Monitoring runs", mixed: "Audit and monitoring" } as const;

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

export default async function ComparisonOverviewPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result, baseline, current, record } = detail;
  const base = `/stores/${storeId}/comparisons/${comparisonId}`;
  const verdictActions = <ButtonLink href={`${base}/quality`} variant="secondary" size="sm">Data quality</ButtonLink>;

  const banner = (
    <VerdictBanner
      verdict={result.verdict}
      coverage={result.coverage}
      unmatched={result.unmatched.length}
      excluded={result.excluded.length}
      checks={result.checks}
      actions={verdictActions}
    />
  );

  if (result.verdict === "not_comparable") {
    return (
      <div className="flex flex-col gap-5">
        {banner}
        <Card>
          <CardHeader title="Compatibility checks" />
          <CardBody>
            <CheckList checks={result.checks} />
          </CardBody>
        </Card>
      </div>
    );
  }

  const countsOnly = result.verdict === "insufficient_data";
  const isPeriod = record.type === "period_vs_period";
  const trend = isPeriod && result.trend.length >= 2 ? trendFor(detail) : null;

  const barRows: BarCompareRow[] = result.headline
    .filter((m) => m.id !== "share-of-voice")
    .map((m) => ({
      id: m.id,
      label: m.label,
      sub: `${m.cohort} matched slots${m.sample !== "ok" ? " · directional" : ""}`,
      baseline: m.baseline,
      current: m.current,
      baselineCi: m.baselineCi,
      currentCi: m.currentCi,
      naReason: m.na,
    }));

  const sides = [
    { role: "Baseline", info: baseline, whole: result.wholeSource.baseline },
    { role: "Current", info: current, whole: result.wholeSource.current },
  ];

  return (
    <div className="flex flex-col gap-6">
      {banner}

      <MetricGrid>
        <MetricCell>
          <Metric label="Matched coverage" numerator={result.coverage.n} denominator={result.coverage.d} unit="slots" sampleStatus={countsOnly ? "directional" : "ok"} info="Matched slots ÷ the larger side's slots. Only matched slots feed the metrics." />
        </MetricCell>
        <MetricCell>
          <Metric label="Prompt coverage" numerator={result.promptCoverage.n} denominator={result.promptCoverage.d} unit="prompts" info="Prompts with at least one matched slot ÷ prompts seen on either side." />
        </MetricCell>
        <MetricCell>
          <Metric label="Success rate · baseline" numerator={result.successRate.baseline?.n} denominator={result.successRate.baseline?.d} unit="requests" basis="operational" />
        </MetricCell>
        <MetricCell>
          <Metric label="Success rate · current" numerator={result.successRate.current?.n} denominator={result.successRate.current?.d} unit="requests" basis="operational" />
        </MetricCell>
      </MetricGrid>

      <Section title="Headline metrics" actions={<Badge tone="neutral" icon="layers">{result.aggregation === "pooled" ? "Pooled" : "Matched-slot macro average"}</Badge>}>
        {countsOnly ? (
          <Callout tone="warning" title="Low sample">
            {result.matchedPairs} matched pairs. Below 20 the result is directional: counts are shown, no trend is concluded.
          </Callout>
        ) : null}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          {result.headline.map((metric) => (
            <HeadlineCard key={metric.id} metric={metric} countsOnly={countsOnly} aggregation={result.aggregation} />
          ))}
        </div>
      </Section>

      {!countsOnly ? (
        <Card>
          <CardHeader title="Baseline vs current" subtitle="Matched cohort · whiskers show the 95% interval" info="Bars show each rate with its numerator and denominator. Wilson 95% intervals are drawn as whiskers." />
          <CardBody>
            <BarCompare rows={barRows} baselineLabel="Base" currentLabel="Current" />
          </CardBody>
        </Card>
      ) : null}

      {trend ? (
        <Card>
          <CardHeader title="Trend by run" subtitle="Matched cohort · each point shows its sample" info="Per-run rates on matched slots only. Task markers are context, not causes." />
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
        <CardHeader title="Sources" subtitle="Whole source totals include slots outside the matched cohort" />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
          {sides.map((side) => (
            <div key={side.role} className="flex min-w-0 flex-col gap-4">
              <KeyValue
                columns={2}
                items={[
                  { label: side.role, value: side.info.label },
                  { label: "Source", value: KIND[side.info.kind] },
                  { label: "Reference", value: <Mono>{side.info.reference}</Mono> },
                  { label: "Runs", value: <span className="flex flex-wrap gap-1">{side.info.runIds.map((id) => <Mono key={id}>{id}</Mono>)}</span> },
                ]}
              />
              <Metric label="Mention rate · whole source" numerator={side.whole.n} denominator={side.whole.d} basis="all successful responses" />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
