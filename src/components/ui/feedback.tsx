import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("ui-skeleton h-4 w-full", className)} />;
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-card shadow-card", className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i === lines - 1 ? "w-2/3" : undefined} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-busy="true" aria-label="Loading table">
      <div className="flex gap-4 border-b border-line bg-surface-2 px-card py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-line-soft px-card py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** One clear next action. Never a blank screen. */
/** `headingAs="h1"` for a state that is the whole page (not found, error), so the page still has a heading. */
type StateHeading = "p" | "h1" | "h2";

export function EmptyState({
  icon = "search",
  title,
  description,
  action,
  className,
  headingAs: Title = "p",
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  headingAs?: StateHeading;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface px-6 py-8 text-center", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-fg-faint">
        <Icon name={icon} size={20} />
      </span>
      <Title className="text-card-title font-semibold text-fg">{title}</Title>
      {description ? <p className="max-w-sm text-body-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** What happened + what to do. */
export function ErrorState({
  title = "Something went wrong",
  detail,
  action,
  className,
  headingAs: Title = "p",
}: {
  title?: string;
  detail?: string;
  action?: ReactNode;
  className?: string;
  headingAs?: StateHeading;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 rounded-card border border-danger/30 bg-danger-soft px-6 py-6 text-center", className)}>
      <Icon name="alert-circle" size={22} className="text-danger-icon" />
      <Title className="text-card-title font-semibold text-fg">{title}</Title>
      {detail ? <p className="max-w-md text-body-sm text-fg-muted">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Icon name="loader" className={cn("animate-spin", className)} />;
}

type ProgressProps = {
  value: number;
  max?: number;
  label: string;
  tone?: "accent" | "success" | "warning" | "danger";
  /** Show "value / max" beside the bar. */
  showCount?: boolean;
  className?: string;
};

const barTone = { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" };

export function Progress({ value, max = 100, label, tone = "accent", showCount, className }: ProgressProps) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-[var(--dur)] motion-reduce:transition-none", barTone[tone])} style={{ width: `${pct}%` }} />
      </div>
      {showCount ? <span className="tnum shrink-0 text-helper text-fg-muted">{value} / {max}</span> : null}
    </div>
  );
}

type StepperProps = {
  steps: { id: string; label: string; description?: string }[];
  current: number;
  className?: string;
  /** Allows jumping back to completed steps. */
  onStepClick?: (index: number) => void;
};

/** Multi-step progress. Completed steps show a check; the current step is marked for assistive tech. */
export function Stepper({ steps, current, className, onStepClick }: StepperProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-x-1 gap-y-2", className)} aria-label="Progress">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const clickable = onStepClick && done;
        const inner = (
          <>
            <span
              className={cn(
                "tnum flex size-5 shrink-0 items-center justify-center rounded-full text-helper font-semibold",
                done ? "bg-accent text-accent-fg" : active ? "border-2 border-accent text-accent-text" : "border border-line-strong text-fg-subtle",
              )}
            >
              {done ? <Icon name="check" size={12} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className={cn("whitespace-nowrap text-label", active ? "font-semibold text-fg" : done ? "text-fg-muted" : "text-fg-subtle")}>{step.label}</span>
          </>
        );
        return (
          <li key={step.id} aria-current={active ? "step" : undefined} className="flex items-center gap-1">
            {clickable ? (
              <button type="button" onClick={() => onStepClick(index)} className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
                {inner}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1 py-0.5">{inner}</span>
            )}
            {index < steps.length - 1 ? <Icon name="chevron-right" size={14} className="text-line-strong" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
