import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Mono } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
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

export default async function ComparisonLayout({ children, params }: LayoutProps<"/stores/[storeId]/comparisons/[comparisonId]">) {
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
        meta={
          <>
            <Status kind="comparison" value={record.status} />
            <Status kind="comparability" value={record.comparability} />
          </>
        }
        actions={
          <>
            {record.reportId ? <ButtonLink href={`/stores/${storeId}/reports/${record.reportId}`} icon="reports">Report</ButtonLink> : null}
            <ButtonLink href={`${base}/export`} variant="primary" icon="download">Export</ButtonLink>
          </>
        }
        tabs={
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Source label="Baseline" reference={baseline.reference} kind={kindLabel(baseline.kind)} />
              <Source label="Current" reference={current.reference} kind={kindLabel(current.kind)} />
              <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                Methodology <span className="tnum text-[13px] text-fg">v{record.methodologyVersion}</span>
              </span>
              <Tooltip content="Results are immutable. Recalculating creates a new revision and keeps this one.">
                <span tabIndex={0} className="inline-flex">
                  <Badge tone="neutral" icon="lock">Immutable</Badge>
                </span>
              </Tooltip>
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
                { href: `${base}/export`, label: "Report & export" },
              ]}
            />
          </>
        }
      />
      {children}
    </>
  );
}
