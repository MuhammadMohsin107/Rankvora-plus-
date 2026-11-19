"use client";

import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@/lib/cn";

export type LinePoint = { x: string; y: number | null; /** sample size behind the point */ n?: number; /** denominator label, e.g. "18 / 48" */ detail?: string };
export type LineSeries = {
  id: string;
  label: string;
  points: LinePoint[];
  /** 1–5 → --series-N */
  tone?: 1 | 2 | 3 | 4 | 5;
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
  /** Fixed y max (e.g. 100 for rates) or "auto". */
  yMax?: number | "auto";
  height?: number;
  /** Vertical event markers, e.g. a completed Fixes task. */
  markers?: { x: string; label: string }[];
  yLabel?: string;
  className?: string;
};

const W = 640;
const M = { l: 44, r: 26, t: 16, b: 30 };
const dashes = { solid: undefined, dashed: "7 4", dotted: "1.5 4" } as const;

function Marker({ shape, x, y, color, size = 3.6 }: { shape: number; x: number; y: number; color: string; size?: number }) {
  const common = { fill: "var(--surface)", stroke: color, strokeWidth: 1.8 } as const;
  switch (shape % 5) {
    case 0:
      return <circle cx={x} cy={y} r={size} {...common} />;
    case 1:
      return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1} {...common} />;
    case 2:
      return <path d={`M${x} ${y - size - 0.8}L${x + size + 0.8} ${y + size}L${x - size - 0.8} ${y + size}Z`} {...common} />;
    case 3:
      return <path d={`M${x} ${y - size - 1}L${x + size + 1} ${y}L${x} ${y + size + 1}L${x - size - 1} ${y}Z`} {...common} />;
    default:
      return <path d={`M${x - size} ${y - size}L${x + size} ${y + size}M${x + size} ${y - size}L${x - size} ${y + size}`} fill="none" stroke={color} strokeWidth={1.8} />;
  }
}

function niceMax(value: number) {
  if (value <= 0) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const f = value / exp;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * exp;
}

export function LineChart({ series, summary, yFormat: yFormatProp, percent = false, yMax = 100, height = 230, markers = [], yLabel, className }: LineChartProps) {
  const yFormat = yFormatProp ?? (percent ? (v: number) => `${Math.round(v)}%` : (v: number) => String(v));
  const uid = useId();
  const categories = series[0]?.points.map((p) => p.x) ?? [];
  const count = categories.length;
  const [hover, setHover] = useState<number | null>(null);

  const max = yMax === "auto" ? niceMax(Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.y ?? 0))) * 1.1) : yMax;
  const innerW = W - M.l - M.r;
  const innerH = height - M.t - M.b;
  const xAt = (i: number) => M.l + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const yAt = (v: number) => M.t + innerH - (v / max) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(count / 7));

  const colorOf = (s: LineSeries, i: number) => `var(--series-${s.tone ?? ((i % 5) + 1)})`;

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const idx = count <= 1 ? 0 : Math.round(((x - M.l) / innerW) * (count - 1));
    setHover(Math.max(0, Math.min(count - 1, idx)));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setHover((h) => Math.min(count - 1, (h ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setHover((h) => Math.max(0, (h ?? count) - 1));
    } else if (event.key === "Escape") setHover(null);
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

  const hoverPct = hover === null ? 0 : (xAt(hover) / W) * 100;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
        {series.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1.5 text-xs text-fg-muted">
            <svg width="26" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="26" y2="5" stroke={colorOf(s, i)} strokeWidth="2" strokeDasharray={dashes[s.dash ?? (i % 3 === 0 ? "solid" : i % 3 === 1 ? "dashed" : "dotted")]} />
              <Marker shape={i} x={13} y={5} color={colorOf(s, i)} size={3} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>

      <div
        className="relative rounded-control outline-offset-2"
        tabIndex={0}
        role="group"
        aria-label={`Line chart. ${summary} Use left and right arrow keys to read each point.`}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full touch-pan-y" onPointerMove={onPointer} onPointerLeave={() => setHover(null)} role="img" aria-labelledby={`${uid}-t`}>
          <title id={`${uid}-t`}>{summary}</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={yAt(t)} y2={yAt(t)} stroke="var(--grid)" strokeWidth="1" />
              <text x={M.l - 8} y={yAt(t) + 4} textAnchor="end" className="tnum fill-fg-subtle" fontSize="11">{yFormat(t)}</text>
            </g>
          ))}
          {yLabel ? <text x={M.l} y={10} className="fill-fg-subtle" fontSize="10.5">{yLabel}</text> : null}
          {categories.map((c, i) => (i % labelEvery === 0 || i === count - 1 ? (
            <text key={c + i} x={xAt(i)} y={height - 9} textAnchor="middle" className="tnum fill-fg-subtle" fontSize="11">{c}</text>
          ) : null))}
          {markers.map((mk) => {
            const idx = categories.indexOf(mk.x);
            if (idx < 0) return null;
            return (
              <g key={mk.x + mk.label}>
                <line x1={xAt(idx)} x2={xAt(idx)} y1={M.t} y2={M.t + innerH} stroke="var(--fg-subtle)" strokeWidth="1" strokeDasharray="3 3" />
                <text x={xAt(idx) + 4} y={M.t + 10} className="fill-fg-muted" fontSize="10.5">{mk.label}</text>
              </g>
            );
          })}
          {hover !== null ? <line x1={xAt(hover)} x2={xAt(hover)} y1={M.t} y2={M.t + innerH} stroke="var(--line-strong)" strokeWidth="1" /> : null}
          {series.map((s, i) => (
            <g key={s.id}>
              <path d={pathFor(s)} fill="none" stroke={colorOf(s, i)} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dashes[s.dash ?? (i % 3 === 0 ? "solid" : i % 3 === 1 ? "dashed" : "dotted")]} />
              {s.points.map((p, pi) => {
                if (p.y === null) return null;
                const show = count <= 14 || hover === pi || pi === count - 1;
                return show ? <Marker key={pi} shape={i} x={xAt(pi)} y={yAt(p.y)} color={colorOf(s, i)} size={hover === pi ? 4.6 : 3.4} /> : null;
              })}
            </g>
          ))}
        </svg>

        {hover !== null ? (
          <div
            role="status"
            style={{ left: `${Math.min(78, Math.max(8, hoverPct))}%` }}
            className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-control border border-line bg-surface px-2.5 py-2 text-xs shadow-pop"
          >
            <p className="tnum mb-1 font-medium text-fg">{categories[hover]}</p>
            {series.map((s, i) => {
              const p = s.points[hover];
              return (
                <p key={s.id} className="tnum flex items-center justify-between gap-4 text-fg-muted">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="inline-block size-2 rounded-full" style={{ background: colorOf(s, i) }} />
                    {s.label}
                  </span>
                  <span className="font-medium text-fg">
                    {p?.y === null || p === undefined ? "No data" : yFormat(p.y)}
                    {p?.detail ? <span className="ml-1 font-normal text-fg-subtle">({p.detail})</span> : p?.n !== undefined ? <span className="ml-1 font-normal text-fg-subtle">(n={p.n})</span> : null}
                  </span>
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      <details className="text-xs text-fg-muted">
        <summary className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:text-fg">View data table</summary>
        <div className="ui-scroll mt-2 overflow-x-auto">
          <table className="tnum w-full min-w-max border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-fg-subtle">
                <th scope="col" className="py-1 pr-4 font-medium">Point</th>
                {series.map((s) => (
                  <th key={s.id} scope="col" className="py-1 pr-4 font-medium">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c, i) => (
                <tr key={c + i} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1 pr-4 text-left font-normal text-fg">{c}</th>
                  {series.map((s) => {
                    const p = s.points[i];
                    return (
                      <td key={s.id} className="py-1 pr-4 text-fg">
                        {p?.y === null || p === undefined ? "No data" : yFormat(p.y)}
                        {p?.detail ? <span className="text-fg-subtle"> ({p.detail})</span> : null}
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
