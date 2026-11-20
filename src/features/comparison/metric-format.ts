/**
 * How a comparison metric is written down. Pure, so the display rules can be unit-tested.
 *
 * Rules (the macro-average problem):
 *  - A figure built from per-slot rates is an average. It is labelled "average" and is never printed as a count.
 *  - Counts are always whole numbers: the successful responses of the matched cohort, counted once each.
 *  - A confidence interval is shown only when it is valid for the counts shown (see engine.computeMetric).
 *  - Missing data reads "N/A" with a reason, never 0.
 */
import { formatPercent, formatPoints, pluralize } from "@/lib/format";
import type { MetricResult } from "@/types/comparison";

export type Side = "baseline" | "current";

export const rateOf = (metric: MetricResult, side: Side): number | null => (side === "baseline" ? metric.baselineRate : metric.currentRate);

export const countsOf = (metric: MetricResult, side: Side) => (side === "baseline" ? metric.baseline : metric.current);

/** "42.1%" or "N/A". */
export function percentText(metric: MetricResult, side: Side): string {
  const rate = rateOf(metric, side);
  return rate === null || metric.na ? "N/A" : formatPercent(rate * 100);
}

/** "17 of 38 responses": whole numbers only. Null when the metric has no counts. */
export function countsText(metric: MetricResult, side: Side): string | null {
  const counts = countsOf(metric, side);
  if (!counts || metric.na) return null;
  return `${counts.n} of ${counts.d} ${metric.unit}`;
}

/** What the percentage is: "average of 36 matched slots" or "matched responses". */
export function basisText(metric: MetricResult): string {
  if (metric.na) return metric.na;
  return metric.basis === "average" ? `average of ${pluralize(metric.cohort, "matched slot")}` : `${pluralize(metric.cohort, "matched slot")}, pooled`;
}

export function intervalText(metric: MetricResult, side: Side): string | null {
  const ci = side === "baseline" ? metric.baselineCi : metric.currentCi;
  return ci ? `95% interval ${ci[0].toFixed(0)}–${ci[1].toFixed(0)}%` : null;
}

/** "+11.5 pp" for the change between two rates. Percentage points, never "%". */
export function pointsText(metric: MetricResult): string {
  return metric.na || metric.pointChange === null ? "N/A" : formatPoints(metric.pointChange);
}

/** Relative change in %, a different quantity from percentage points. */
export function relativeText(metric: MetricResult): string {
  if (metric.na) return "N/A";
  if (metric.zeroBaseline) return "new from zero";
  if (metric.relativeChange === null) return "N/A";
  const sign = metric.relativeChange > 0 ? "+" : metric.relativeChange < 0 ? "−" : "";
  return `${sign}${formatPercent(Math.abs(metric.relativeChange))}`;
}

/** True when every count of the metric is a whole number (it must always be). */
export function hasIntegerCounts(metric: MetricResult): boolean {
  return [metric.baseline, metric.current, metric.pooledBaseline, metric.pooledCurrent].every((r) => r === null || (Number.isInteger(r.n) && Number.isInteger(r.d)));
}

/** A rate and the text under it, for one side of one metric. */
export type Figure = {
  percent: string;
  /** Whole-number counts, or null. */
  counts: string | null;
  /** "average of 36 matched slots", "36 matched slots, pooled", or the N/A reason. */
  basis: string;
  interval: string | null;
};

export function figure(metric: MetricResult, side: Side): Figure {
  return { percent: percentText(metric, side), counts: countsText(metric, side), basis: basisText(metric), interval: intervalText(metric, side) };
}
