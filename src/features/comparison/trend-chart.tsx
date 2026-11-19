"use client";

import { LineChart, type LineSeries } from "@/components/charts/line-chart";

export type TrendInput = { x: string; mention: { n: number; d: number }; recommendation: { n: number; d: number } };

const pct = (r: { n: number; d: number }) => (r.d > 0 ? (r.n / r.d) * 100 : null);

/** Per-run rates over the matched cohort, with the sample behind each point in the tooltip. */
export function TrendChart({ points, markers, summary }: { points: TrendInput[]; markers: { x: string; label: string }[]; summary: string }) {
  const series: LineSeries[] = [
    { id: "mention", label: "Mention rate", tone: 1, points: points.map((p) => ({ x: p.x, y: pct(p.mention), n: p.mention.d, detail: `${p.mention.n} / ${p.mention.d}` })) },
    { id: "recommendation", label: "Recommendation rate", tone: 2, points: points.map((p) => ({ x: p.x, y: pct(p.recommendation), n: p.recommendation.d, detail: `${p.recommendation.n} / ${p.recommendation.d}` })) },
  ];
  return <LineChart series={series} summary={summary} yFormat={(v) => `${Math.round(v)}%`} yMax={100} markers={markers} height={250} />;
}
