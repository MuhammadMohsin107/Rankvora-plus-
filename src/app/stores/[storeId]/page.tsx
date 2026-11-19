import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LineChart } from "@/components/charts/line-chart";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/feedback";
import { Timeline } from "@/components/ui/misc";
import { formatDate, formatRelative, formatShortDate, formatTime } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import { getDashboardData } from "@/services/dashboard";
import { getStore, storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Dashboard" };

export async function generateStaticParams() {
  return storeIds();
}

async function StoreDashboardPageContent(props: PageProps<"/stores/[storeId]">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const base = `/stores/${store.id}`;
  const summary = store.summary;

  if (!summary) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle={`${store.marketName} · ${store.language.toUpperCase()}`} actions={<ButtonLink href={`${base}/settings`} variant="primary">Finish setup</ButtonLink>} />
        <EmptyState
          icon="settings"
          title="Finish setup to start tracking"
          description="Add at least one AI channel and an active prompt, then run a first audit."
          action={<ButtonLink href={`${base}/settings`} variant="primary">Open store settings</ButtonLink>}
        />
      </>
    );
  }

  const data = await getDashboardData(store.id);
  const basis = data ? `Latest run ${formatShortDate(data.monitoring.lastRun.scheduledFor)} · ${store.channelIds.length} API channels · change vs previous run` : `Latest run · ${store.channelIds.length} API channels`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${store.domain} · ${store.marketName} · ${store.language.toUpperCase()}`}
        actions={<ButtonLink href={`${base}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>}
      />

      <p className="mb-2 text-xs text-fg-subtle">{basis}</p>
      <MetricGrid>
        <MetricCell>
          <Metric
            label="Brand mention rate"
            numerator={summary.mention.n}
            denominator={summary.mention.d}
            delta={{ points: pointChange(summary.mentionPrevious, summary.mention) }}
            info="Responses that mention the brand ÷ successful, analysed API answer samples. Failed requests are excluded."
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Recommendation rate"
            numerator={summary.recommendation.n}
            denominator={summary.recommendation.d}
            delta={{ points: pointChange(summary.recommendationPrevious, summary.recommendation) }}
            info="A simple mention is not a recommendation."
          />
        </MetricCell>
        <MetricCell>
          <Metric
            label="Owned citation rate"
            numerator={summary.ownedCitation.n}
            denominator={summary.ownedCitation.d}
            unit="citation-capable responses"
            delta={{ points: pointChange(summary.ownedCitationPrevious, summary.ownedCitation) }}
            naReason={summary.ownedCitation.d === 0 ? "No citation data from these channels" : undefined}
          />
        </MetricCell>
        <MetricCell>
          {data ? (
            <Metric
              label="Response success"
              numerator={data.monitoring.lastRun.succeededJobs}
              denominator={data.monitoring.lastRun.plannedJobs}
              unit="requests"
              info="Failed requests are excluded from every rate above. A failed request is not evidence that the brand is absent."
            />
          ) : (
            <Metric label="Response success" value="N/A" naReason="No runs yet" />
          )}
        </MetricCell>
      </MetricGrid>

      {!data ? (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Monitoring" />
            <CardBody>
              <KeyValue
                columns={2}
                items={[
                  { label: "Last run", value: summary.lastRunAt ? formatDate(summary.lastRunAt, store.timezone) : "—" },
                  { label: "Next run", value: summary.nextRunAt ? formatDate(summary.nextRunAt, store.timezone) : "—" },
                  { label: "Open alerts", value: <span className="tnum">{summary.openAlerts}</span> },
                  { label: "Active prompts", value: <span className="tnum">{summary.activePrompts}</span> },
                ]}
              />
            </CardBody>
          </Card>
          <EmptyState icon="monitoring" title="History builds up here" description="Trends, findings and tasks appear after the first audit." action={<ButtonLink href={`${base}/audits/new`} variant="primary">Start audit</ButtonLink>} />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader title="Visibility trend" subtitle="Weekly monitoring · API answer samples" />
              <CardBody>
                <LineChart
                  height={240}
                  summary={`Brand mention rate rose from ${Math.round((data.trend[0].mention.n / data.trend[0].mention.d) * 100)}% to ${Math.round((data.trend[data.trend.length - 1].mention.n / data.trend[data.trend.length - 1].mention.d) * 100)}% across ${data.trend.length} weekly runs.`}
                  percent
                  yMax={100}
                  series={[
                    { id: "mention", label: "Mention rate", tone: 1, dash: "solid", points: data.trend.map((r) => ({ x: formatShortDate(r.date), y: (r.mention.n / r.mention.d) * 100, n: r.mention.d, detail: `${r.mention.n} / ${r.mention.d}` })) },
                    { id: "recommendation", label: "Recommendation rate", tone: 2, dash: "dashed", points: data.trend.map((r) => ({ x: formatShortDate(r.date), y: (r.recommendation.n / r.recommendation.d) * 100, n: r.recommendation.d, detail: `${r.recommendation.n} / ${r.recommendation.d}` })) },
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Monitoring" actions={<Status kind="schedule" value={data.monitoring.schedule.status} />} />
              <CardBody className="flex flex-col gap-4">
                <Link href={`${base}/monitoring`} className="text-[13px] font-medium text-accent-text hover:underline">{data.monitoring.schedule.name}</Link>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "Last run", value: <span className="flex flex-col items-start gap-1.5"><span className="tnum">{formatDate(data.monitoring.lastRun.scheduledFor, store.timezone)} {formatTime(data.monitoring.lastRun.scheduledFor, store.timezone)}</span><Status kind="run" value={data.monitoring.lastRun.status} /></span> },
                    { label: "Next run", value: <span className="tnum">{formatDate(data.monitoring.schedule.nextRunAt ?? "", store.timezone)} {formatTime(data.monitoring.schedule.nextRunAt ?? "", store.timezone)}</span> },
                    { label: "Open alerts", value: <Link href={`${base}/monitoring/alerts`} className="tnum font-medium text-accent-text hover:underline">{data.monitoring.openAlerts} unread</Link> },
                  ]}
                />
                {data.monitoring.inProgressAudit ? (
                  <Link href={`${base}/audits/${data.monitoring.inProgressAudit.id}`} className="flex flex-col gap-1.5 rounded-control border border-accent/30 bg-accent-soft/50 p-3 hover:bg-accent-soft">
                    <span className="flex items-center justify-between text-xs font-medium text-accent-text">
                      <span className="flex items-center gap-1.5"><Icon name="loader" size={13} className="animate-spin" /> Audit in progress</span>
                      <span className="tnum">{data.monitoring.inProgressAudit.succeededJobs + data.monitoring.inProgressAudit.failedJobs} / {data.monitoring.inProgressAudit.plannedJobs} jobs</span>
                    </span>
                    <Progress value={data.monitoring.inProgressAudit.succeededJobs + data.monitoring.inProgressAudit.failedJobs} max={data.monitoring.inProgressAudit.plannedJobs} label="Audit progress" />
                  </Link>
                ) : null}
              </CardBody>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Important findings" subtitle={`${data.findings.length} open · by priority`} actions={<ButtonLink href={`${base}/fixes`} variant="ghost" size="sm" trailingIcon="arrow-right">All</ButtonLink>} />
              <CardBody className="pt-2">
                <ul className="divide-y divide-line">
                  {data.findings.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      <Link href={`${base}/fixes/findings/${f.id}`} className="flex items-start gap-3 py-2.5 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-control sm:px-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{f.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5"><Status kind="severity" value={f.severity} /><Status kind="finding" value={f.status} compact /></p>
                        </div>
                        <Badge tone="neutral">{f.priority}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Pending tasks" subtitle={`${data.tasks.length} open`} actions={<ButtonLink href={`${base}/fixes/tasks`} variant="ghost" size="sm" trailingIcon="arrow-right">Board</ButtonLink>} />
              <CardBody className="pt-2">
                <ul className="divide-y divide-line">
                  {data.tasks.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link href={`${base}/fixes/tasks/${t.id}`} className="flex items-start gap-3 py-2.5 hover:bg-surface-2/60 sm:-mx-2 sm:rounded-control sm:px-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-fg">{t.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5"><Status kind="task" value={t.status} />{t.dueAt ? <span className="tnum text-xs text-fg-subtle">Due {formatShortDate(t.dueAt)}</span> : <span className="text-xs text-fg-subtle">Unassigned</span>}</p>
                        </div>
                        <Badge tone="neutral">{t.priority}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="Competitor visibility" subtitle={`Responses naming each brand · of ${data.competitors[0]?.d ?? 0} successful`} />
              <CardBody className="flex flex-col gap-3.5">
                {data.competitors.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-[13px] text-fg">{c.name}{c.status === "suggested" ? <Badge tone="warning" icon="sparkles">Suggested</Badge> : null}</span>
                      <span className="tnum text-xs text-fg-muted">{c.n} / {c.d}</span>
                    </div>
                    <Progress value={c.n} max={c.d} label={`${c.name} mentions`} tone="warning" />
                  </div>
                ))}
              </CardBody>
            </Card>

            {data.comparison ? (
              <Card>
                <CardHeader title="Recent comparison" subtitle={data.comparison.title} actions={<ButtonLink href={`${base}/comparisons/${data.comparison.id}`} variant="ghost" size="sm" trailingIcon="arrow-right">Open</ButtonLink>} />
                <CardBody className="flex flex-col gap-3.5">
                  <Status kind="comparability" value={data.comparison.verdict} />
                  {[data.comparison.mention, data.comparison.recommendation].map((m) =>
                    m && m.baseline && m.current ? (
                      <div key={m.id} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-fg">{m.label}</span>
                          {m.pointChange !== null ? <span className="tnum text-xs font-medium text-fg">{m.pointChange > 0 ? "+" : m.pointChange < 0 ? "−" : ""}{Math.abs(m.pointChange).toFixed(1)} pp</span> : null}
                        </div>
                        <p className="tnum text-xs text-fg-muted">{Math.round(m.baseline.n)} / {m.baseline.d} → {Math.round(m.current.n)} / {m.current.d} {m.unit}</p>
                      </div>
                    ) : null,
                  )}
                  <p className="tnum text-xs text-fg-subtle">{data.comparison.matchedPairs} of {data.comparison.baselineSlots} slots matched</p>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Recent activity" />
              <CardBody>
                <Timeline items={data.activity.map((a) => ({ id: a.id, title: a.title, meta: a.detail, time: formatRelative(a.at), icon: a.icon, tone: a.tone }))} />
              </CardBody>
            </Card>
          </div>

        </>
      )}
    </>
  );
}

export default function StoreDashboardPage(props: PageProps<"/stores/[storeId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <StoreDashboardPageContent {...props} />
    </Suspense>
  );
}
