import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HeatStrip } from "@/components/charts/bars";
import { SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { EventList } from "@/features/monitoring/event-list";
import { EVENT_LABEL, FAILURE_LABEL, HEALTH_META, SEVERITY_STATUS } from "@/features/monitoring/labels";
import { MentionTrend } from "@/features/monitoring/mention-trend";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { When } from "@/features/monitoring/when";
import { formatRelative, formatShortDate } from "@/lib/format";
import { pointChange, sampleStatus } from "@/lib/stats";
import { STATUS, statusMeta, type StatusValue } from "@/lib/status";
import { getStore, storeIds } from "@/services/core";
import { getMonitoringOverview } from "@/services/monitoring";
import type { FailureClass } from "@/types/monitoring";

export const metadata: Metadata = { title: "Monitoring" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function MonitoringOverviewPage(props: PageProps<"/stores/[storeId]/monitoring">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const data = await getMonitoringOverview(storeId);
  if (!data) notFound();
  if (data.schedules.length === 0) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;

  const base = `/stores/${storeId}/monitoring`;
  const tz = data.storeTimezone;
  const { metrics, lastRun, timeline } = data;

  const statusCounts = Object.keys(STATUS.schedule)
    .map((key) => ({ key: key as StatusValue<"schedule">, count: data.schedules.filter((s) => s.status === key).length }))
    .filter((x) => x.count > 0);

  const runCounts = new Map<string, number>();
  for (const p of timeline) runCounts.set(p.status, (runCounts.get(p.status) ?? 0) + 1);
  const runSummary = [...runCounts.entries()].map(([status, count]) => `${count} ${statusMeta("run", status as StatusValue<"run">).label.toLowerCase()}`).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {metrics && lastRun ? (
        <MetricGrid>
          <MetricCell>
            <Metric
              label="Brand mention rate"
              numerator={metrics.mention.n}
              denominator={metrics.mention.d}
              basis={`${lastRun.id} · ${formatShortDate(lastRun.scheduledFor, tz)}`}
              sampleStatus={sampleStatus(metrics.mention.d)}
              delta={metrics.mentionPrevious ? { points: pointChange(metrics.mentionPrevious, metrics.mention), versus: "vs previous run" } : undefined}
              info="Mentions ÷ successful, analysed responses in the latest run. Failed jobs are excluded."
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Recommendation rate"
              numerator={metrics.recommendation.n}
              denominator={metrics.recommendation.d}
              basis={`${lastRun.id} · ${formatShortDate(lastRun.scheduledFor, tz)}`}
              sampleStatus={sampleStatus(metrics.recommendation.d)}
              delta={metrics.recommendationPrevious ? { points: pointChange(metrics.recommendationPrevious, metrics.recommendation), versus: "vs previous run" } : undefined}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Owned citation rate"
              numerator={metrics.ownedCitation.n}
              denominator={metrics.ownedCitation.d}
              unit="citation-capable responses"
              naReason={metrics.ownedCitation.d === 0 ? "No citation-capable responses" : undefined}
              delta={metrics.ownedCitation.d > 0 ? { points: pointChange(metrics.ownedCitationPrevious, metrics.ownedCitation), versus: "vs previous run" } : undefined}
              info="Responses citing your domain ÷ responses from providers that return citations."
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Response success rate"
              numerator={metrics.response.n}
              denominator={metrics.response.d}
              unit="jobs"
              basis={`${lastRun.id}`}
              delta={metrics.responsePrevious ? { points: pointChange(metrics.responsePrevious, metrics.response), versus: "vs previous run" } : undefined}
              info="Jobs that returned an answer ÷ planned jobs. Failed jobs are never counted as brand absent."
            />
          </MetricCell>
        </MetricGrid>
      ) : null}

      <SplitLayout
        main={
          <>
            <Card>
              <CardHeader
                title="Mention rate by run"
                subtitle={`${timeline.length} runs · pooled and by provider`}
                info="Mentions ÷ successful responses in each run. Each point shows n / d; failed jobs are excluded."
                actions={<ButtonLink href={`${base}/runs`} variant="ghost" size="sm" trailingIcon="arrow-right">Runs</ButtonLink>}
              />
              <CardBody className="flex flex-col gap-4">
                {timeline.length >= 2 ? (
                  <MentionTrend timeline={timeline} providers={data.providerSeries} markers={data.markers} />
                ) : (
                  <EmptyState icon="monitoring" title="Needs two runs for a trend" />
                )}
                {timeline.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    <p className="text-xs font-medium text-fg-muted">Run status</p>
                    <HeatStrip
                      label="Run status, oldest to newest"
                      cells={timeline.map((p) => ({ id: p.runId, tone: statusMeta("run", p.status).tone, title: `${p.runId} · ${formatShortDate(p.scheduledFor, tz)} · ${statusMeta("run", p.status).label} · ${p.planned - p.failed}/${p.planned} jobs ok` }))}
                    />
                    <p className="tnum text-xs text-fg-subtle">{runSummary}. Oldest to newest.</p>
                  </div>
                ) : null}
                {timeline.length > 0 && timeline.length < 4 ? <p className="text-xs text-fg-subtle">Fewer than 4 runs: read the trend as directional.</p> : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent changes" subtitle="Events detected between runs" actions={<ButtonLink href={`${base}/alerts`} variant="ghost" size="sm" trailingIcon="arrow-right">Alerts</ButtonLink>} />
              <CardBody>
                {data.recentEvents.length > 0 ? <EventList events={data.recentEvents} href={`${base}/alerts`} /> : <p className="text-[13px] text-fg-muted">No changes detected yet.</p>}
              </CardBody>
            </Card>
          </>
        }
        aside={
          <>
            <Card>
              <CardHeader title="Schedules" subtitle={`Times in ${tz}`} actions={<ButtonLink href={`${base}/schedules`} variant="ghost" size="sm" trailingIcon="arrow-right">All</ButtonLink>} />
              <CardBody className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-1.5">
                  {statusCounts.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5">
                      <Status kind="schedule" value={s.key} />
                      <span className="tnum text-xs text-fg-muted">{s.count}</span>
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
                  <div>
                    <p className="mb-0.5 text-xs text-fg-subtle">Last run</p>
                    {lastRun ? (
                      <>
                        <When iso={lastRun.scheduledFor} tz={tz} />
                        <Link href={`${base}/runs/${lastRun.id}`} className="text-xs font-medium text-accent-text hover:underline">{lastRun.id}</Link>
                      </>
                    ) : (
                      <p className="text-[13px] text-fg-muted">None yet</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-0.5 text-xs text-fg-subtle">Next run</p>
                    {data.nextRun ? (
                      <>
                        <When iso={data.nextRun.at} tz={tz} />
                        <span className="text-xs text-fg-subtle">{formatRelative(data.nextRun.at)}</span>
                      </>
                    ) : (
                      <p className="text-[13px] text-fg-muted">None scheduled</p>
                    )}
                  </div>
                </div>
                <ul className="flex flex-col gap-2 border-t border-line pt-3">
                  {data.schedules.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <Link href={`${base}/schedules/${s.id}`} className="min-w-0 truncate text-[13px] text-fg hover:underline">{s.name}</Link>
                      <Status kind="schedule" value={s.status} compact />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Provider health" subtitle={lastRun ? `Latest run, ${lastRun.id}` : undefined} info="Jobs that returned an answer ÷ planned jobs per provider. Under 90% is degraded; under 75% is an outage." />
              <CardBody>
                {data.health.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">No provider detail for this run.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.health.map((h) => {
                      const meta = HEALTH_META[h.state];
                      const failures = (Object.entries(h.failureClasses) as [FailureClass, number][]).map(([cls, n]) => `${n} ${FAILURE_LABEL[cls].toLowerCase()}`).join(", ");
                      return (
                        <li key={h.channelId} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[13px] font-medium text-fg">{h.short}</span>
                            <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                          </div>
                          <p className="tnum text-xs text-fg-subtle">{h.succeeded} / {h.planned} jobs ok{failures ? ` · ${failures}` : ""}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Open alerts" subtitle={`${data.openAlerts.length} to review`} actions={<ButtonLink href={`${base}/alerts`} variant="ghost" size="sm" trailingIcon="arrow-right">Inbox</ButtonLink>} />
              <CardBody>
                {data.openAlerts.length === 0 ? (
                  <p className="flex items-center gap-2 text-[13px] text-fg-muted"><Icon name="check-circle" size={16} className="text-success" />Nothing needs attention.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {data.openAlerts.map((e) => (
                      <li key={e.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                        <Link href={`${base}/alerts`} className="text-[13px] text-fg hover:underline">{e.title}</Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                          {e.alert ? <Status kind="severity" value={SEVERITY_STATUS[e.alert.severity]} compact /> : null}
                          <span>{EVENT_LABEL[e.type]} · {formatRelative(e.at)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </>
        }
      />
    </div>
  );
}
