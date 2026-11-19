"use client";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";
import { formatPercent, ratePercent } from "@/lib/format";
import type { TimelinePoint } from "@/types/monitoring";

type Props = {
  timeline: TimelinePoint[];
  providers: { channelId: string; label: string; tone: 1 | 2 | 3 | 4 | 5 }[];
  markers: { x: string; label: string }[];
};

const point = (label: string, rate: { n: number; d: number } | undefined) => {
  const pct = rate ? ratePercent(rate.n, rate.d) : null;
  return { x: label, y: pct, n: rate?.d, detail: rate && rate.d > 0 ? `${rate.n} / ${rate.d}` : "no successful samples" };
};

/** Mention rate per run: pooled line plus one line per provider, with n / d on every point. */
export function MentionTrend({ timeline, providers, markers }: Props) {
  const dashes = ["dashed", "dotted", "dashed"] as const;
  const series: LineSeries[] = [
    { id: "all", label: "All providers (pooled)", tone: 1, dash: "solid", points: timeline.map((p) => point(p.label, p.overall)) },
    ...providers.map<LineSeries>((prov, i) => ({
      id: prov.channelId,
      label: prov.label,
      tone: ((i % 3) + 2) as 2 | 3 | 4,
      dash: dashes[i % 3],
      points: timeline.map((p) => point(p.label, p.byProvider.find((b) => b.channelId === prov.channelId)?.rate)),
    })),
  ];
  const peak = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.y ?? 0)));
  const yMax = Math.min(100, Math.max(40, Math.ceil((peak + 5) / 20) * 20));
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const summary = `Pooled mention rate went from ${formatPercent(ratePercent(first.overall.n, first.overall.d))} (${first.overall.n} of ${first.overall.d}) on ${first.label} to ${formatPercent(ratePercent(last.overall.n, last.overall.d))} (${last.overall.n} of ${last.overall.d}) on ${last.label}.`;
  return <LineChart series={series} summary={summary} yFormat={(v) => `${Math.round(v)}%`} yMax={yMax} height={250} markers={markers} yLabel="Mentions ÷ successful responses" />;
}
