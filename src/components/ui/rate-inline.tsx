import { cn } from "@/lib/cn";
import { formatNumber, formatRate, ratePercent } from "@/lib/format";

type RateInlineProps = {
  /** Numerator: responses (or items) that met the condition. */
  n: number;
  /** Denominator: eligible responses. Zero means no rate exists, which renders as N/A, never 0%. */
  d: number;
  unit?: string;
  className?: string;
  align?: "left" | "right";
  /** Hide the "n / d unit" line in very tight cells (the full text stays in the title). */
  compact?: boolean;
};

/**
 * Compact rate for dense table cells: percentage with numerator / denominator always visible.
 * N/A (no denominator) is shown as N/A, never 0%. Use `Metric` for headline numbers.
 */
export function RateInline({ n, d, unit = "responses", className, align = "left", compact }: RateInlineProps) {
  const valid = Number.isFinite(n) && Number.isFinite(d) && d > 0 && n >= 0;
  const pct = valid ? ratePercent(n, d) : null;
  const fraction = pct === null ? `No eligible ${unit}` : `${formatNumber(n)} / ${formatNumber(d)} ${unit}`;
  const spoken = pct === null ? `Not available. ${fraction}.` : `${formatRate(n, d)}, ${formatNumber(n)} of ${formatNumber(d)} ${unit}`;
  return (
    <div title={pct === null ? fraction : `${formatRate(n, d)} (${formatNumber(n)} of ${formatNumber(d)} ${unit})`} className={cn("tnum flex min-w-0 max-w-full flex-col leading-tight", align === "right" && "items-end text-right", className)}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className="truncate text-[13px] font-semibold text-fg">{pct === null ? "N/A" : formatRate(n, d)}</span>
      {compact ? null : (
        <span aria-hidden="true" className="max-w-full truncate text-xs text-fg-muted">
          {fraction}
        </span>
      )}
    </div>
  );
}
