import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Mono } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { parseWindow } from "@/features/comparison/sides";
import { formatDate } from "@/lib/format";
import { comparisonStaticParams, getComparisonDetail, TYPE_LABEL } from "@/services/comparison";

export async function generateStaticParams() {
  return comparisonStaticParams();
}

function Source({ label, reference, kind }: { label: string; reference: string; kind: string }) {
  const isWindow = Boolean(parseWindow(reference));
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="text-xs text-fg-subtle">{label}</span>
      {isWindow ? <span className="tnum text-[13px] text-fg">{reference}</span> : <Mono>{reference}</Mono>}
      <Badge tone="neutral">{kind}</Badge>
    </span>
  );
}

async function ComparisonLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  const { storeId, comparisonId } = await params;
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) notFound();
  const { record, baseline, current, result } = detail;
  const base = `/stores/${storeId}/comparisons/${comparisonId}`;
  const kindLabel = (k: string) => (k === "audit" ? "Audit" : k === "monitoring" ? "Monitoring" : "Mixed");

  return (
    <>
      <PageHeader
        title={record.title}
        subtitle={`${TYPE_LABEL[record.type]} · created ${formatDate(record.createdAt)} by ${record.createdBy}`}
        breadcrumb={[{ label: "Comparisons", href: `/stores/${storeId}/comparisons` }, { label: record.id }]}
        meta={<Status kind="comparability" value={record.comparability} />}
        actions={record.reportId ? <ButtonLink href={`/stores/${storeId}/reports/${record.reportId}`} variant="primary" icon="reports">Report</ButtonLink> : undefined}
        tabs={
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Source label="Baseline" reference={baseline.reference} kind={kindLabel(baseline.kind)} />
              <Source label="Current" reference={current.reference} kind={kindLabel(current.kind)} />
            </div>
            <LinkTabs
              label="Comparison sections"
              items={[
                { href: base, label: "Overview", exact: true },
                { href: `${base}/prompts`, label: "Prompts", count: result.matchedPairs },
                { href: `${base}/platforms`, label: "Platforms" },
                { href: `${base}/competitors`, label: "Competitors" },
                { href: `${base}/citations`, label: "Citations" },
                { href: `${base}/sentiment`, label: "Sentiment" },
                { href: `${base}/fixes`, label: "Fixes timeline" },
                { href: `${base}/quality`, label: "Data quality" },
                { href: `${base}/export`, label: "Export" },
              ]}
            />
          </>
        }
      />
      {children}
    </>
  );
}

export default function ComparisonLayout(props: LayoutProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonLayoutContent {...props} />
    </Suspense>
  );
}
