import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HeatStrip } from "@/components/charts/bars";
import { SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { EventList } from "@/features/monitoring/event-list";
import { FAILURE_LABEL, HEALTH_META, SEVERITY_STATUS, eventMeta } from "@/features/monitoring/labels";
import { MentionTrend } from "@/features/monitoring/mention-trend";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { When } from "@/features/monitoring/when";
import { formatRelative, formatShortDate } from "@/lib/format";
import { pointChange, sampleStatus } from "@/lib/stats";
import { statusMeta, type StatusValue } from "@/lib/status";
import { getStore, storeIds } from "@/services/core";
import { getMonitoringOverview } from "@/services/monitoring";
import type { FailureClass } from "@/types/monitoring";

export const metadata: Metadata = { title: "Monitoring" };

export async function generateStaticParams() {
  return storeIds();
}

async function MonitoringOverviewPageContent(props: PageProps<"/stores/[storeId]/monitoring">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const data = await getMonitoringOverview(storeId);
  if (!data) notFound();
  if (data.schedules.length === 0) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;

  const base = `/stores/${storeId}/monitoring`;
  const tz = data.storeTimezone;
  const { metrics, lastRun, timeline } = data;

  const runCounts = new Map<string, number>();
  for (const p of timeline) runCounts.set(p.status, (runCounts.get(p.status) ?? 0) + 1);
  const runSummary = [...runCounts.entries()].map(([status, count]) => `${count} ${statusMeta("run", status as StatusValue<"run">).label.toLowerCase()}`).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {lastRun ? (
        <p className="text-xs text-fg-subtle">
          Latest run <Link href={`${base}/runs/${lastRun.id}`} className="font-medium text-accent-text hover:underline">{lastRun.id}</Link> · {formatShortDate(lastRun.scheduledFor, tz)}
          {metrics ? " · changes are versus the previous run" : ""}
        </p>
      ) : null}
      {metrics && lastRun ? (
        <MetricGrid>
          <MetricCell>
            <Metric
              label="Brand mention rate"
              numerator={metrics.mention.n}
              denominator={metrics.mention.d}
              sampleStatus={sampleStatus(metrics.mention.d)}
              delta={metrics.mentionPrevious ? { points: pointChange(metrics.mentionPrevious, metrics.mention) } : undefined}
              info="Mentions ÷ successful, analysed responses in the latest run. Failed jobs are excluded."
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Recommendation rate"
              numerator={metrics.recommendation.n}
              denominator={metrics.recommendation.d}
              sampleStatus={sampleStatus(metrics.recommendation.d)}
              delta={metrics.recommendationPrevious ? { points: pointChange(metrics.recommendationPrevious, metrics.recommendation) } : undefined}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Owned citation rate"
              numerator={metrics.ownedCitation.n}
              denominator={metrics.ownedCitation.d}
              unit="citation-capable responses"
              naReason={metrics.ownedCitation.d === 0 ? "No citation-capable responses" : undefined}
              delta={metrics.ownedCitation.d > 0 ? { points: pointChange(metrics.ownedCitationPrevious, metrics.ownedCitation) } : undefined}
              info="Responses citing your domain ÷ responses from providers that return citations."
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Response success rate"
              numerator={metrics.response.n}
              denominator={metrics.response.d}
              unit="jobs"
              delta={metrics.responsePrevious ? { points: pointChange(metrics.responsePrevious, metrics.response) } : undefined}
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
                info="Each point shows n / d. Failed jobs are excluded."
              />
              <CardBody className="flex flex-col gap-4">
                {timeline.length >= 2 ? (
                  <MentionTrend timeline={timeline} providers={data.providerSeries} markers={data.markers} />
                ) : (
                  <EmptyState icon="monitoring" title="Needs two runs for a trend" />
                )}
                {timeline.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-line pt-3">
                    <HeatStrip
                      label="Run status, oldest to newest"
                      cells={timeline.map((p) => ({ id: p.runId, tone: statusMeta("run", p.status).tone, title: `${p.runId} · ${formatShortDate(p.scheduledFor, tz)} · ${statusMeta("run", p.status).label} · ${p.planned - p.failed}/${p.planned} jobs ok` }))}
                    />
                    <p className="tnum text-xs text-fg-subtle">{runSummary} · oldest to newest</p>
                  </div>
                ) : null}
                {timeline.length > 0 && timeline.length < 4 ? <p className="text-xs text-fg-subtle">Fewer than 4 runs: read the trend as directional.</p> : null}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Recent changes" subtitle="Detected between runs" />
              <CardBody>
                {data.recentEvents.length > 0 ? <EventList events={data.recentEvents} href={`${base}/alerts`} /> : <p className="text-[13px] text-fg-muted">No other changes.</p>}
              </CardBody>
            </Card>
          </>
        }
        aside={
          <>
            <Card>
              <CardHeader title="Schedule status" subtitle={`Times in ${tz}`} />
              <CardBody className="flex flex-col gap-4">
                <div>
                  <p className="mb-0.5 text-xs text-fg-subtle">Next run</p>
                  {data.nextRun ? (
                    <>
                      <When iso={data.nextRun.at} tz={tz} detail />
                      <span className="text-xs text-fg-subtle">{formatRelative(data.nextRun.at)}</span>
                    </>
                  ) : (
                    <p className="text-[13px] text-fg-muted">None scheduled</p>
                  )}
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
              <CardHeader title="Provider health" info="Jobs that returned an answer ÷ planned jobs per provider. Under 90% is degraded; under 75% is an outage." />
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
              <CardHeader title="Open alerts" />
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
                          <span>{eventMeta(e)} · {formatRelative(e.at)}</span>
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

export default function MonitoringOverviewPage(props: PageProps<"/stores/[storeId]/monitoring">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MonitoringOverviewPageContent {...props} />
    </Suspense>
  );
}
