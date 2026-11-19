import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Callout, Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { CheckList } from "@/features/comparison/compatibility";
import { REASON_LABEL } from "@/features/comparison/engine";
import { MIN_MATCHED_PAIRS } from "@/lib/stats";
import { humanize } from "@/lib/status";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";
import type { SideQuality } from "@/types/comparison";

export const metadata: Metadata = { title: "Comparison data quality" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

function Failures({ quality }: { quality: SideQuality }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        <span className="min-w-0 truncate">{quality.label}</span>
        <span className="tnum shrink-0 font-normal normal-case tracking-normal">{quality.attempted.d} requests</span>
      </h3>
      {quality.failedByClass.length === 0 ? (
        <p className="text-[13px] text-fg-muted">No failed requests.</p>
      ) : (
        <ul className="divide-y divide-line rounded-control border border-line">
          {quality.failedByClass.map((f) => (
            <li key={f.cls} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="text-fg">{humanize(f.cls)}</span>
              <span className="tnum text-fg-muted">{f.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function ComparisonQualityPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/quality">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { result } = detail;
  const base = `/stores/${storeId}/comparisons/${comparisonId}/prompts`;

  const reasons = new Map<string, { count: number; anchor: string }>();
  for (const u of result.unmatched) reasons.set(u.reason, { count: (reasons.get(u.reason)?.count ?? 0) + 1, anchor: "unmatched" });
  for (const e of result.excluded) reasons.set(e.reason, { count: (reasons.get(e.reason)?.count ?? 0) + 1, anchor: "excluded" });

  const warnings: string[] = [];
  const small = result.headline.filter((m) => !m.na && m.sample !== "ok");
  if (small.length) warnings.push(`Metrics: ${small.map((m) => m.label).join(", ")}`);
  const smallChannels = result.channels.filter((c) => c.matchedPairs < MIN_MATCHED_PAIRS);
  if (smallChannels.length) warnings.push(`${smallChannels.length} of ${result.channels.length} platform segments`);
  const smallPrompts = result.prompts.filter((p) => p.matchedPairs < MIN_MATCHED_PAIRS);
  if (smallPrompts.length) warnings.push(`${smallPrompts.length} of ${result.prompts.length} prompt segments`);

  return (
    <div className="flex flex-col gap-5">
      <MetricGrid>
        <MetricCell>
          <Metric label="Success rate · baseline" numerator={result.successRate.baseline?.n} denominator={result.successRate.baseline?.d} unit="requests" basis="operational" info={result.successRate.info} />
        </MetricCell>
        <MetricCell>
          <Metric label="Success rate · current" numerator={result.successRate.current?.n} denominator={result.successRate.current?.d} unit="requests" basis="operational" info={result.successRate.info} />
        </MetricCell>
        <MetricCell>
          <Metric label="Matched coverage" numerator={result.coverage.n} denominator={result.coverage.d} unit="slots" info="Matched slots ÷ the larger side's slots. Only matched slots feed the metrics." />
        </MetricCell>
        <MetricCell>
          <Metric label="Prompt coverage" numerator={result.promptCoverage.n} denominator={result.promptCoverage.d} unit="prompts" info="Prompts with at least one matched slot ÷ prompts seen on either side." />
        </MetricCell>
      </MetricGrid>

      <Card>
        <CardHeader title="Failed requests" info="Excluded from rates and never counted as brand absent." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2">
          <Failures quality={result.quality.baseline} />
          <Failures quality={result.quality.current} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exclusions by reason" info="Slots outside the matched cohort." />
        <CardBody className="pt-2">
          {reasons.size === 0 ? (
            <p className="text-[13px] text-fg-muted">Every slot is in the matched cohort.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...reasons.entries()].map(([reason, info]) => (
                <li key={reason} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[13px] text-fg">{REASON_LABEL[reason]}</span>
                  <span className="flex items-center gap-4">
                    <span className="tnum text-[13px] text-fg-muted">{info.count} slots</span>
                    <Link href={`${base}#${info.anchor}`} className="text-[13px] font-medium text-accent-text hover:underline">View slots</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {warnings.length > 0 ? (
        <Callout tone="warning" title={`Directional only: fewer than ${MIN_MATCHED_PAIRS} matched slots`}>
          <ul className="list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Callout>
      ) : null}

      <Card>
        <CardHeader title="Compatibility checks" info="Hard checks block a comparison. Soft warnings explain the verdict." />
        <CardBody>
          <CheckList checks={[...result.checks.filter((c) => c.kind === "hard"), ...result.checks.filter((c) => c.kind === "soft")]} />
        </CardBody>
      </Card>
    </div>
  );
}

export default function ComparisonQualityPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/quality">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonQualityPageContent {...props} />
    </Suspense>
  );
}
