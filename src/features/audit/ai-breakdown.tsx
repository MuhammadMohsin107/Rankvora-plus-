"use client";

import { useState } from "react";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/form";
import type { BreakdownRow, MetricKey } from "@/types/audit";

import { RateCell } from "./rate-cell";

const METRIC_LABEL: Record<MetricKey, string> = { mention: "Mention", recommendation: "Recommendation", citation: "Owned citation" };

function toBarRows(rows: BreakdownRow[], key: MetricKey): BarCompareRow[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    sub: r.failed > 0 ? `${r.sub} · ${r.failed} failed, excluded` : r.sub,
    baseline: r.baseline[key],
    current: r.current[key],
    naReason: r.current[key] && r.current[key]!.d === 0 ? "No eligible responses" : undefined,
  }));
}

function SingleRates({ rows, metric }: { rows: BreakdownRow[]; metric: MetricKey }) {
  return (
    <ul className="flex flex-col divide-y divide-line">
      {rows.map((r) => {
        const rate = r.current[metric];
        return (
          <li key={r.id} className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center md:gap-4">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg" title={r.label}>{r.label}</p>
              <p className="truncate text-xs text-fg-subtle" title={r.sub}>{r.failed > 0 ? `${r.sub} · ${r.failed} failed, excluded` : r.sub}</p>
            </div>
            {rate && rate.d > 0 ? <RateCell n={rate.n} d={rate.d} unit="responses" /> : <p className="text-xs text-fg-muted">N/A · no eligible responses</p>}
          </li>
        );
      })}
    </ul>
  );
}

type Props = {
  providers: BreakdownRow[];
  groups: BreakdownRow[];
  /** Title of the previous comparable audit, or null when there is none. */
  compareTitle: string | null;
};

/** Rates by provider and by prompt group with a shared metric switch. Failures are excluded from every denominator. */
export function BreakdownCards({ providers, groups, compareTitle }: Props) {
  const [metric, setMetric] = useState<MetricKey>("mention");
  const info = compareTitle
    ? `Before = ${compareTitle}. Prompt versions may differ between audits; use Comparison for a matched analysis.`
    : "No comparable earlier audit, so each bar shows this audit only.";
  const denominator = metric === "citation" ? "Citation-capable successful responses" : "Successful responses";
  return (
    <section aria-label="Rates breakdown" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-fg">Breakdown</h2>
        <Segmented
          label="Metric"
          value={metric}
          onChange={setMetric}
          options={(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        {([
          { id: "provider", title: "By provider", rows: providers },
          { id: "group", title: "By prompt group", rows: groups },
        ] as const).map((section) => (
          <Card as="section" key={section.id}>
            <CardHeader title={section.title} subtitle={`${METRIC_LABEL[metric]} rate · ${denominator.toLowerCase()}`} info={info} />
            <CardBody>
              {section.rows.length === 0 ? (
                <p className="text-[13px] text-fg-muted">No responses yet.</p>
              ) : compareTitle ? (
                <BarCompare rows={toBarRows(section.rows, metric)} baselineLabel="Before" currentLabel="Now" />
              ) : (
                <SingleRates rows={section.rows} metric={metric} />
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}
