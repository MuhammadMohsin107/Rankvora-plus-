"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import { formatDate, formatShortDate } from "@/lib/format";

import { Button } from "./button";
import { Field, Input } from "./form";
import { Icon } from "./icon";
import { Popover } from "./popover";

export type DatePreset = "7d" | "30d" | "90d" | "period" | "custom";
/** Dates are calendar days as `YYYY-MM-DD` (inclusive on both ends). */
export type DateRangeValue = { preset: DatePreset; from: string; to: string };
export type DatePeriod = { from: string; to: string; label?: string };

const DAY_MS = 86_400_000;
const PRESET_DAYS: Record<"7d" | "30d" | "90d", number> = { "7d": 7, "30d": 30, "90d": 90 };
const PRESET_LABEL: Record<DatePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  period: "This period",
  custom: "Custom",
};

/* ------------------------------------------------------------------ */
/* Pure helpers (unit-tested). No Date.now() / new Date() without args. */
/* ------------------------------------------------------------------ */

/** UTC milliseconds for a `YYYY-MM-DD` string, or null when it is not a real calendar day. */
export function parseIsoDate(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  return back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === day ? ms : null;
}

export function addDays(iso: string, days: number): string {
  const ms = parseIsoDate(iso);
  if (ms === null) throw new Error(`Invalid date: ${iso}`);
  return new Date(ms + days * DAY_MS).toISOString().slice(0, 10);
}

/** Number of calendar days in the range, inclusive. */
export function daysInRange(from: string, to: string): number | null {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return a === null || b === null || b < a ? null : Math.round((b - a) / DAY_MS) + 1;
}

/**
 * Concrete dates for a preset, counted back from `anchor` (the last day, usually the reference "today" the caller passes in).
 * "period" uses the supplied period; without one it falls back to 30 days.
 */
export function resolvePreset(preset: Exclude<DatePreset, "custom">, anchor: string, period?: DatePeriod): { from: string; to: string } {
  if (preset === "period") return period ? { from: period.from, to: period.to } : resolvePreset("30d", anchor);
  return { from: addDays(anchor, -(PRESET_DAYS[preset] - 1)), to: anchor };
}

export function makeRange(preset: Exclude<DatePreset, "custom">, anchor: string, period?: DatePeriod): DateRangeValue {
  const resolved = resolvePreset(preset === "period" && !period ? "30d" : preset, anchor, period);
  return { preset: preset === "period" && !period ? "30d" : preset, ...resolved };
}

/** Message for an invalid custom range, or null when it is fine. */
export function validateRange(from: string, to: string, bounds?: { min?: string; max?: string }): string | null {
  if (!from || !to) return "Choose both dates.";
  if (parseIsoDate(from) === null || parseIsoDate(to) === null) return "Use real dates.";
  if (from > to) return "The start date must be on or before the end date.";
  if (bounds?.min && from < bounds.min) return `Dates start on ${formatDate(bounds.min)}.`;
  if (bounds?.max && to > bounds.max) return `Dates end on ${formatDate(bounds.max)}.`;
  return null;
}

export function formatRange(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${sameYear ? formatShortDate(from) : formatDate(from)} – ${formatDate(to)}`;
}

/* ------------------------------------------------------------------ */

type DateRangeProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  /** Last day for the "Last n days" presets, as `YYYY-MM-DD`. Pass a stable reference (e.g. the demo clock), never compute it during render. */
  anchorDate: string;
  /** Enables the "This period" preset (e.g. the current billing month or audit window). */
  period?: DatePeriod;
  presets?: Exclude<DatePreset, "custom">[];
  /** Earliest and latest selectable day for the custom range. */
  min?: string;
  max?: string;
  label?: string;
  align?: "start" | "end";
  className?: string;
};

/** Date range picker: presets plus a custom range from two native date inputs. Controlled. */
export function DateRange({ value, onChange, anchorDate, period, presets, min, max, label = "Date range", align = "start", className }: DateRangeProps) {
  const available = (presets ?? ["7d", "30d", "90d", "period"]).filter((preset) => preset !== "period" || period);
  const periodLabel = period?.label ?? PRESET_LABEL.period;
  const nameOf = (preset: DatePreset) => (preset === "period" ? periodLabel : PRESET_LABEL[preset]);
  const days = daysInRange(value.from, value.to);

  return (
    <Popover
      label={label}
      align={align}
      width={300}
      trigger={
        <button
          type="button"
          aria-label={`${label}: ${nameOf(value.preset)}, ${formatRange(value.from, value.to)}`}
          className={cn(
            "inline-flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-[13px] text-fg transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 aria-expanded:bg-surface-2 pointer-coarse:h-11",
            className,
          )}
        >
          <Icon name="calendar" size={16} className="shrink-0 text-fg-muted" />
          <span className="truncate font-medium">{nameOf(value.preset)}</span>{" "}
          <span className="tnum hidden truncate text-fg-muted sm:inline">{formatRange(value.from, value.to)}</span>
          <Icon name="chevron-down" size={14} className="shrink-0 text-fg-muted" />
        </button>
      }
    >
      {({ close }) => (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-0.5" aria-label="Preset ranges">
            {available.map((preset) => {
              const active = value.preset === preset;
              const resolved = resolvePreset(preset, anchorDate, period);
              return (
                <li key={preset}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      onChange({ preset, ...resolved });
                      close();
                    }}
                    className={cn(
                      "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-control px-2.5 text-left text-[13px] hover:bg-surface-2 pointer-coarse:min-h-11",
                      active ? "bg-accent-soft font-medium text-accent-text" : "text-fg",
                    )}
                  >
                    <span className="flex-1">{nameOf(preset)}</span>
                    <span className="tnum text-xs text-fg-muted">{formatRange(resolved.from, resolved.to)}</span>
                    {active ? <Icon name="check" size={14} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line pt-3">
            <CustomRange
              initial={value}
              min={min}
              max={max}
              active={value.preset === "custom"}
              onApply={(from, to) => {
                onChange({ preset: "custom", from, to });
                close();
              }}
            />
          </div>
          {days !== null ? <p className="tnum text-xs text-fg-muted">{days} {days === 1 ? "day" : "days"} selected</p> : null}
        </div>
      )}
    </Popover>
  );
}

function CustomRange({ initial, min, max, active, onApply }: { initial: DateRangeValue; min?: string; max?: string; active: boolean; onApply: (from: string, to: string) => void }) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [touched, setTouched] = useState(false);
  const error = validateRange(from, to, { min, max });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn("mb-2 text-xs font-semibold", active ? "text-accent-text" : "text-fg-muted")}>Custom range</legend>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From" error={touched ? (error ?? undefined) : undefined}>
          {({ id, describedBy, invalid }) => <Input id={id} type="date" value={from} min={min} max={max} aria-describedby={describedBy} invalid={invalid} onChange={(event) => setFrom(event.target.value)} />}
        </Field>
        <Field label="To">
          {({ id }) => <Input id={id} type="date" value={to} min={min} max={max} aria-invalid={touched && error ? true : undefined} onChange={(event) => setTo(event.target.value)} />}
        </Field>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-end"
        onClick={() => {
          setTouched(true);
          if (!validateRange(from, to, { min, max })) onApply(from, to);
        }}
      >
        Apply
      </Button>
    </fieldset>
  );
}
