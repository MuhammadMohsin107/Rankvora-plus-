import { cn } from "@/lib/cn";
import { formatPercent, formatPoints, ratePercent } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { pointChange } from "@/lib/stats";

import { Badge, toneClass } from "../ui/badge";
import { Icon, type IconName } from "../ui/icon";

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

const AXIS_TICKS = [0, 25, 50, 75, 100] as const;

/** Hairline gridlines and the 0 baseline behind a bar track. Bars always start at 0 on a fixed 0-100% scale. */
function TrackGrid() {
  return (
    <>
      {AXIS_TICKS.slice(1).map((t) => (
        <span key={t} aria-hidden="true" className="absolute inset-y-0 w-px bg-grid" style={{ left: `${t}%` }} />
      ))}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-fg-faint" />
    </>
  );
}

/** Shared 0-100% axis labels. Mirrors the Bar layout (label column, track, value column) so ticks line up. */
function AxisRow({ labelWidth = "w-12", valueWidth = "w-30" }: { labelWidth?: string; valueWidth?: string }) {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <span className={cn("shrink-0", labelWidth)} />
      <div className="relative h-4 min-w-0 flex-1">
        {AXIS_TICKS.map((t) => (
          <span
            key={t}
            className={cn("tnum absolute top-0 text-helper text-fg-subtle", t === 0 ? "" : t === 100 ? "-translate-x-full" : "-translate-x-1/2", (t === 25 || t === 75) && "max-sm:hidden")}
            style={{ left: `${t}%` }}
          >
            {t}%
          </span>
        ))}
      </div>
      <span className={cn("shrink-0", valueWidth)} />
    </div>
  );
}

function Bar({ rate, ci, tone, label }: { rate: Rate | null; ci?: [number, number] | null; tone: "base" | "current"; label: string }) {
  const pct = rate ? ratePercent(rate.n, rate.d) : null;
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-12 shrink-0 text-helper text-fg-subtle">{label}</span>
      <div
        className="relative h-4 min-w-0 flex-1"
        role="img"
        aria-label={pct === null ? `${label}: N/A` : `${label}: ${formatPercent(pct)} (${rate!.n} of ${rate!.d})`}
      >
        <TrackGrid />
        {pct !== null && pct > 0 ? (
          <div
            className={cn("absolute inset-y-1 left-0 rounded-r-[4px]", tone === "base" ? "rv-hatch bg-series-other" : "bg-series-1")}
            style={{ width: `${Math.max(pct, 0.8)}%` }}
          />
        ) : null}
        {ci ? (
          <span aria-hidden="true" className="absolute top-1/2 h-px -translate-y-1/2 bg-fg" style={{ left: `${ci[0]}%`, width: `${Math.max(ci[1] - ci[0], 0.5)}%` }}>
            <span className="absolute -left-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
            <span className="absolute -right-px top-1/2 h-2 w-px -translate-y-1/2 bg-fg" />
          </span>
        ) : null}
      </div>
      <span className="tnum w-30 shrink-0 text-right text-helper text-fg">
        <span className="font-semibold">{pct === null ? "N/A" : formatPercent(pct)}</span>
        {rate && rate.d > 0 ? <span className="text-fg-subtle"> · {rate.n}/{rate.d}</span> : null}
      </span>
    </div>
  );
}

/**
 * Baseline vs current bars on a shared 0-100% axis, with numerator/denominator and the
 * change in percentage points (pp), never in %. Baseline is hatched grey, current is solid:
 * the two never rely on colour alone.
 */
export function BarCompare({ rows, baselineLabel = "Before", currentLabel = "Now", className }: { rows: BarCompareRow[]; baselineLabel?: string; currentLabel?: string; className?: string }) {
  const hasBars = rows.some((row) => !row.naReason);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => {
          const change = row.baseline && row.current ? pointChange(row.baseline, row.current) : null;
          const tone: Tone = change === null || change === 0 ? "neutral" : change > 0 ? "success" : "danger";
          const zeroBase = row.baseline && row.baseline.d > 0 && row.baseline.n === 0 && row.current && row.current.n > 0;
          return (
            <li key={row.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="truncate text-body-sm font-medium text-fg" title={row.label}>{row.label}</p>
                {row.sub ? <p className="truncate text-helper text-fg-subtle">{row.sub}</p> : null}
              </div>
              {row.naReason ? (
                <p className="flex items-center gap-1.5 text-helper text-fg-muted md:col-span-2"><Icon name="minus-circle" size={14} />{row.naReason}</p>
              ) : (
                <>
                  <div className="flex min-w-0 flex-col gap-1">
                    <Bar rate={row.baseline} ci={row.baselineCi} tone="base" label={baselineLabel} />
                    <Bar rate={row.current} ci={row.currentCi} tone="current" label={currentLabel} />
                  </div>
                  <div className="md:w-28 md:text-right">
                    <Badge tone={tone} icon={change === null || change === 0 ? "minus" : change > 0 ? "arrow-up" : "arrow-down"}>
                      <span className="tnum">{change === null ? "N/A" : formatPoints(change)}</span>
                    </Badge>
                    {zeroBase ? <p className="mt-0.5 text-helper text-fg-subtle">new from zero</p> : null}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {hasBars ? (
        <div className="md:grid md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] md:gap-4">
          <span className="hidden md:block" />
          <div className="min-w-0">
            <AxisRow />
          </div>
          <span className="hidden md:block md:w-28" />
        </div>
      ) : null}
    </div>
  );
}

const segTone: Record<Tone, string> = {
  success: "bg-success",
  accent: "bg-accent",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-series-other",
};

const segSeries = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  other: "bg-series-other",
} as const;

export type Segment = {
  id: string;
  label: string;
  value: number;
  /** Status colour. Use for states (success, failed, ...). */
  tone?: Tone;
  /** Categorical colour from the series palette. Takes precedence over `tone`. */
  series?: keyof typeof segSeries;
};

const segClass = (s: Segment) => (s.series ? segSeries[s.series] : segTone[s.tone ?? "neutral"]);

/**
 * One horizontal bar split into parts on a 0-100% axis, with a 2px surface gap between
 * segments and an explicit legend (label + count / total).
 */
export function StackedBar({ segments, unit = "responses", axis = true, className }: { segments: Segment[]; unit?: string; /** Show the 0-100% axis under the bar. Default true. */ axis?: boolean; className?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col">
        <div className="relative">
          <div
            className="flex h-3 w-full gap-0.5"
            role="img"
            aria-label={segments.map((s) => `${s.label}: ${s.value} of ${total}`).join("; ")}
          >
            {total > 0 ? (
              visible.map((s) => (
                <div
                  key={s.id}
                  title={`${s.label}: ${s.value} of ${total} ${unit}`}
                  className={cn("h-full rounded-[2px] first:rounded-l-[4px] last:rounded-r-[4px]", segClass(s))}
                  style={{ width: `${(s.value / total) * 100}%` }}
                />
              ))
            ) : (
              <div className="h-full w-full rounded-[4px] bg-surface-3" />
            )}
          </div>
          <span aria-hidden="true" className="absolute -left-px -top-0.5 h-4 w-px bg-fg-faint" />
        </div>
        {axis ? (
          <div className="relative mt-1 h-4" aria-hidden="true">
            {AXIS_TICKS.map((t) => (
              <span key={t} className={cn("tnum absolute top-0 text-helper text-fg-subtle", t === 0 ? "" : t === 100 ? "-translate-x-full" : "-translate-x-1/2", (t === 25 || t === 75) && "max-sm:hidden")} style={{ left: `${t}%` }}>
                {t}%
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {segments.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 text-helper">
            <span className="flex items-center gap-2 text-fg-muted">
              <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", segClass(s))} />
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

const cellIcon: Record<Tone, IconName> = {
  success: "check",
  warning: "alert-triangle",
  danger: "x",
  info: "info",
  accent: "circle-dot",
  neutral: "minus",
};

/** Row of small cells (one per run/day). Each cell carries a glyph as well as a tone, so status is never colour alone. */
export function HeatStrip({ cells, label, className }: { cells: { id: string; tone: Tone; title: string }[]; label: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ol className="flex flex-wrap gap-1" aria-label={label}>
        {cells.map((cell) => (
          <li key={cell.id} title={cell.title} aria-label={cell.title} className={cn("flex size-5 items-center justify-center rounded-[4px] border", toneClass[cell.tone])}>
            <Icon name={cellIcon[cell.tone]} size={12} strokeWidth={2} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Tiny trend line for tables and cards. Decorative: always pair with a number. */
export function Sparkline({ values, width = 96, height = 28, className }: { values: (number | null)[]; width?: number; height?: number; className?: string }) {
  const real = values.filter((v): v is number => v !== null);
  if (real.length < 2) return <span className="text-helper text-fg-subtle">—</span>;
  const min = Math.min(...real);
  const max = Math.max(...real);
  const span = max - min || 1;
  const pad = 4;
  const step = (width - pad * 2) / (values.length - 1);
  let d = "";
  let pen = false;
  let lastX = 0;
  let lastY = 0;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    const x = pad + i * step;
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    pen = true;
    lastX = x;
    lastY = y;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className={cn("shrink-0", className)}>
      <path d={d} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--surface)" stroke="var(--series-1)" strokeWidth="2" />
    </svg>
  );
}
