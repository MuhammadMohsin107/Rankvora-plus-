import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Metric } from "@/components/ui/card";
import { formatPercent, formatSignedInt } from "@/lib/format";
import type { AggregationPolicy, MetricResult } from "@/types/comparison";

/** "slots" when the primary figure is a slot average, otherwise the metric's own unit. */
export function metricUnit(metric: MetricResult): string {
  return metric.baseline && metric.pooledBaseline && metric.baseline.d !== metric.pooledBaseline.d ? "matched slots" : metric.unit;
}

export const ciText = (ci: [number, number] | null) => (ci ? `95% CI ${ci[0].toFixed(0)}–${ci[1].toFixed(0)}%` : undefined);

function relativeText(metric: MetricResult): string {
  if (metric.zeroBaseline) return "new from zero";
  if (metric.relativeChange === null) return "N/A";
  return `${metric.relativeChange > 0 ? "+" : metric.relativeChange < 0 ? "−" : ""}${formatPercent(Math.abs(metric.relativeChange))}`;
}

/**
 * One metric, baseline vs current, always with numerator and denominator.
 * `countsOnly` (insufficient data) hides the percentage-point change and shows counts instead of a conclusion.
 * `grouped` means a surrounding section already names the aggregation policy and the counts-only state,
 * so the card does not repeat them.
 */
export function HeadlineCard({ metric, countsOnly, aggregation, grouped }: { metric: MetricResult; countsOnly?: boolean; aggregation?: AggregationPolicy; grouped?: boolean }) {
  const unit = metricUnit(metric);
  const slotBased = unit === "matched slots";
  const na = metric.na;
  const sample = countsOnly && grouped ? "ok" : metric.sample;
  const info = [metric.info, !na && metric.cohort > 0 ? `${metric.cohort} matched slots in this cohort.` : null].filter(Boolean).join(" ");
  return (
    <Card as="article">
      <CardHeader
        title={metric.label}
        as="h3"
        info={info || undefined}
        actions={
          grouped ? undefined : slotBased ? (
            <Badge tone="neutral" title="Mean of per-slot rates across the runs in each window">
              Slot average
            </Badge>
          ) : aggregation === "pooled" && !metric.id.startsWith("share") ? (
            <Badge tone="neutral">Pooled</Badge>
          ) : undefined
        }
      />
      <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
        <Metric
          label="Baseline"
          numerator={metric.baseline?.n}
          denominator={metric.baseline?.d}
          unit={unit}
          naReason={na}
          sampleStatus={sample}
          basis={ciText(metric.baselineCi)}
        />
        <Metric
          label="Current"
          numerator={metric.current?.n}
          denominator={metric.current?.d}
          unit={unit}
          naReason={na}
          sampleStatus={sample}
          basis={ciText(metric.currentCi)}
          delta={!countsOnly && !na ? { points: metric.pointChange, goodWhen: metric.goodWhen } : undefined}
        />
        <dl className="tnum flex flex-col gap-1 text-xs">
          {countsOnly ? (
            grouped ? null : (
              <div className="flex justify-between gap-2">
                <dt className="text-fg-subtle">Change</dt>
                <dd className="text-fg-muted">Counts only</dd>
              </div>
            )
          ) : (
            <div className="flex justify-between gap-2">
              <dt className="text-fg-subtle">Relative</dt>
              <dd className="text-fg">{na ? "N/A" : relativeText(metric)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">{slotBased ? "Pooled count change" : "Count change"}</dt>
            <dd className="text-fg">{metric.countChange === null ? "N/A" : formatSignedInt(metric.countChange)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-fg-subtle">{slotBased ? "Pooled denominator change" : "Denominator change"}</dt>
            <dd className="text-fg">{metric.denominatorChange === null ? "N/A" : formatSignedInt(metric.denominatorChange)}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
