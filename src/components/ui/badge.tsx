import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { STATUS, type StatusKind, type StatusValue, type Tone } from "@/lib/status";

import { Icon, type IconName } from "./icon";

/**
 * Text uses the -text tones (>= 4.5:1 on the soft fill); fills and borders use the bright tones.
 * Exported because Callout and other primitives share the same tone recipe.
 */
export const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-muted border-line",
  accent: "bg-accent-soft text-accent-text border-transparent",
  success: "bg-success-soft text-success-text border-success/20",
  warning: "bg-warning-soft text-warning-text border-warning/30",
  danger: "bg-danger-soft text-danger-text border-danger/20",
  info: "bg-info-soft text-info-text border-info/20",
};

/** Bright tone for icons only (never for text). */
export const toneIconClass: Record<Tone, string> = {
  neutral: "text-fg-subtle",
  accent: "text-accent",
  success: "text-success-icon",
  warning: "text-warning-icon",
  danger: "text-danger-icon",
  info: "text-info-icon",
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
        "inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-helper font-medium leading-none",
        toneClass[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} className={cn(toneIconClass[tone], icon === "loader" && "animate-spin")} /> : null}
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

/** Marks content that comes from the built-in demonstration data set. */
export function DemoBadge({ className }: { className?: string }) {
  return <Status kind="demo" value="demo" className={className} />;
}

/** Marks an action whose result was produced locally, not by a real external operation. */
export function SimulatedBadge({ className }: { className?: string }) {
  return <Status kind="demo" value="simulated" className={className} />;
}

/** Filter chip / removable value. */
export function Chip({ children, onRemove, removeLabel = "Remove", className }: { children: ReactNode; onRemove?: () => void; removeLabel?: string; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full border border-line-strong bg-surface px-2 text-helper text-fg", className)}>
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-0.5 flex size-4 cursor-pointer items-center justify-center rounded-full text-fg-subtle transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-fg pointer-coarse:size-6"
        >
          <Icon name="x" size={12} />
        </button>
      ) : null}
    </span>
  );
}
