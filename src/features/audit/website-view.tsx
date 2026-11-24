import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import type { AuditDetail, AuditSummary, WebsiteLane } from "@/types/audit";

import { AUDIT_TYPE_LABEL } from "./labels";
import { ChecksTable, PagesTable } from "./website-tables";

/** Website readiness lane of one audit. A different scope is a designed state, not an empty result. */
export function WebsiteView({ audit, lane, storeId, otherWithWebsite }: { audit: AuditDetail; lane: WebsiteLane | null; storeId: string; otherWithWebsite?: AuditSummary | null }) {
  if (!audit.lanes.includes("website_readiness")) {
    return (
      <EmptyState
        icon="globe"
        title="Website readiness was not part of this audit"
        description={`This ${AUDIT_TYPE_LABEL[audit.type].toLowerCase()} audit covered AI visibility only. That is not a score of zero.`}
        action={
          otherWithWebsite ? (
            <ButtonLink href={`/stores/${storeId}/audits/${otherWithWebsite.id}/website`} variant="primary" trailingIcon="arrow-right">
              View {otherWithWebsite.title}
            </ButtonLink>
          ) : (
            <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start an audit with website readiness</ButtonLink>
          )
        }
      />
    );
  }
  if (!lane) return <EmptyState icon="globe" title="No website results yet" />;
  const { coverage } = lane;
  if (lane.pages.length === 0 && lane.checks.length === 0 && !lane.provisional) {
    return <EmptyState icon="globe" title="No pages were crawled" description={audit.status === "blocked" ? "The audit was blocked during validation." : "The audit ended before the crawl started."} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {lane.provisional ? <Callout tone="warning" title="Provisional">{lane.notice}</Callout> : lane.notice ? <Callout tone="info">{lane.notice}</Callout> : null}

      <MetricGrid>
        <MetricCell>
          <Metric label="Technical pass rate" numerator={lane.technical.n} denominator={lane.technical.d} unit="determinate checks" naReason={lane.technical.d === 0 ? "No determinate checks yet" : undefined} info="Passing ÷ determinate technical checks. Never blended with content quality." />
        </MetricCell>
        <MetricCell>
          <Metric label="Content-quality pass rate" numerator={lane.content.n} denominator={lane.content.d} unit="determinate checks" naReason={lane.content.d === 0 ? "No determinate checks yet" : undefined} info="Passing ÷ determinate content and entity checks." />
        </MetricCell>
        <MetricCell>
          <Metric label="Check coverage" numerator={lane.checkCoverage.n} denominator={lane.checkCoverage.d} unit="applicable checks" info="Determinate ÷ applicable checks. Inconclusive, blocked, errored and not-assessed checks lower it." />
        </MetricCell>
        <MetricCell>
          <Metric label="Page coverage" numerator={coverage.pages.n} denominator={coverage.pages.d} unit="in-scope pages" basis={`${coverage.pagesDetail.excluded} excluded · ${coverage.pagesDetail.blocked} blocked · ${coverage.pagesDetail.unvisited} unvisited`} />
        </MetricCell>
      </MetricGrid>

      {lane.crawlers.length > 0 ? (
        <Card as="section">
          <CardHeader title="AI crawler access" info="Reported per crawler; one rule never stands in for another. The rule is the robots.txt group that applies." />
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {lane.crawlers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-fg">{c.name}</p>
                    <p className="text-helper text-fg-subtle">{c.purpose}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Tooltip content={`${c.rule}\n\n${c.consequence}`}>
                      <span tabIndex={0} className="cursor-help text-helper text-fg-muted underline decoration-dotted">Rule</span>
                    </Tooltip>
                    {c.findingId ? (
                      <Link href={`/stores/${storeId}/fixes/findings/${c.findingId}`} className="rv-target text-label font-medium text-accent-text hover:underline">Finding</Link>
                    ) : null}
                    {c.allowed ? <Badge tone="success" icon="check-circle">Allowed</Badge> : <Badge tone="danger" icon="lock">Disallowed</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Section title="Checks">
        <ChecksTable checks={lane.checks} storeId={storeId} />
      </Section>

      <Section title="Pages" actions={<Badge tone="neutral" title="Page detail is kept for a sample of the assessed pages.">Showing {lane.pagesTotalDetail} of {coverage.pages.n} assessed</Badge>}>
        <PagesTable pages={lane.pages} issues={lane.pageIssues} storeId={storeId} />
      </Section>
    </div>
  );
}
