import Link from "next/link";

import { Callout, Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { CheckSummary } from "@/features/comparison/compatibility";
import { ComparisonHistory } from "@/features/comparison/comparison-history";
import { REASON_LABEL } from "@/features/comparison/engine";
import { COMPARISON_LIMITATIONS, METHODOLOGY } from "@/demo/comparison";
import { MIN_MATCHED_PAIRS } from "@/lib/stats";
import { humanize } from "@/lib/status";
import type { ComparisonDetail, SideQuality } from "@/types/comparison";

function Failures({ quality }: { quality: SideQuality }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-baseline justify-between gap-2 text-label font-medium text-fg-muted">
        <span className="min-w-0 truncate">{quality.label}</span>
        <span className="tnum shrink-0 font-normal text-fg-subtle">{quality.attempted.d} requests</span>
      </h3>
      {quality.failedByClass.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No failed requests.</p>
      ) : (
        <ul className="divide-y divide-line rounded-control border border-line">
          {quality.failedByClass.map((f) => (
            <li key={f.cls} className="flex items-center justify-between gap-3 px-3 py-2 text-body-sm">
              <span className="text-fg">{humanize(f.cls)}</span>
              <span className="tnum text-fg-muted">{f.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Data quality, coverage, checks and the one place for method and limits. */
export function QualityView({ detail, base }: { detail: ComparisonDetail; base: string }) {
  const { result } = detail;
  const reasons = new Map<string, number>();
  for (const u of result.unmatched) reasons.set(u.reason, (reasons.get(u.reason) ?? 0) + 1);
  for (const e of result.excluded) reasons.set(e.reason, (reasons.get(e.reason) ?? 0) + 1);

  const small = result.headline.filter((m) => !m.na && m.sample !== "ok");
  const warnings: string[] = [];
  if (small.length) warnings.push(`${small.length} of ${result.headline.length} headline metrics`);
  const smallChannels = result.channels.filter((c) => c.matchedPairs < MIN_MATCHED_PAIRS);
  if (smallChannels.length) warnings.push(`${smallChannels.length} of ${result.channels.length} platform segments`);

  return (
    <div className="flex flex-col gap-4">
      <MetricGrid>
        <MetricCell>
          <Metric label="Success · baseline" numerator={result.successRate.baseline?.n} denominator={result.successRate.baseline?.d} unit="requests" info={result.successRate.info} />
        </MetricCell>
        <MetricCell>
          <Metric label="Success · current" numerator={result.successRate.current?.n} denominator={result.successRate.current?.d} unit="requests" info={result.successRate.info} />
        </MetricCell>
        <MetricCell>
          <Metric label="Matched coverage" numerator={result.coverage.n} denominator={result.coverage.d} unit="slots" info="Matched slots out of the larger side. Only matched slots feed the metrics." />
        </MetricCell>
        <MetricCell>
          <Metric label="Prompt coverage" numerator={result.promptCoverage.n} denominator={result.promptCoverage.d} unit="prompts" info="Prompts with at least one matched slot out of prompts seen on either side." />
        </MetricCell>
      </MetricGrid>

      {warnings.length > 0 ? <Callout tone="warning" title={`Directional: fewer than ${MIN_MATCHED_PAIRS} matched pairs`}>{warnings.join(" · ")}</Callout> : null}

      <Card>
        <CardHeader title="Checks" />
        <CardBody><CheckSummary checks={[...result.checks.filter((c) => c.kind === "hard"), ...result.checks.filter((c) => c.kind === "soft")]} /></CardBody>
      </Card>

      <Card>
        <CardHeader title="Failed requests" info="Excluded from rates. Never counted as the brand being absent." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Failures quality={result.quality.baseline} />
          <Failures quality={result.quality.current} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Left out" info="Slots outside the matched cohort." />
        <CardBody className="pt-2">
          {reasons.size === 0 ? (
            <p className="text-body-sm text-fg-muted">Every slot is in the matched cohort.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...reasons.entries()].map(([reason, count]) => (
                <li key={reason} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-body-sm text-fg">{REASON_LABEL[reason] ?? reason}</span>
                  <span className="flex items-center gap-4">
                    <span className="tnum text-body-sm text-fg-muted">{count} slots</span>
                    <Link href={`${base}/prompts?left=1`} className="text-body-sm font-medium text-accent-text hover:underline">View</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Whole source" info="All successful responses of each source, including slots outside the matched cohort. Reconciles with the source's own headline." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Metric label="Mention rate · baseline" numerator={result.wholeSource.baseline.n} denominator={result.wholeSource.baseline.d} />
          <Metric label="Mention rate · current" numerator={result.wholeSource.current.n} denominator={result.wholeSource.current.d} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Method and limits" subtitle={`Methodology ${METHODOLOGY.version} · analysis ${METHODOLOGY.analysisVersion}`} />
        <CardBody className="flex flex-col gap-3">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-body-sm text-fg-muted">
            {METHODOLOGY.rules.map((rule) => <li key={rule}>{rule}</li>)}
            {COMPARISON_LIMITATIONS.slice(0, 1).map((rule) => <li key={rule}>{rule}</li>)}
          </ul>
          <details className="text-helper text-fg-muted">
            <summary className="inline-flex min-h-6 cursor-pointer items-center rounded px-1 hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">Method details</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
              <li>{METHODOLOGY.matching}</li>
              {METHODOLOGY.details.map((rule) => <li key={rule}>{rule}</li>)}
              {COMPARISON_LIMITATIONS.slice(1).map((rule) => <li key={rule}>{rule}</li>)}
            </ul>
          </details>
        </CardBody>
      </Card>

      <ComparisonHistory comparisonId={detail.record.id} />
    </div>
  );
}
