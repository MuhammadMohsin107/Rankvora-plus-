"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@/lib/cn";

import { ChartEmpty, ChartError, ChartSkeleton } from "./chart-states";

export type LinePoint = {
  x: string;
  y: number | null;
  /** sample size behind the point */
  n?: number;
  /** denominator label, e.g. "18 / 48" (used when numerator/denominator are not given) */
  detail?: string;
  /** rate inputs: shown as "18 of 48" in the tooltip and table */
  numerator?: number;
  denominator?: number;
};

export type SeriesTone = 1 | 2 | 3 | 4 | 5 | "other";

export type LineSeries = {
  id: string;
  label: string;
  points: LinePoint[];
  /** 1-5 maps to --series-N, "other" to the neutral --series-other */
  tone?: SeriesTone;
  dash?: "solid" | "dashed" | "dotted";
};

type LineChartProps = {
  series: LineSeries[];
  /** Plain-language summary for screen readers (key insight). */
  summary: string;
  /** Client-side formatter. Server components should pass `percent` instead (functions are not serialisable). */
  yFormat?: (value: number) => string;
  /** Format the y axis as whole percentages. */
  percent?: boolean;
  /** Fixed y max (e.g. 100 for rates) or "auto". The y axis always starts at 0. */
  yMax?: number | "auto";
  height?: number;
  /** Vertical event markers, e.g. a completed Fixes task. */
  markers?: { x: string; label: string }[];
  /** Y axis title. For rates say "rate (%)"; changes between points are shown as "pp" (percentage points). */
  yLabel?: string;
  /** Show the sample size under each x label when the data has it. Default true. */
  showSamples?: boolean;
  loading?: boolean;
  /** Renders the error state instead of the chart. */
  error?: string;
  /** Message for the empty state. */
  emptyText?: string;
  className?: string;
};

const M = { l: 48, t: 16 };
/** solid, dashed, dotted, dash-dot, short dash: one per series so colour is never the only cue */
const DASHES = [undefined, "7 4", "2 4", "10 4 2 4", "4 3"] as const;
const DASH_BY_NAME = { solid: undefined, dashed: "7 4", dotted: "2 4" } as const;
const MARKER_R = 4; // 8px marker

function Marker({ shape, x, y, color, size = MARKER_R }: { shape: number; x: number; y: number; color: string; size?: number }) {
  const common = { fill: "var(--surface)", stroke: color, strokeWidth: 2 } as const;
  switch (shape % 5) {
    case 0:
      return <circle cx={x} cy={y} r={size} {...common} />;
    case 1:
      return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5} {...common} />;
    case 2:
      return <path d={`M${x} ${y - size - 1}L${x + size + 1} ${y + size}L${x - size - 1} ${y + size}Z`} strokeLinejoin="round" {...common} />;
    case 3:
      return <path d={`M${x} ${y - size - 1.5}L${x + size + 1.5} ${y}L${x} ${y + size + 1.5}L${x - size - 1.5} ${y}Z`} strokeLinejoin="round" {...common} />;
    default:
      return <path d={`M${x - size} ${y - size}L${x + size} ${y + size}M${x + size} ${y - size}L${x - size} ${y + size}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
  }
}

function niceMax(value: number) {
  if (value <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * exp;
}

const colorOf = (s: LineSeries, i: number) => `var(--series-${s.tone ?? (i % 5) + 1})`;
const dashOf = (s: LineSeries, i: number) => (s.dash ? DASH_BY_NAME[s.dash] : DASHES[i % DASHES.length]);

function sampleOf(p: LinePoint | undefined): number | undefined {
  return p?.n ?? p?.denominator;
}

function basisText(p: LinePoint | undefined): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.numerator !== undefined && p.denominator !== undefined) parts.push(`${p.numerator} of ${p.denominator}`);
  else if (p.detail) parts.push(p.detail);
  if (p.n !== undefined && p.denominator === undefined) parts.push(`n=${p.n}`);
  else if (p.n !== undefined && p.n !== p.denominator) parts.push(`n=${p.n}`);
  return parts.length ? parts.join(", ") : null;
}

export function LineChart({
  series,
  summary,
  yFormat: yFormatProp,
  percent = false,
  yMax = 100,
  height = 240,
  markers = [],
  yLabel,
  showSamples = true,
  loading,
  error,
  emptyText,
  className,
}: LineChartProps) {
  const yFormat = yFormatProp ?? (percent ? (v: number) => `${Math.round(v)}%` : (v: number) => String(v));
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  const categories = series[0]?.points.map((p) => p.x) ?? [];
  const count = categories.length;
  const hasData = series.some((s) => s.points.some((p) => p.y !== null));
  const isPct = percent || yFormat(0).endsWith("%");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, error, hasData]);

  const sampleRow = useMemo(() => {
    if (!showSamples) return null;
    const row = categories.map((_, i) => {
      const ns = series.map((s) => sampleOf(s.points[i])).filter((v): v is number => v !== undefined);
      if (ns.length === 0) return null;
      const lo = Math.min(...ns);
      const hi = Math.max(...ns);
      return lo === hi ? `n=${lo}` : `n=${lo}–${hi}`;
    });
    return row.some((v) => v !== null) ? row : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, showSamples]);

  if (error) return <ChartError detail={error} height={height} className={className} />;
  if (loading) return <ChartSkeleton height={height} className={className} />;
  if (!hasData || count === 0) return <ChartEmpty detail={emptyText ?? "Run a check to see this trend."} height={height} className={className} />;

  const max = yMax === "auto" ? niceMax(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.y ?? 0))) * 1.1) : yMax;
  const directLabels = series.length >= 2 && series.length <= 4 && width >= 520;
  const longest = Math.max(0, ...series.map((s) => Math.min(s.label.length, 22)));
  const R = directLabels ? Math.min(168, Math.max(64, longest * 6.6 + 18)) : 20;
  const B = 28 + (sampleRow ? 16 : 0);
  const innerW = Math.max(40, width - M.l - R);
  const innerH = height - M.t - B;
  const xAt = (i: number) => M.l + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const yAt = (v: number) => M.t + innerH - (Math.min(v, max) / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerW / 68))));
  const showAllMarkers = count <= 14;

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const idx = count <= 1 ? 0 : Math.round(((x - M.l) / innerW) * (count - 1));
    setActive(Math.max(0, Math.min(count - 1, idx)));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((h) => Math.min(count - 1, (h ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((h) => Math.max(0, (h ?? count) - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    } else if (event.key === "Escape") setActive(null);
  };

  const pathFor = (s: LineSeries) => {
    let d = "";
    let pen = false;
    s.points.forEach((p, i) => {
      if (p.y === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  // direct labels at each line's last real point, pushed apart so they never overlap
  const endLabels = directLabels
    ? (() => {
        const items = series
          .map((s, i) => {
            let last = -1;
            s.points.forEach((p, pi) => {
              if (p.y !== null) last = pi;
            });
            return last < 0 ? null : { id: s.id, i, label: s.label.length > 22 ? `${s.label.slice(0, 21)}…` : s.label, x: xAt(last) + 12, y: yAt(s.points[last].y as number) };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)
          .sort((a, b) => a.y - b.y);
        for (let k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 14) items[k].y = items[k - 1].y + 14;
        return items;
      })()
    : [];

  const tipLeft = active === null ? 0 : Math.min(width - 110, Math.max(110, xAt(active)));
  const prevOf = (s: LineSeries, idx: number) => {
    for (let k = idx - 1; k >= 0; k--) if (s.points[k]?.y !== null && s.points[k]?.y !== undefined) return s.points[k].y as number;
    return null;
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {series.length >= 2 ? (
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
          {series.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 text-helper text-fg-muted">
              <svg width="28" height="12" aria-hidden="true">
                <line x1="0" y1="6" x2="28" y2="6" stroke={colorOf(s, i)} strokeWidth="2" strokeDasharray={dashOf(s, i)} />
                <Marker shape={i} x={14} y={6} color={colorOf(s, i)} size={3.5} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={wrapRef}
        className="relative rounded-control outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        tabIndex={0}
        role="group"
        aria-label={`Line chart. ${summary} Use left and right arrow keys to read each point.`}
        onKeyDown={onKey}
        onFocus={() => setActive((a) => a ?? count - 1)}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full touch-pan-y" onPointerMove={onPointer} onPointerLeave={() => setActive(null)} role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>{summary}</title>
          {ticks.map((t, ti) => (
            <g key={t}>
              <line x1={M.l} x2={M.l + innerW} y1={yAt(t)} y2={yAt(t)} stroke={ti === 0 ? "var(--line-strong)" : "var(--grid)"} strokeWidth="1" />
              <text x={M.l - 10} y={yAt(t) + 4} textAnchor="end" className="tnum fill-fg-subtle" fontSize="12">{yFormat(t)}</text>
            </g>
          ))}
          {yLabel ? <text x={M.l} y={9} className="fill-fg-subtle" fontSize="12">{yLabel}</text> : null}
          {categories.map((c, i) => (i % labelEvery === 0 || i === count - 1 ? (
            <g key={c + i}>
              <text x={xAt(i)} y={height - B + 18} textAnchor="middle" className="tnum fill-fg-subtle" fontSize="12">{c}</text>
              {sampleRow?.[i] ? <text x={xAt(i)} y={height - B + 33} textAnchor="middle" className="tnum fill-fg-faint" fontSize="11">{sampleRow[i]}</text> : null}
            </g>
          ) : null))}
          {markers.map((mk) => {
            const idx = categories.indexOf(mk.x);
            if (idx < 0) return null;
            return (
              <g key={mk.x + mk.label}>
                <line x1={xAt(idx)} x2={xAt(idx)} y1={M.t} y2={M.t + innerH} stroke="var(--fg-faint)" strokeWidth="1" strokeDasharray="3 3" />
                <text x={xAt(idx) + 4} y={M.t + 11} className="fill-fg-muted" fontSize="12">{mk.label}</text>
              </g>
            );
          })}
          {active !== null ? <line x1={xAt(active)} x2={xAt(active)} y1={M.t} y2={M.t + innerH} stroke="var(--fg-faint)" strokeWidth="1" /> : null}
          {series.map((s, i) => (
            <g key={s.id}>
              <path d={pathFor(s)} fill="none" stroke={colorOf(s, i)} strokeWidth="2" strokeLinejoin="round" strokeLinecap={dashOf(s, i) ? "butt" : "round"} strokeDasharray={dashOf(s, i)} />
              {s.points.map((p, pi) => {
                if (p.y === null) return null;
                const show = showAllMarkers || active === pi || pi === count - 1;
                return show ? <Marker key={pi} shape={i} x={xAt(pi)} y={yAt(p.y)} color={colorOf(s, i)} size={active === pi ? MARKER_R + 1 : MARKER_R} /> : null;
              })}
            </g>
          ))}
          {endLabels.map((l) => (
            <text key={l.id} x={l.x} y={l.y + 4} className="fill-fg" fontSize="12" fontWeight="500">{l.label}</text>
          ))}
        </svg>

        {active !== null ? (
          <div
            role="status"
            style={{ left: tipLeft }}
            className="pointer-events-none absolute top-2 z-10 w-max max-w-[min(260px,90%)] -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 text-helper shadow-pop"
          >
            <p className="tnum mb-1 font-medium text-fg">{categories[active]}</p>
            {series.map((s, i) => {
              const p = s.points[active];
              const basis = basisText(p);
              const prev = p && p.y !== null ? prevOf(s, active) : null;
              const change = p && p.y !== null && prev !== null ? p.y - prev : null;
              return (
                <div key={s.id} className="tnum py-0.5 text-fg-muted">
                  <p className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="10" aria-hidden="true">
                        <Marker shape={i} x={7} y={5} color={colorOf(s, i)} size={2.8} />
                      </svg>
                      {s.label}
                    </span>
                    <span className="font-medium text-fg">{p?.y === null || p === undefined ? "No data" : yFormat(p.y)}</span>
                  </p>
                  {basis ? <p className="pl-5 text-fg-subtle">{basis}</p> : null}
                  {change !== null && change !== 0 ? (
                    <p className="pl-5 text-fg-subtle">
                      {change > 0 ? "+" : "−"}
                      {Math.abs(change).toFixed(1)}
                      {isPct ? " pp" : ""} vs previous point
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <details className="text-helper text-fg-muted">
        <summary className="inline-flex min-h-6 cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">View data table</summary>
        <div className="ui-scroll mt-2 overflow-x-auto" tabIndex={0} role="group" aria-label={`${summary} Scrollable table.`}>
          <table className="tnum w-full min-w-max border-collapse text-helper">
            <caption className="sr-only">{summary}</caption>
            <thead>
              <tr className="border-b border-line text-left text-fg-subtle">
                <th scope="col" className="py-1.5 pr-4 font-medium">Point</th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="py-1.5 pr-4 font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c + i} className="border-b border-line-soft last:border-0">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal text-fg">{c}</th>
                  {series.map((s) => {
                    const p = s.points[i];
                    const basis = basisText(p);
                    return (
                      <td key={s.id} className="py-1.5 pr-4 text-fg">
                        {p?.y === null || p === undefined ? "No data" : yFormat(p.y)}
                        {basis ? <span className="text-fg-subtle"> ({basis})</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
