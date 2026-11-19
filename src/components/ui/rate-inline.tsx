import { cn } from "@/lib/cn";
import { formatRate, ratePercent } from "@/lib/format";

/**
 * Compact rate for dense table cells: percentage with numerator / denominator always visible.
 * N/A (no denominator) is shown as N/A, never 0%. Use `Metric` for headline numbers.
 */
export function RateInline({ n, d, unit = "responses", className }: { n: number; d: number; unit?: string; className?: string }) {
  const pct = ratePercent(n, d);
  return (
    <div className={cn("tnum flex flex-col leading-tight", className)}>
      <span className="text-[13px] font-semibold text-fg">{pct === null ? "N/A" : formatRate(n, d)}</span>
      <span className="text-xs text-fg-subtle">{pct === null ? `No eligible ${unit}` : `${n} / ${d} ${unit}`}</span>
    </div>
  );
}
