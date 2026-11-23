import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatPoints, formatPercent, ratePercent } from "@/lib/format";
import type { Tone } from "@/lib/status";

import { Badge, toneClass, toneIconClass } from "./badge";
import { Icon, type IconName } from "./icon";
import { Tooltip } from "./tooltip";

/**
 * content: bare surface, you place CardHeader / CardBody inside (default, unchanged).
 * metric | chart | action | alert: self-padded variants (ChartCard is the ready-made chart card).
 */
export type CardVariant = "content" | "metric" | "chart" | "action" | "alert";

type CardProps = {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article" | "aside";
  variant?: CardVariant;
  /** Tone for the `alert` variant. */
  tone?: Tone;
};

const cardVariant: Record<CardVariant, string> = {
  content: "",
  metric: "p-card",
  chart: "flex flex-col gap-4 p-card",
  action: "p-card transition-[border-color,box-shadow,transform] duration-[var(--dur-fast)] hover:border-line-strong hover:shadow-pop",
  alert: "p-card",
};

export function Card({ className, children, as: Tag = "div", variant = "content", tone = "warning" }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-card border shadow-card",
        variant === "alert" ? toneClass[tone] : "border-line bg-surface",
        cardVariant[variant],
        className,
      )}
    >
      {children}
    </Tag>
  );
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
    <div className={cn("flex items-start justify-between gap-3 px-card pb-0 pt-card max-sm:flex-wrap", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Heading className="truncate text-card-title font-semibold text-fg">{title}</Heading>
          {info ? (
            <Tooltip content={info}>
              <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label={info}>
                <Icon name="info" size={14} />
              </span>
            </Tooltip>
          ) : null}
        </div>
        {subtitle ? <p className="mt-0.5 text-helper text-fg-subtle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2 max-sm:min-w-0 max-sm:max-w-full max-sm:shrink max-sm:flex-wrap">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-card", className)}>{children}</div>;
}

/** Page section with a heading row. */
export function Section({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section font-semibold text-fg">{title}</h2>
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
          <dt className="text-helper text-fg-subtle">{item.label}</dt>
          <dd className="mt-0.5 break-words text-body text-fg [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const calloutIcon: Record<Tone, IconName> = {
  neutral: "info",
  accent: "info",
  info: "info",
  success: "check-circle",
  warning: "alert-triangle",
  danger: "alert-circle",
};

export function Callout({ tone = "info", title, children, actions, className }: { tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-control border px-3.5 py-3 text-body-sm", toneClass[tone], className)}
    >
      <Icon name={calloutIcon[tone]} size={16} className={cn("mt-0.5 shrink-0", toneIconClass[tone])} />
      <div className="min-w-0 flex-1 text-fg">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5 text-fg-muted")}>{children}</div> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export type MetricDelta = {
  /** Percentage-point change (rates): rendered as "+12.5 pp". */
  points?: number | null;
  /** Count change: rendered as "+8". */
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
        {delta.versus ? <span className="text-helper text-fg-subtle">{delta.versus}</span> : null}
      </span>
    );
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1 text-label font-medium text-fg-muted">
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
        <span className="tnum text-metric font-semibold text-fg">{display}</span>
        {sampleStatus !== "ok" ? (
          <Badge tone="warning" icon="alert-triangle" title="Small sample: treat as directional">
            {sampleStatus === "directional" ? "Directional" : "Insufficient"}
          </Badge>
        ) : null}
      </div>
      <div className="tnum text-helper text-fg-subtle">
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
  return <div className="bg-surface p-card">{children}</div>;
}

/** Chart card: title row, chart body, optional one-line footnote (sample size, run dates). */
export function ChartCard({
  title,
  subtitle,
  info,
  actions,
  footnote,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  info?: string;
  actions?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card variant="chart" as="section" className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-card-title font-semibold text-fg">{title}</h2>
            {info ? (
              <Tooltip content={info}>
                <span className="flex cursor-help text-fg-subtle" tabIndex={0} aria-label={info}>
                  <Icon name="info" size={14} />
                </span>
              </Tooltip>
            ) : null}
          </div>
          {subtitle ? <p className="mt-0.5 text-helper text-fg-subtle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
      {footnote ? <p className="tnum text-helper text-fg-subtle">{footnote}</p> : null}
    </Card>
  );
}

