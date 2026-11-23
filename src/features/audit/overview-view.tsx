import Link from "next/link";

import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatCurrency } from "@/lib/format";
import type { AuditDetail, LaneSummary } from "@/types/audit";

import { LaneCards } from "./lane-cards";
import { TRIGGER_LABEL } from "./labels";

const limitationIcon = { warning: "alert-triangle", info: "info", neutral: "minus-circle" } as const;
const limitationColor = { warning: "text-warning-text", info: "text-info-text", neutral: "text-fg-subtle" } as const;

/** Result state notes: what the status means for the numbers below. One short callout at most. */
function StatusNote({ audit }: { audit: AuditDetail }) {
  const { coverage } = audit;
  if (audit.status === "partially_completed") {
    return (
      <Callout tone="warning" title="Partially completed">
        {coverage.responses.n} of {coverage.responses.d} planned requests returned a usable answer. Rates cover those only; failed requests are not read as the brand being absent.
      </Callout>
    );
  }
  if (audit.status === "cancelled") {
    const kept = audit.succeededJobs + audit.failedJobs;
    return (
      <Callout tone="neutral" title="Cancelled">
        {kept > 0 || (audit.pages?.n ?? 0) > 0
          ? `Stopped after ${kept} of ${audit.plannedJobs} requests and ${audit.pages?.n ?? 0} pages. The completed work is kept. No snapshot was created.`
          : "Stopped before any request was sent or page crawled. Nothing was kept and no snapshot was created."}
      </Callout>
    );
  }
  if (audit.status === "failed") {
    return (
      <Callout tone="danger" title="Failed">
        The run stopped because most provider requests failed. {audit.succeededJobs} responses were kept. No snapshot was created.
      </Callout>
    );
  }
  if (audit.status === "blocked") {
    return (
      <Callout tone="danger" title="Blocked">
        The audit could not start: validation failed before any request was sent. Fix the blocker in the configuration and run it again.
      </Callout>
    );
  }
  return null;
}

/** Overview of a finished audit: lanes first, one coverage card, limitations folded. */
export function OverviewView({ audit, summary, storeId }: { audit: AuditDetail; summary: LaneSummary; storeId: string }) {
  const base = `/stores/${storeId}/audits/${audit.id}`;
  const { config, coverage, usage } = audit;
  const hasWebsite = audit.lanes.includes("website_readiness");
  const hasAi = audit.lanes.includes("ai_visibility");
  const empty = audit.status === "blocked";
  const trigger = config.trigger;

  return (
    <div className="flex flex-col gap-4">
      <StatusNote audit={audit} />
      {trigger ? (
        <p className="flex items-center gap-1.5 text-body-sm text-fg-muted">
          <Icon name="bolt" size={14} className="text-fg-subtle" />
          {trigger.source === "schedule" ? "Scheduled" : `Triggered: ${TRIGGER_LABEL[trigger.source]}`} · {trigger.reason}
        </p>
      ) : null}
      {config.verifies ? (
        <p className="flex items-center gap-1.5 text-body-sm text-fg-muted">
          <Icon name="shield-check" size={14} className="text-fg-subtle" />
          Re-checks finding{" "}
          <Link href={`/stores/${storeId}/fixes/findings/${config.verifies.findingId}`} className="font-medium text-accent-text hover:underline">{config.verifies.findingId}</Link>
          {config.verifies.taskId ? (
            <>
              {" "}
              · task <Link href={`/stores/${storeId}/fixes/tasks/${config.verifies.taskId}`} className="font-medium text-accent-text hover:underline">{config.verifies.taskId}</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {empty ? null : <LaneCards summary={summary} base={base} variant="headline" showLinks={false} basis={audit.type === "verification" ? "Verification scope" : undefined} />}

      {empty ? null : (
        <Card as="section">
          <CardHeader title="Coverage" subtitle="Planned versus returned" />
          <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {hasAi ? <Metric label="Responses" numerator={coverage.responses.n} denominator={coverage.responses.d} unit="requests" basis={audit.failedJobs ? `${audit.failedJobs} failed` : undefined} /> : null}
            {hasAi ? <Metric label="Prompts answered" numerator={coverage.prompts.n} denominator={coverage.prompts.d} unit="prompts" /> : null}
            {hasWebsite ? <Metric label="Pages" numerator={coverage.pages.n} denominator={coverage.pages.d} unit="in scope" basis={`${coverage.pagesDetail.excluded} excluded · ${coverage.pagesDetail.blocked} blocked · ${coverage.pagesDetail.unvisited} unvisited`} /> : null}
            {hasWebsite ? <Metric label="Checks" numerator={coverage.checks.n} denominator={coverage.checks.d} unit="applicable" /> : null}
          </CardBody>
        </Card>
      )}

      <details className="group rounded-card border border-line bg-surface shadow-card">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-card py-3 text-card-title font-semibold text-fg">
          <span>Limitations ({audit.limitations.length})</span>
          <Icon name="chevron-down" size={16} className="text-fg-subtle transition-transform duration-[var(--dur-fast)] group-open:rotate-180" />
        </summary>
        <ul className="divide-y divide-line border-t border-line px-card">
          {audit.limitations.map((item) => (
            <li key={item.id} className="flex items-start gap-2.5 py-2.5">
              <Icon name={limitationIcon[item.tone]} size={15} className={`mt-0.5 shrink-0 ${limitationColor[item.tone]}`} />
              <p className="text-body-sm text-fg">{item.text}</p>
            </li>
          ))}
        </ul>
      </details>

      <details className="group rounded-card border border-line bg-surface shadow-card">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-card py-3 text-card-title font-semibold text-fg">
          <span>Run summary</span>
          <Icon name="chevron-down" size={16} className="text-fg-subtle transition-transform duration-[var(--dur-fast)] group-open:rotate-180" />
        </summary>
        <div className="border-t border-line p-card">
          <KeyValue
            columns={2}
            items={[
              ...(hasAi ? [{ label: "AI scope", value: <span className="tnum">{config.promptIds.length} prompts × {config.channelIds.length} providers × {config.samples} {config.samples === 1 ? "sample" : "samples"}</span> }] : []),
              ...(hasWebsite ? [{ label: "Website scope", value: <span className="tnum">{config.startPoints.join(", ") || "None"} · up to {config.maxUrls} URLs</span> }] : []),
              { label: "Requests", value: <span className="tnum">{usage.requests.attempted} sent · {usage.requests.failed} failed</span> },
              { label: "Estimated cost", value: <span className="tnum">about {formatCurrency(usage.estimatedCostUsd)} of {formatCurrency(usage.budgetUsd)} cap</span> },
              {
                label: "Compared with",
                value: audit.baseline ? (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link href={`/stores/${storeId}/audits/${audit.baseline.id}`} className="text-accent-text hover:underline">{audit.baseline.title}</Link>
                    {audit.snapshotId ? <Link href={`/stores/${storeId}/comparisons/new?baseline=${audit.baseline.id}&current=${audit.id}`} className="text-helper text-accent-text hover:underline">Compare</Link> : null}
                  </span>
                ) : (
                  <span className="text-fg-muted">No comparable earlier audit</span>
                ),
              },
            ]}
          />
        </div>
      </details>
    </div>
  );
}
