import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { countsText } from "@/features/comparison/metric-format";
import { cn } from "@/lib/cn";
import { formatPercent, formatPoints } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type { MetricResult } from "@/types/comparison";

/** One side of one row. `rate` is a fraction 0 to 1 (an average or n / d). `counts` is whole numbers only. */
export type BarSide = { rate: number | null; counts?: string | null; ci?: [number, number] | null };

export type RateBarRow = {
  id: string;
  label: string;
  sub?: string;
  baseline: BarSide;
  current: BarSide;
  /** Percentage-point change. */
  points: number | null;
  zeroBaseline?: boolean;
  /** Shown instead of bars when there is no data ("Not supported by this provider"). Never drawn as 0. */
  na?: string;
  /** For competitors, more is not better. */
  goodWhen?: "up" | "down";
};

const TICKS = [0, 25, 50, 75, 100] as const;

function Track({ side, tone, label }: { side: BarSide; tone: "baseline" | "current"; label: string }) {
  const pct = side.rate === null ? null : side.rate * 100;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="relative h-4 min-w-0 flex-1"
        role="img"
        aria-label={pct === null ? `${label}: N/A` : `${label}: ${formatPercent(pct)}${side.counts ? ` (${side.counts})` : ""}`}
      >
        {TICKS.slice(1).map((t) => (
          <span key={t} aria-hidden="true" className="absolute inset-y-0 w-px bg-grid" style={{ left: `${t}%` }} />
        ))}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-fg-faint" />
        {pct !== null && pct > 0 ? (
          <span className={cn("absolute inset-y-1 left-0 rounded-r-[4px]", tone === "baseline" ? "rv-hatch bg-series-other" : "bg-series-1")} style={{ width: `${Math.max(pct, 0.8)}%` }} />
        ) : null}
        {side.ci ? (
          <span aria-hidden="true" className="absolute top-1/2 h-px -translate-y-1/2 bg-fg" style={{ left: `${side.ci[0]}%`, width: `${Math.max(side.ci[1] - side.ci[0], 0.5)}%` }}>
            <span className="absolute -left-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
            <span className="absolute -right-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
          </span>
        ) : null}
      </div>
      <span className="tnum w-36 shrink-0 text-right text-helper text-fg">
        <span className="font-semibold">{pct === null ? "N/A" : formatPercent(pct)}</span>
        {side.counts ? <span className="text-fg-subtle"> · {side.counts}</span> : null}
      </span>
    </div>
  );
}

/** Legend once, above the chart. Baseline is hatched grey, current is solid: never colour alone. */
export function BarLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-helper text-fg-muted" aria-label="Legend">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="rv-hatch h-2.5 w-5 rounded-[3px] bg-series-other" />
        Baseline
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="h-2.5 w-5 rounded-[3px] bg-series-1" />
        Current
      </li>
    </ul>
  );
}

/**
 * Baseline and current bars on one fixed 0 to 100% axis, anchored at zero (never truncated), with the change in
 * percentage points. Each value carries its whole-number counts; averages are labelled by the caller's footnote.
 */
export function RateBars({ rows, className }: { rows: RateBarRow[]; className?: string }) {
  const hasBars = rows.some((r) => !r.na);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <BarLegend />
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => {
          const tone: Tone = row.points === null || row.points === 0 ? "neutral" : (row.points > 0) === ((row.goodWhen ?? "up") === "up") ? "success" : "danger";
          return (
            <li key={`${row.id}:${row.label}`} className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-fg" title={row.label}>{row.label}</p>
                {row.sub ? <p className="text-helper text-fg-subtle">{row.sub}</p> : null}
              </div>
              {row.na ? (
                <p className="flex items-center gap-1.5 text-helper text-fg-muted md:col-span-2"><Icon name="minus-circle" size={14} />{row.na}</p>
              ) : (
                <>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Track side={row.baseline} tone="baseline" label={`${row.label} baseline`} />
                    <Track side={row.current} tone="current" label={`${row.label} current`} />
                  </div>
                  <div className="md:text-right">
                    <Badge tone={tone} icon={row.points === null || row.points === 0 ? "minus" : row.points > 0 ? "arrow-up" : "arrow-down"}>
                      <span className="tnum">{formatPoints(row.points)}</span>
                    </Badge>
                    {row.zeroBaseline ? <p className="mt-0.5 text-helper text-fg-subtle">new from zero</p> : null}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {hasBars ? (
        <div className="md:grid md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_6.5rem] md:gap-4" aria-hidden="true">
          <span className="hidden md:block" />
          <div className="flex items-center gap-2.5">
            <div className="relative h-4 min-w-0 flex-1">
              {TICKS.map((t) => (
                <span key={t} className={cn("tnum absolute top-0 text-helper text-fg-subtle", t === 0 ? "" : t === 100 ? "-translate-x-full" : "-translate-x-1/2", (t === 25 || t === 75) && "max-sm:hidden")} style={{ left: `${t}%` }}>
                  {t}%
                </span>
              ))}
            </div>
            <span className="w-36 shrink-0" />
          </div>
          <span className="hidden md:block" />
        </div>
      ) : null}
    </div>
  );
}

/** A metric as a bar row: headline rates (average or pooled), whole-number counts, interval only when valid. */
export function metricBarRow(m: MetricResult, opts: { label?: string; sub?: string } = {}): RateBarRow {
  return {
    id: m.id,
    label: opts.label ?? m.label,
    sub: opts.sub,
    baseline: { rate: m.baselineRate, counts: countsText(m, "baseline"), ci: m.baselineCi },
    current: { rate: m.currentRate, counts: countsText(m, "current"), ci: m.currentCi },
    points: m.pointChange,
    zeroBaseline: m.zeroBaseline,
    na: m.na,
    goodWhen: m.goodWhen,
  };
}
