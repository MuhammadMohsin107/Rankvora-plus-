import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SplitLayout } from "@/components/shell/page-header";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { InProgressOverview } from "@/features/audit/in-progress-overview";
import { LaneCards } from "@/features/audit/lane-cards";
import { formatCurrency, formatNumber } from "@/lib/format";
import { channelLabel } from "@/lib/labels";
import { auditParams, getAudit, getLaneSummary } from "@/services/audit";
import { listStoreChannels } from "@/services/core";

export const metadata: Metadata = { title: "Audit overview" };

export async function generateStaticParams() {
  return auditParams();
}

const limitationIcon = { warning: "alert-triangle", info: "info", neutral: "minus-circle" } as const;
const limitationColor = { warning: "text-warning", info: "text-info", neutral: "text-fg-subtle" } as const;

async function AuditOverviewPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]">) {
  const { storeId, auditId } = await props.params;
  const [audit, summary, channels] = await Promise.all([getAudit(storeId, auditId), getLaneSummary(storeId, auditId), listStoreChannels(storeId)]);
  if (!audit || !summary) notFound();

  const base = `/stores/${storeId}/audits/${auditId}`;

  if (audit.provisional) {
    const current = audit.progress ? channels.find((c) => audit.progress?.current.provider.startsWith(c.providerLabel)) : undefined;
    return <InProgressOverview audit={audit} channelLabelText={current ? channelLabel(current) : ""} />;
  }

  const { config, coverage, usage } = audit;
  const hasWebsite = audit.lanes.includes("website_readiness");
  // The request total (prompts × channels × samples) is the Responses coverage denominator below.
  const scope = `${config.promptIds.length} prompts × ${config.channelIds.length} channels × ${config.samples} ${config.samples === 1 ? "sample" : "samples"}`;

  return (
    <div className="flex flex-col gap-5">
      {audit.status === "partially_completed" ? (
        <Callout tone="warning" title="Partially completed">
          {coverage.responses.n} of {coverage.responses.d} planned requests returned a usable answer; {audit.failedJobs} failed after retries. Rates below cover the successful responses only, and failed requests are not read as the brand being absent.
        </Callout>
      ) : null}

      <LaneCards summary={summary} base={base} variant="headline" showLinks={false} basis={audit.type === "verification" ? "Verification scope" : undefined} />

      <SplitLayout
        main={
          <>
            <div className={hasWebsite ? "grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid grid-cols-[minmax(0,1fr)] gap-4"}>
              <Card as="section">
                <CardHeader title="AI visibility coverage" info="What was planned versus what returned a usable answer." />
                <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-3">
                  <Metric label="Prompts" numerator={coverage.prompts.n} denominator={coverage.prompts.d} unit="prompts answered" info="Prompts with at least one successful response ÷ prompts planned." />
                  <Metric label="Providers" numerator={coverage.providers.n} denominator={coverage.providers.d} unit="channels" info="Channels with at least one successful response ÷ channels planned." />
                  <Metric label="Responses" numerator={coverage.responses.n} denominator={coverage.responses.d} unit="requests" basis={audit.failedJobs ? `${audit.failedJobs} failed` : undefined} />
                </CardBody>
              </Card>
              {hasWebsite ? (
                <Card as="section">
                  <CardHeader title="Website coverage" info="Pages assessed ÷ discovered in-scope pages. Checks determinate ÷ applicable." />
                  <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-2">
                    <Metric
                      label="Pages"
                      numerator={coverage.pages.n}
                      denominator={coverage.pages.d}
                      unit="in-scope"
                      basis={`${coverage.pagesDetail.excluded} excluded · ${coverage.pagesDetail.blocked} blocked · ${coverage.pagesDetail.unvisited} unvisited`}
                    />
                    <Metric label="Checks" numerator={coverage.checks.n} denominator={coverage.checks.d} unit="applicable" />
                  </CardBody>
                </Card>
              ) : null}
            </div>

            <Card as="section">
              <CardHeader title="Limitations" info="Read the numbers with these in mind." />
              <CardBody className="pt-2">
                <ul className="divide-y divide-line">
                  {audit.limitations.map((item) => (
                    <li key={item.id} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0">
                      <Icon name={limitationIcon[item.tone]} size={15} className={`mt-0.5 shrink-0 ${limitationColor[item.tone]}`} />
                      <p className="text-[13px] text-fg">{item.text}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </>
        }
        aside={
          <>
          <Card as="section">
            <CardHeader title="Run summary" />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: "AI scope", value: <span className="tnum">{scope}</span> },
                  { label: "Website scope", value: hasWebsite ? `${config.startPoints.join(", ")} · up to ${config.maxUrls} URLs` : <span className="text-fg-muted">Not part of this audit</span> },
                  {
                    label: "Compared with",
                    value: audit.baseline ? (
                      <Link href={`/stores/${storeId}/audits/${audit.baseline.id}`} className="text-accent-text hover:underline">{audit.baseline.title}</Link>
                    ) : (
                      <span className="text-fg-muted">No comparable earlier audit</span>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
          <Card as="section">
            <CardHeader title="Usage" info="Counted from the stored responses. Cost is an estimate from typical per-request pricing, not an invoice." />
            <CardBody>
              <KeyValue
                columns={1}
                items={[
                  { label: "Requests", value: <span className="tnum">{usage.requests.attempted} sent · {usage.requests.succeeded} succeeded · {usage.requests.failed} failed</span> },
                  { label: "Search calls", value: <span className="tnum">{formatNumber(usage.searchCalls)}</span> },
                  { label: "Tokens", value: <span className="tnum">{formatNumber(usage.inputTokens)} in · {formatNumber(usage.outputTokens)} out</span> },
                  ...(hasWebsite ? [{ label: "Pages crawled", value: <span className="tnum">{usage.pagesCrawled}</span> }] : []),
                  { label: "Estimated cost", value: <span className="tnum">≈ {formatCurrency(usage.estimatedCostUsd)} of {formatCurrency(usage.budgetUsd)} cap</span> },
                ]}
              />
            </CardBody>
          </Card>
          </>
        }
      />
    </div>
  );
}

export default function AuditOverviewPage(props: PageProps<"/stores/[storeId]/audits/[auditId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AuditOverviewPageContent {...props} />
    </Suspense>
  );
}
