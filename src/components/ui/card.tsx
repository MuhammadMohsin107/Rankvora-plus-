import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatPoints, formatPercent, ratePercent } from "@/lib/format";
import type { Tone } from "@/lib/status";

import { Badge, toneClass } from "./badge";
import { Icon } from "./icon";
import { Tooltip } from "./tooltip";

export function Card({ className, children, as: Tag = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "aside" }) {
  return <Tag className={cn("rounded-card border border-line bg-surface shadow-card", className)}>{children}</Tag>;
}

type CardHeaderProps = {
  title: string;
  /** One short line. Prefer a tooltip (`info`) for anything longer. */
  subtitle?: string;
  info?: string;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
};

export function CardHeader({ title, subtitle, info, actions, className, as: Heading = "h2" }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pb-0 pt-3.5", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Heading className="truncate text-sm font-semibold text-fg">{title}</Heading>
          {info ? (
            <Tooltip content={info}>
              <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label={info}>
                <Icon name="info" size={14} />
              </span>
            </Tooltip>
          ) : null}
        </div>
        {subtitle ? <p className="mt-0.5 text-xs text-fg-subtle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

/** Page section with a heading row. */
export function Section({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function KeyValue({ items, columns = 2, className }: { items: { label: string; value: ReactNode }[]; columns?: 1 | 2 | 3 | 4; className?: string }) {
  const grid = { 1: "grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", grid, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-fg-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const calloutIcon: Record<Tone, Parameters<typeof Icon>[0]["name"]> = {
  neutral: "info",
  accent: "info",
  info: "info",
  success: "check-circle",
  warning: "alert-triangle",
  danger: "alert-circle",
};

export function Callout({ tone = "info", title, children, actions, className }: { tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-[13px]", toneClass[tone], tone === "neutral" ? "border-line" : "border-current/15", className)}>
      <Icon name={calloutIcon[tone]} size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 text-fg">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5 text-fg-muted")}>{children}</div> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export type MetricDelta = {
  /** Percentage-point change (rates) — rendered as "+12.5 pp". */
  points?: number | null;
  /** Count change — rendered as "+8". */
  count?: number;
  /** What it is compared against, e.g. "vs last audit". */
  versus?: string;
  /** Whether an increase is good. Default true. */
  goodWhen?: "up" | "down";
};

type MetricProps = {
  label: string;
  /** Rate inputs. The percentage is derived so the displayed numbers always agree. */
  numerator?: number;
  denominator?: number;
  /** Unit of the denominator, e.g. "responses". */
  unit?: string;
  /** For non-rate values (counts, durations). */
  value?: string;
  delta?: MetricDelta;
  /** Always show the basis: provider/model, sample, period. Short. */
  basis?: string;
  sampleStatus?: "ok" | "directional" | "insufficient";
  /** Render N/A instead of 0% and say why. */
  naReason?: string;
  info?: string;
  className?: string;
};

/**
 * A rate with its numerator and denominator always visible, never a bare %.
 * N/A (no denominator or unsupported) is shown as N/A, never as 0.
 */
export function Metric({ label, numerator, denominator, unit = "responses", value, delta, basis, sampleStatus = "ok", naReason, info, className }: MetricProps) {
  const isRate = numerator !== undefined && denominator !== undefined;
  const pct = isRate ? ratePercent(numerator, denominator) : null;
  const isNA = Boolean(naReason) || (isRate && pct === null);
  const display = value ?? (isNA ? "N/A" : formatPercent(pct));

  let deltaNode: ReactNode = null;
  if (delta) {
    const raw = delta.points ?? delta.count ?? null;
    const good = delta.goodWhen ?? "up";
    const tone: Tone = raw === null || raw === 0 ? "neutral" : (raw > 0) === (good === "up") ? "success" : "danger";
    const text = delta.points !== undefined ? formatPoints(delta.points) : delta.count !== undefined ? `${delta.count > 0 ? "+" : delta.count < 0 ? "−" : ""}${Math.abs(delta.count)}` : "N/A";
    deltaNode = (
      <span className="flex items-center gap-1.5">
        <Badge tone={tone} icon={raw === null || raw === 0 ? "minus" : raw > 0 ? "arrow-up" : "arrow-down"}>
          <span className="tnum">{text}</span>
        </Badge>
        {delta.versus ? <span className="text-xs text-fg-subtle">{delta.versus}</span> : null}
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1 text-xs font-medium text-fg-muted">
        <span className="truncate">{label}</span>
        {info ? (
          <Tooltip content={info}>
            <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label={info}>
              <Icon name="info" size={13} />
            </span>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tnum text-[26px] font-semibold leading-none tracking-tight text-fg">{display}</span>
        {sampleStatus !== "ok" ? (
          <Badge tone="warning" icon="alert-triangle" title="Small sample: treat as directional">
            {sampleStatus === "directional" ? "Directional" : "Insufficient"}
          </Badge>
        ) : null}
      </div>
      <div className="tnum text-xs text-fg-subtle">
        {isNA ? <span>{naReason ?? "No eligible responses"}</span> : isRate ? <span>{numerator} / {denominator} {unit}</span> : null}
        {basis ? <span>{isRate || isNA ? " · " : ""}{basis}</span> : null}
      </div>
      {deltaNode}
    </div>
  );
}

export function MetricGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

/** A cell for MetricGrid. */
export function MetricCell({ children }: { children: ReactNode }) {
  return <div className="bg-surface p-4">{children}</div>;
}
