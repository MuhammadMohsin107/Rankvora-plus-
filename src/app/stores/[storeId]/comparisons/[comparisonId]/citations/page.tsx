import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { HeadlineCard } from "@/features/comparison/headline";
import { CITATION_SOURCE_LABEL } from "@/lib/labels";
import { NotComputed } from "@/features/comparison/compatibility";
import { comparisonStaticParams, getComparisonDetail } from "@/services/comparison";

export const metadata: Metadata = { title: "Comparison citations" };

export async function generateStaticParams() {
  return comparisonStaticParams();
}

const sourceTone = { owned: "success", competitor: "warning", third_party: "neutral" } as const;

async function ComparisonCitationsPageContent(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/citations">) {
  const { storeId, comparisonId } = await props.params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  if (detail.result.verdict === "not_comparable") return <NotComputed checks={detail.result.checks} what="Citations" />;
  const { result } = detail;
  const citation = result.headline.find((m) => m.id === "citation")!;
  const sourceOf = (domain: string) => result.domains.find((d) => d.domain === domain)?.source ?? "third_party";

  const providerRows: BarCompareRow[] = result.channels.map((c) => ({
    id: c.channelId,
    label: c.label,
    baseline: c.citation.baseline,
    current: c.citation.current,
    baselineCi: c.citation.baselineCi,
    currentCi: c.citation.currentCi,
    naReason: c.citation.na,
  }));

  const domainRows: BarCompareRow[] = result.domains.slice(0, 8).map((d) => ({
    id: d.domain,
    label: d.domain,
    sub: CITATION_SOURCE_LABEL[d.source],
    baseline: d.baseline,
    current: d.current,
  }));

  return (
    <div className="flex flex-col gap-5">
      <HeadlineCard metric={citation} aggregation={result.aggregation} countsOnly={result.verdict === "insufficient_data"} />

      <Card>
        <CardHeader title="By provider" info="Owned citation rate on responses with citation data only. A provider without citation support is N/A, never 0%." />
        <CardBody>
          {providerRows.length > 0 ? <BarCompare rows={providerRows} baselineLabel="Base" currentLabel="Current" /> : <p className="text-[13px] text-fg-muted">No matched slots.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cited domains" subtitle="Responses citing each domain ÷ responses with citation data" />
        <CardBody>
          {domainRows.length > 0 ? <BarCompare rows={domainRows} baselineLabel="Base" currentLabel="Current" /> : <p className="text-[13px] text-fg-muted">No citations returned in the matched cohort.</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Cited URLs" subtitle="Responses citing each URL, baseline → current" />
        <CardBody className="pt-2">
          {result.urls.length === 0 ? (
            <p className="text-[13px] text-fg-muted">No URLs returned in the matched cohort.</p>
          ) : (
            <ul className="divide-y divide-line">
              {result.urls.slice(0, 10).map((u) => (
                <li key={u.url} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <a href={u.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                      <span className="truncate">{u.title}</span>
                      <Icon name="external" size={12} className="shrink-0" />
                    </a>
                    <p className="truncate text-xs text-fg-subtle">{u.url}</p>
                  </div>
                  <div className="tnum flex shrink-0 items-center gap-2 text-xs text-fg-muted">
                    <span>{u.baseline.n} / {u.baseline.d}</span>
                    <span aria-hidden="true">→</span>
                    <span className="sr-only">to</span>
                    <span>{u.current.n} / {u.current.d}</span>
                    <Badge tone={sourceTone[sourceOf(u.domain)]}>{CITATION_SOURCE_LABEL[sourceOf(u.domain)]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default function ComparisonCitationsPage(props: PageProps<"/stores/[storeId]/comparisons/[comparisonId]/citations">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonCitationsPageContent {...props} />
    </Suspense>
  );
}
