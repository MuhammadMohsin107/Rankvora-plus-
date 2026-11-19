import { cn } from "@/lib/cn";
import { formatPercent, formatPoints, ratePercent } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { pointChange } from "@/lib/stats";

import { Badge } from "../ui/badge";
import { Icon } from "../ui/icon";

type Rate = { n: number; d: number };

export type BarCompareRow = {
  id: string;
  label: string;
  sub?: string;
  baseline: Rate | null;
  current: Rate | null;
  /** Wilson (or other) intervals in %, drawn as whiskers. */
  baselineCi?: [number, number] | null;
  currentCi?: [number, number] | null;
  /** Shown instead of the bars, e.g. "Not supported by this provider". */
  naReason?: string;
};

function Bar({ rate, ci, tone, label }: { rate: Rate | null; ci?: [number, number] | null; tone: "base" | "current"; label: string }) {
  const pct = rate ? ratePercent(rate.n, rate.d) : null;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-12 shrink-0 text-xs text-fg-subtle">{label}</span>
      <div className="relative h-2.5 min-w-0 flex-1 rounded-full bg-surface-3" role="img" aria-label={pct === null ? `${label}: N/A` : `${label}: ${formatPercent(pct)} (${rate!.n} of ${rate!.d})`}>
        {pct !== null ? (
          <div className={cn("h-full rounded-full", tone === "base" ? "bg-fg-subtle/60" : "bg-accent")} style={{ width: `${Math.max(pct, 0.8)}%` }} />
        ) : null}
        {ci ? (
          <span aria-hidden="true" className="absolute top-1/2 h-px -translate-y-1/2 bg-fg" style={{ left: `${ci[0]}%`, width: `${Math.max(ci[1] - ci[0], 0.5)}%` }}>
            <span className="absolute -left-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
            <span className="absolute -right-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
          </span>
        ) : null}
      </div>
      <span className="tnum w-[7.5rem] shrink-0 text-right text-xs text-fg">
        <span className="font-semibold">{pct === null ? "N/A" : formatPercent(pct)}</span>
        {rate && rate.d > 0 ? <span className="text-fg-subtle"> · {rate.n}/{rate.d}</span> : null}
      </span>
    </div>
  );
}

/** Baseline vs current grouped bars with numerator/denominator, pp change and optional CI whiskers. */
export function BarCompare({ rows, baselineLabel = "Before", currentLabel = "Now", className }: { rows: BarCompareRow[]; baselineLabel?: string; currentLabel?: string; className?: string }) {
  return (
    <ul className={cn("flex flex-col divide-y divide-line", className)}>
      {rows.map((row) => {
        const change = row.baseline && row.current ? pointChange(row.baseline, row.current) : null;
        const tone: Tone = change === null || change === 0 ? "neutral" : change > 0 ? "success" : "danger";
        const zeroBase = row.baseline && row.baseline.d > 0 && row.baseline.n === 0 && row.current && row.current.n > 0;
        return (
          <li key={row.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-center md:gap-4">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg" title={row.label}>{row.label}</p>
              {row.sub ? <p className="truncate text-xs text-fg-subtle">{row.sub}</p> : null}
            </div>
            {row.naReason ? (
              <p className="flex items-center gap-1.5 text-xs text-fg-muted md:col-span-2"><Icon name="minus-circle" size={14} />{row.naReason}</p>
            ) : (
              <>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Bar rate={row.baseline} ci={row.baselineCi} tone="base" label={baselineLabel} />
                  <Bar rate={row.current} ci={row.currentCi} tone="current" label={currentLabel} />
                </div>
                <div className="md:w-28 md:text-right">
                  <Badge tone={tone} icon={change === null || change === 0 ? "minus" : change > 0 ? "arrow-up" : "arrow-down"}>
                    <span className="tnum">{change === null ? "N/A" : formatPoints(change)}</span>
                  </Badge>
                  {zeroBase ? <p className="mt-0.5 text-[11px] text-fg-subtle">new from zero</p> : null}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const segTone: Record<Tone, string> = {
  success: "bg-success",
  accent: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-fg-subtle/50",
};

export type Segment = { id: string; label: string; value: number; tone: Tone };

/** One horizontal bar split into parts, with an explicit legend (label + count + share). */
export function StackedBar({ segments, unit = "responses", className }: { segments: Segment[]; unit?: string; className?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value} of ${total}`).join("; ")}>
        {segments.map((s) =>
          s.value > 0 ? <div key={s.id} className={cn("h-full first:rounded-l-full last:rounded-r-full", segTone[s.tone])} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span aria-hidden="true" className={cn("size-2 rounded-sm", segTone[s.tone])} />
              {s.label}
            </span>
            <span className="tnum text-fg">
              {s.value}<span className="text-fg-subtle"> / {total} {unit}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Row of small cells (one per run/day) coloured by status, with text legend. */
export function HeatStrip({ cells, label, className }: { cells: { id: string; tone: Tone; title: string }[]; label: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ol className="flex flex-wrap gap-1" aria-label={label}>
        {cells.map((cell) => (
          <li key={cell.id} title={cell.title} aria-label={cell.title} className={cn("size-4 rounded-[4px]", segTone[cell.tone])} />
        ))}
      </ol>
    </div>
  );
}

/** Tiny trend line for tables and cards. Decorative: always pair with a number. */
export function Sparkline({ values, width = 96, height = 28, className }: { values: (number | null)[]; width?: number; height?: number; className?: string }) {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return <span className="text-xs text-fg-subtle">—</span>;
  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    const x = i * step;
    const y = height - 3 - ((v - min) / span) * (height - 6);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={cn("text-accent", className)}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
