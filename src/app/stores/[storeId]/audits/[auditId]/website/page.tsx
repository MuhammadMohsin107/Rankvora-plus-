import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ChecksTable, PagesTable } from "@/features/audit/website-tables";
import { ButtonLink } from "@/components/ui/button";
import { AUDIT_TYPE_LABEL } from "@/features/audit/labels";
import { auditParams, getAudit, getWebsiteLane, listAudits } from "@/services/audit";

export const metadata: Metadata = { title: "Website readiness" };

export async function generateStaticParams() {
  return auditParams();
}

async function WebsiteReadinessPageContent(props: PageProps<"/stores/[storeId]/audits/[auditId]/website">) {
  const { storeId, auditId } = await props.params;
  const [audit, lane, audits] = await Promise.all([getAudit(storeId, auditId), getWebsiteLane(storeId, auditId), listAudits(storeId)]);
  if (!audit) notFound();

  if (!audit.lanes.includes("website_readiness")) {
    // Designed state: a different scope, not an empty result. Point to the latest audit that did crawl the site.
    const withWebsite = audits.find((a) => !a.provisional && a.lanes.includes("website_readiness"));
    return (
      <EmptyState
        icon="globe"
        title="Website readiness was not part of this audit"
        description={`This ${AUDIT_TYPE_LABEL[audit.type].toLowerCase()} audit assessed AI visibility only. The site was not crawled and no checks ran, so there are no pass rates or crawler results here. This is not a score of zero.`}
        action={
          withWebsite ? (
            <ButtonLink href={`/stores/${storeId}/audits/${withWebsite.id}/website`} variant="primary" trailingIcon="arrow-right">
              View website readiness in {withWebsite.title}
            </ButtonLink>
          ) : (
            <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start an audit with website readiness</ButtonLink>
          )
        }
      />
    );
  }
  if (!lane) notFound();

  const { coverage } = lane;

  return (
    <div className="flex flex-col gap-6">
      {lane.provisional ? (
        <Callout tone="warning" title="Provisional">{lane.notice}</Callout>
      ) : lane.notice ? (
        <Callout tone="info">{lane.notice}</Callout>
      ) : null}

      <MetricGrid>
        <MetricCell>
          <Metric label="Technical pass rate" numerator={lane.technical.n} denominator={lane.technical.d} unit="determinate checks" naReason={lane.technical.d === 0 ? "No determinate checks yet" : undefined} info="Passing ÷ determinate technical checks. Reported on its own, never blended with content quality." />
        </MetricCell>
        <MetricCell>
          <Metric label="Content-quality pass rate" numerator={lane.content.n} denominator={lane.content.d} unit="determinate checks" naReason={lane.content.d === 0 ? "No determinate checks yet" : undefined} info="Passing ÷ determinate content and entity checks." />
        </MetricCell>
        <MetricCell>
          <Metric label="Check coverage" numerator={lane.checkCoverage.n} denominator={lane.checkCoverage.d} unit="applicable checks" info="Checks with a determinate result ÷ applicable checks. Inconclusive, blocked, errored and not-assessed checks lower it." />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Page coverage"
            numerator={coverage.pages.n}
            denominator={coverage.pages.d}
            unit="in-scope pages"
            basis={`${coverage.pagesDetail.excluded} excluded · ${coverage.pagesDetail.blocked} blocked · ${coverage.pagesDetail.unvisited} unvisited`}
            info="Assessed ÷ discovered in-scope pages. Excluded pages are out of scope by rule."
          />
        </MetricCell>
      </MetricGrid>

      <Card as="section">
        <CardHeader title="AI crawler access" info="Reported per crawler; one rule never stands in for another. Read from robots.txt: the rule shown is the group that applies to that user-agent." />
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-3">
          {lane.crawlers.map((c) => (
            <article key={c.id} className="flex min-w-0 flex-col gap-2.5 rounded-control border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold text-fg">{c.name}</h3>
                  <p className="text-xs text-fg-subtle">{c.purpose}</p>
                </div>
                {c.allowed ? <Badge tone="success" icon="check-circle">Allowed</Badge> : <Badge tone="danger" icon="lock">Disallowed</Badge>}
              </div>
              <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-mono text-xs text-fg-muted [overflow-wrap:anywhere]">{c.rule}</pre>
              <p className="text-[13px] text-fg">{c.consequence}</p>
              {c.findingId ? (
                <Link href={`/stores/${storeId}/fixes/findings/${c.findingId}`} className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                  Open finding {c.findingId}
                </Link>
              ) : null}
            </article>
          ))}
        </CardBody>
      </Card>

      <Section title="Checks">
        <ChecksTable checks={lane.checks} storeId={storeId} />
      </Section>

      <Section title="Pages" actions={<Badge tone="neutral" title="Page detail is kept for a sample of the assessed pages.">Showing {lane.pagesTotalDetail} of {coverage.pages.n} assessed</Badge>}>
        <PagesTable pages={lane.pages} issues={lane.pageIssues} />
      </Section>
    </div>
  );
}

export default function WebsiteReadinessPage(props: PageProps<"/stores/[storeId]/audits/[auditId]/website">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WebsiteReadinessPageContent {...props} />
    </Suspense>
  );
}
