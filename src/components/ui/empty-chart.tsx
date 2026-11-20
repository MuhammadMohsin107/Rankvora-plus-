import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

type EmptyChartProps = {
  /**
   * no-data: nothing recorded yet, one next action.
   * not-available: the metric cannot be computed here; says why and never shows 0.
   * insufficient: data exists but too few samples to draw a trend.
   */
  variant?: "no-data" | "not-available" | "insufficient";
  title?: string;
  /** Why it is empty or unavailable. One short sentence. */
  reason?: string;
  /** Exactly one next step, e.g. a Button or ButtonLink. */
  action?: ReactNode;
  icon?: IconName;
  /** Reserve the chart's height so the page does not jump when data arrives. Tailwind min-height class. */
  height?: string;
  className?: string;
};

const DEFAULTS: Record<NonNullable<EmptyChartProps["variant"]>, { title: string; icon: IconName }> = {
  "no-data": { title: "No data yet", icon: "trend-up" },
  "not-available": { title: "N/A", icon: "minus-circle" },
  insufficient: { title: "Not enough samples", icon: "database" },
};

/** Placeholder for a chart or table that has nothing truthful to draw. Missing data is never drawn as zero. */
export function EmptyChart({ variant = "no-data", title, reason, action, icon, height = "min-h-48", className }: EmptyChartProps) {
  const defaults = DEFAULTS[variant];
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong bg-surface-2 px-6 py-8 text-center", height, className)}>
      <Icon name={icon ?? defaults.icon} size={20} className="text-fg-muted" />
      <p className={cn("font-semibold text-fg", variant === "not-available" ? "tnum text-lg" : "text-sm")}>{title ?? defaults.title}</p>
      {reason ? <p className="max-w-xs text-[13px] text-fg-muted">{reason}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Inline "N/A" for a cell or stat with the reason available on hover and to screen readers. Never renders a zero. */
export function NotAvailable({ reason, className }: { reason?: string; className?: string }) {
  return (
    <span className={cn("tnum text-fg-muted", className)} title={reason}>
      N/A
      {reason ? <span className="sr-only">: {reason}</span> : null}
    </span>
  );
}
