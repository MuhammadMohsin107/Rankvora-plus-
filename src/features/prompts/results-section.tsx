"use client";

import { useMemo, useState } from "react";

import { StackedBar } from "@/components/charts/bars";
import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { Status } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Metric } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { ChartEmpty } from "@/components/charts/chart-states";
import { EmptyState } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Mono } from "@/components/ui/misc";
import { ResponseButton } from "@/features/responses/response-inspector";
import { cn } from "@/lib/cn";
import { formatShortDate, ratePercent } from "@/lib/format";
import { sampleStatus } from "@/lib/stats";
import type { PromptStatus } from "@/types/core";
import type { ChannelOption, PromptResults, PromptVersion, ResultCounts } from "@/types/prompts";
import type { ResponseSample } from "@/types/shared-records";

type Props = {
  results: PromptResults;
  channels: ChannelOption[];
  versions: PromptVersion[];
  status: PromptStatus;
  storeId: string;
};

const GRID: Record<number, string> = {
  1: "grid-cols-[minmax(0,1fr)]",
  2: "grid-cols-[minmax(0,1fr)] sm:grid-cols-2",
  3: "grid-cols-[minmax(0,1fr)] sm:grid-cols-3",
  4: "grid-cols-[minmax(0,1fr)] sm:grid-cols-2 xl:grid-cols-4",
};

function RateCell({ title, subtitle, counts, showFailed = true }: { title: string; subtitle: string; counts: ResultCounts; showFailed?: boolean }) {
  const d = counts.mention.d;
  const na = d === 0 ? (counts.requests === 0 ? "No responses" : "All requests failed") : undefined;
  const status = d === 0 ? "ok" : sampleStatus(d);
  return (
    <div className="flex min-w-0 flex-col gap-4 bg-surface p-4">
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold text-fg">{title}</p>
        <p className="truncate text-helper text-fg-muted" title={subtitle}>{subtitle}</p>
      </div>
      <Metric
        label="Mention rate"
        numerator={counts.mention.n}
        denominator={counts.mention.d}
        unit="successful"
        naReason={na}
        sampleStatus={status}
        basis={showFailed && counts.failed > 0 ? `${counts.failed} failed, excluded` : undefined}
      />
      <Metric label="Recommendation rate" numerator={counts.recommendation.n} denominator={counts.recommendation.d} unit="successful" naReason={na} sampleStatus="ok" />
    </div>
  );
}

function pct(counts: ResultCounts, key: "mention" | "recommendation"): number | null {
  return ratePercent(counts[key].n, counts[key].d);
}

function outcomeOf(response: ResponseSample) {
  if (response.status === "failed") return <Status kind="job" value="failed" />;
  const value = response.outcome === "recommended" ? "recommended" : response.outcome === "mentioned" ? "merely_mentioned" : "none";
  return <Status kind="recommendation" value={value} />;
}

export function ResultsSection({ results, channels, versions, status, storeId }: Props) {
  const [metric, setMetric] = useState<"mention" | "recommendation">("mention");
  const [view, setView] = useState<"pooled" | "provider">("pooled");
  const { runs, providers, pooled, latest, period } = results;

  const chart = useMemo(() => {
    const labels = runs.map((r) => formatShortDate(r.date));
    const point = (counts: ResultCounts, i: number) => ({
      x: labels[i],
      y: pct(counts, metric),
      numerator: counts[metric].n,
      denominator: counts[metric].d,
      detail: counts.failed ? `${counts.failed} failed, excluded` : undefined,
    });
    const series: LineSeries[] =
      view === "pooled"
        ? [{ id: "pooled", label: "All providers", tone: 1, points: runs.map((r, i) => point(r.pooled, i)) }]
        : channels.map((c) => ({ id: c.id, label: c.providerLabel, tone: c.tone, points: runs.map((r, i) => point(r.byChannel[c.id] ?? { mention: { n: 0, d: 0 }, recommendation: { n: 0, d: 0 }, failed: 0, requests: 0 }, i)) }));
    // Mark the first run that used each new wording version.
    const markers: { x: string; label: string }[] = [];
    for (const v of versions.filter((x) => x.version > 1)) {
      const idx = runs.findIndex((r) => Date.parse(r.date) >= Date.parse(v.changedAt));
      if (idx >= 0 && !markers.some((m) => m.x === labels[idx])) markers.push({ x: labels[idx], label: `v${v.version}` });
    }
    const values = series[0]?.points.map((p) => p.y).filter((y): y is number => y !== null) ?? [];
    const sizes = runs.map((r) => r.pooled.mention.d).filter((d) => d > 0);
    const summary = values.length >= 2 ? `${metric === "mention" ? "Mention" : "Recommendation"} rate per monitoring run, from ${values[0].toFixed(0)}% to ${values[values.length - 1].toFixed(0)}%.` : "Not enough runs for a trend.";
    return { series, markers, summary, minD: Math.min(...sizes, Infinity), maxD: Math.max(...sizes, 0) };
  }, [runs, channels, metric, view, versions]);

  if (runs.length === 0 && channels.length === 0) {
    return (
      <EmptyState
        icon="monitoring"
        title="Results are N/A"
        description="No AI provider is selected, so nothing is tracked. This is not 0%."
        action={
          <ButtonLink href={`/stores/${storeId}/settings`} variant="secondary">
            Choose providers
          </ButtonLink>
        }
      />
    );
  }

  if (runs.length === 0) {
    const archived = status === "archived";
    return (
      <EmptyState
        icon="monitoring"
        title="No results yet"
        description={archived ? "Archived prompts do not run." : status === "active" ? "Results appear after the next run." : "Only active prompts run."}
      />
    );
  }

  const cells = providers.map((p) => ({ id: p.channelId, title: p.label, subtitle: p.channelLabel, counts: p }));
  const requestsOk = pooled.requests - pooled.failed;

  return (
    <div className="flex flex-col gap-5">
      <Card as="section">
        <CardHeader
          title="By provider"
          subtitle={`${runs.length} monitoring ${runs.length === 1 ? "run" : "runs"}${period ? ` · ${period}` : ""}`}
          info="Failed requests are counted separately. They are never treated as the brand being absent."
        />
        <CardBody>
          <div className={cn("grid gap-px overflow-hidden rounded-card border border-line bg-line", GRID[Math.min(cells.length, 4)])}>
            {cells.map((cell) => (
              <RateCell key={cell.id} title={cell.title} subtitle={cell.subtitle} counts={cell.counts} />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <p className="text-helper font-medium text-fg-muted">Requests</p>
            <StackedBar
              unit="requests"
              segments={[
                { id: "ok", label: "Succeeded", value: requestsOk, tone: "success" },
                { id: "failed", label: "Failed, excluded from rates", value: pooled.failed, tone: "danger" },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader
          title="Trend"
          actions={
            <>
              <Segmented size="sm" label="Metric" value={metric} onChange={setMetric} options={[{ value: "mention", label: "Mention" }, { value: "recommendation", label: "Recommended" }]} />
              <Segmented size="sm" label="Breakdown" value={view} onChange={setView} options={[{ value: "pooled", label: "Pooled" }, { value: "provider", label: "Provider" }]} />
            </>
          }
        />
        <CardBody>
          {runs.length < 2 ? (
            <ChartEmpty title="Not enough runs" detail="A trend needs at least two monitoring runs." height={160} />
          ) : (
            <>
              <LineChart series={chart.series} summary={chart.summary} markers={chart.markers} yFormat={(v) => `${v.toFixed(0)}%`} yLabel={metric === "mention" ? "Mention rate" : "Recommendation rate"} />
              <p className="tnum mt-2 text-helper text-fg-muted">
                {chart.minD === chart.maxD ? chart.minD : `${chart.minD}–${chart.maxD}`} successful responses per point. Markers show new versions.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader title="Latest responses" subtitle="API answer samples" />
        <CardBody className="pt-2">
          {latest.length === 0 ? (
            <p className="text-body-sm text-fg-muted">No response samples yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {latest.map((response) => (
                <li key={response.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-body-sm font-medium text-fg">{response.providerLabel}</span>
                    <Mono>{response.runId}</Mono>
                    <span className="tnum text-helper text-fg-muted">{formatShortDate(response.requestedAt)} · sample {response.sample} · v{response.promptVersion}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {outcomeOf(response)}
                    <ResponseButton response={response} />
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
