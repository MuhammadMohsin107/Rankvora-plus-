import { cn } from "@/lib/cn";
import { formatPercent, ratePercent } from "@/lib/format";

/**
 * Compact single-series rate: bar + percentage + numerator / denominator.
 * Used in tables where a full Metric is too heavy. The counts are always visible.
 */
export function RateCell({ n, d, unit, className }: { n: number; d: number; unit?: string; className?: string }) {
  const pct = ratePercent(n, d);
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div
        role="img"
        aria-label={pct === null ? "N/A" : `${formatPercent(pct)} (${n} of ${d}${unit ? ` ${unit}` : ""})`}
        className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-surface-3 sm:w-28"
      >
        {pct !== null ? <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 0.8)}%` }} /> : null}
      </div>
      <span className="tnum whitespace-nowrap text-xs text-fg">
        <span className="font-semibold">{pct === null ? "N/A" : formatPercent(pct)}</span>
        {d > 0 ? <span className="text-fg-subtle"> · {n}/{d}</span> : null}
      </span>
    </div>
  );
}
