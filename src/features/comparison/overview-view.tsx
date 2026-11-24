import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { VerdictBanner } from "@/features/comparison/compatibility";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { buildInsights } from "@/features/comparison/insights";
import { basisText, countsText, percentText, pointsText } from "@/features/comparison/metric-format";
import { metricBarRow, RateBars } from "@/features/comparison/rate-bars";
import { TrendChart } from "@/features/comparison/trend-chart";
import { formatShortDate } from "@/lib/format";
import type { ComparisonDetail, MetricResult } from "@/types/comparison";

const HERO = ["mention", "recommendation", "citation"] as const;

function trendFor(detail: ComparisonDetail) {
  const points = detail.result.trend.map((t) => ({ x: formatShortDate(t.at), mention: t.mention, recommendation: t.recommendation, at: t.at }));
  const markers = new Map<string, string[]>();
  const add = (x: string, label: string) => markers.set(x, [...(markers.get(x) ?? []), label]);
  const firstCurrent = detail.result.trend.findIndex((t) => t.side === "current");
  if (firstCurrent >= 0) add(points[firstCurrent].x, "Current");
  // A fix is marked at the first run after it was completed (context, not cause).
  const marked = detail.fixes.filter((f) => f.completedAt);
  for (const fix of marked) {
    const next = points.find((p) => p.at > fix.completedAt!);
    if (next) add(next.x, fix.taskId.replace("task-", "Task "));
  }
  return { points, marked, markers: [...markers.entries()].map(([x, labels]) => ({ x, label: labels.join(" · ") })) };
}

/** Counts only: when there are fewer than 20 matched pairs, no rate change is concluded. */
function CountsOnly({ metrics }: { metrics: MetricResult[] }) {
  return (
    <ul className="divide-y divide-line">
      {metrics.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <span className="text-body-sm font-medium text-fg">{m.label}</span>
          <span className="tnum text-body-sm text-fg-muted">
            {countsText(m, "baseline") ?? "N/A"} <span aria-hidden="true">→</span><span className="sr-only">to</span> {countsText(m, "current") ?? "N/A"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MoreMetrics({ metrics }: { metrics: MetricResult[] }) {
  return (
    <details className="group rounded-card border border-line bg-surface shadow-card">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-card px-card py-2.5 text-card-title font-semibold text-fg focus-visible:outline-2 focus-visible:outline-ring">
        More metrics
        <span className="text-helper font-normal text-fg-subtle">{metrics.length}</span>
      </summary>
      <div className="ui-scroll overflow-x-auto px-card pb-card">
        <table className="tnum w-full min-w-[34rem] border-collapse text-body-sm">
          <caption className="sr-only">Other metrics, baseline and current</caption>
          <thead>
            <tr className="border-b border-line text-left text-fg-subtle">
              <th scope="col" className="py-2 pr-4 font-medium">Metric</th>
              <th scope="col" className="py-2 pr-4 font-medium">Baseline</th>
              <th scope="col" className="py-2 pr-4 font-medium">Current</th>
              <th scope="col" className="py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.id} className="border-b border-line-soft last:border-0">
                <th scope="row" className="py-2 pr-4 text-left font-normal text-fg">
                  {m.label}
                  <span className="block text-helper text-fg-subtle">{basisText(m)}</span>
                </th>
                {(["baseline", "current"] as const).map((side) => (
                  <td key={side} className="py-2 pr-4 text-fg">
                    {percentText(m, side)}
                    <span className="block text-helper text-fg-subtle">{countsText(m, side) ?? ""}</span>
                  </td>
                ))}
                <td className="py-2 text-fg">{pointsText(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const toneBadge = { success: "success", danger: "danger", warning: "warning", neutral: "neutral" } as const;

export function OverviewView({ detail, base }: { detail: ComparisonDetail; base: string }) {
  const { result, record } = detail;
  const banner = (
    <VerdictBanner
      verdict={result.verdict}
      coverage={result.coverage}
      unmatched={result.unmatched.length}
      excluded={result.excluded.length}
      checks={result.checks}
      showVerdict={false}
      actions={<ButtonLink href={`${base}/quality`} variant="ghost" size="sm">Details</ButtonLink>}
    />
  );
  if (result.verdict === "not_comparable") return <div className="flex flex-col gap-3">{banner}</div>;

  const countsOnly = result.verdict === "insufficient_data";
  const hero = HERO.map((id) => result.headline.find((m) => m.id === id)).filter((m): m is MetricResult => Boolean(m));
  const more = result.headline.filter((m) => !(HERO as readonly string[]).includes(m.id)).concat(result.successRate);
  const insights = buildInsights(result);
  const trend = result.trend.length >= 4 ? trendFor(detail) : null;
  const averaged = hero.some((m) => m.basis === "average" && !m.na);
  const cohort = hero[0]?.cohort ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {banner}

      <Card>
        <CardHeader
          title="Headline"
          subtitle={countsOnly ? "Counts only. Fewer than 20 matched pairs." : averaged ? `Rates are averages of ${cohort} matched slots. Counts are whole responses.` : `Rates over ${cohort} matched slots.`}
          actions={countsOnly ? <Badge tone="warning" icon="alert-triangle">Directional</Badge> : undefined}
        />
        <CardBody>{countsOnly ? <CountsOnly metrics={hero} /> : <RateBars rows={hero.map((m) => metricBarRow(m))} />}</CardBody>
      </Card>

      {insights.length > 0 ? (
        <Card>
          <CardHeader title="What changed" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line">
              {insights.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-2 text-body-sm text-fg">
                      <Badge tone={toneBadge[item.tone]} icon={item.tone === "success" ? "arrow-up" : item.tone === "danger" ? "arrow-down" : item.tone === "warning" ? "alert-triangle" : "minus"}>{item.tone === "neutral" ? "Note" : item.tone === "warning" ? "Check" : item.tone === "success" ? "Up" : "Down"}</Badge>
                      <span>{item.text}</span>
                    </p>
                    {item.to ? (
                      <Link href={`${base}/${item.to.tab}${item.to.query ? `?${item.to.query}` : ""}`} className="text-body-sm font-medium text-accent-text hover:underline">
                        View
                      </Link>
                    ) : null}
                  </div>
                  {item.evidence ? (
                    <EvidenceTrace variant="compact" ids={{ storeId: record.storeId, metricId: "mention-rate", promptId: item.evidence.promptId, ...(item.evidence.responseId ? { responseId: item.evidence.responseId } : {}), comparisonId: record.id }} live={false} />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {trend ? (
        <Card>
          <CardHeader title="Trend by run" subtitle="Matched slots only. Sample size under each date." />
          <CardBody className="flex flex-col gap-3">
            <TrendChart
              points={trend.points.map((p) => ({ x: p.x, mention: p.mention, recommendation: p.recommendation }))}
              markers={trend.markers}
              summary={`Mention rate across ${trend.points.length} runs from ${trend.points[0].x} to ${trend.points[trend.points.length - 1].x}.`}
            />
            {trend.marked.length > 0 ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-helper text-fg-subtle">
                Fixes marked by completion date:
                {trend.marked.map((f) => (
                  <Link key={f.taskId} href={`/stores/${record.storeId}/fixes/tasks/${f.taskId}`} className="font-medium text-accent-text hover:underline">
                    {f.taskId.replace("task-", "Task ")}
                  </Link>
                ))}
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <MoreMetrics metrics={more} />
    </div>
  );
}
