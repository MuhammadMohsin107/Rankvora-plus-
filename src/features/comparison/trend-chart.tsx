"use client";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";

export type TrendInput = { x: string; mention: { n: number; d: number }; recommendation: { n: number; d: number } };

const pct = (r: { n: number; d: number }) => (r.d > 0 ? (r.n / r.d) * 100 : null);

/**
 * Per-run rates over the matched cohort. Every point keeps its whole-number counts: the run's sample is
 * printed under its date and again in the tooltip and the data table. The axis starts at 0 and ends at 100%.
 */
export function TrendChart({ points, markers, summary }: { points: TrendInput[]; markers: { x: string; label: string }[]; summary: string }) {
  const series: LineSeries[] = [
    { id: "mention", label: "Mention rate", tone: 1, points: points.map((p) => ({ x: p.x, y: pct(p.mention), numerator: p.mention.n, denominator: p.mention.d })) },
    { id: "recommendation", label: "Recommendation rate", tone: 2, points: points.map((p) => ({ x: p.x, y: pct(p.recommendation), numerator: p.recommendation.n, denominator: p.recommendation.d })) },
  ];
  return <LineChart series={series} summary={summary} yFormat={(v) => `${Math.round(v)}%`} yMax={100} yLabel="% of successful responses" markers={markers} height={260} />;
}
