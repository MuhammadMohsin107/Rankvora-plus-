import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { STATUS, type StatusKind, type StatusValue, type Tone } from "@/lib/status";

import { Icon, type IconName } from "./icon";

export const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-line",
  accent: "bg-accent-soft text-accent-text border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

type BadgeProps = {
  tone?: Tone;
  icon?: IconName;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Badge({ tone = "neutral", icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium leading-none",
        toneClass[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} className={icon === "loader" ? "animate-spin" : undefined} /> : null}
      {children}
    </span>
  );
}

type StatusProps<K extends StatusKind> = {
  kind: K;
  value: StatusValue<K>;
  /** Override the vocabulary label (keep it short). */
  label?: string;
  className?: string;
  /** Hide the icon in very dense cells. */
  compact?: boolean;
};

/** Icon + text + tone from the shared status vocabulary. */
export function Status<K extends StatusKind>({ kind, value, label, className, compact }: StatusProps<K>) {
  const meta = (STATUS[kind] as Record<string, { label: string; tone: Tone; icon: IconName }>)[value];
  return (
    <Badge tone={meta.tone} icon={compact ? undefined : meta.icon} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}

/** Small dot + text, for dense lists where a pill is too heavy. */
export function StatusDot({ tone, children }: { tone: Tone; children: ReactNode }) {
  const dot: Record<Tone, string> = {
    neutral: "bg-fg-subtle",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-fg">
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot[tone])} />
      {children}
    </span>
  );
}

/** Filter chip / removable value. */
export function Chip({ children, onRemove, removeLabel = "Remove", className }: { children: ReactNode; onRemove?: () => void; removeLabel?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border border-line-strong bg-surface px-2 text-xs text-fg", className)}>
      {children}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="-mr-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-fg">
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
}
