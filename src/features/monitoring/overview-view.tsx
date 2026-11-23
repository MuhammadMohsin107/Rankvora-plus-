"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HeatStrip } from "@/components/charts/bars";
import { Badge, Status } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { SimulatedBadge, TrustLabel } from "@/components/ui/demo";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatRelative, formatShortDate } from "@/lib/format";
import { pointChange, sampleStatus } from "@/lib/stats";
import { statusMeta } from "@/lib/status";
import type { MonitoringOverview } from "@/services/monitoring";
import type { RunRec, RunSummary, TimelinePoint } from "@/types/monitoring";

import { EVENT_ICON, EVENT_TONE, FAILURE_LABEL, HEALTH_META, OPEN_ALERT_STATUSES, SEVERITY_STATUS, eventMeta } from "./labels";
import { MentionTrend } from "./mention-trend";
import { NoSchedules } from "./no-schedules";
import { FINISHED_RUN_STATUSES, isActiveRun } from "./run-sim";
import { useMonitoring } from "./state";
import { When } from "./when";

const circle = {
  neutral: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
} as const;

const isSim = (r: RunSummary): r is RunRec => (r as RunRec).simulated === true;

/** Overview: latest run, next run, four rates, trend, what changed, provider health. Reads the shared client state. */
export function OverviewView({ data }: { data: MonitoringOverview }) {
  const { schedules, runs, alerts, base, data: shell } = useMonitoring();
  const [lines, setLines] = useState<"pooled" | "providers">("pooled");
  const tz = data.storeTimezone;

  const finished = useMemo(() => runs.filter((r) => r.hasJobDetail && FINISHED_RUN_STATUSES.includes(r.status)), [runs]);
  const active = useMemo(() => runs.find((r) => isActiveRun(r.status)) ?? null, [runs]);
  const latest = finished[0] ?? null;
  // Same schedule only: a change is never computed across different scopes.
  const previous = latest ? (finished.find((r) => r.id !== latest.id && r.scheduleId === latest.scheduleId && r.scheduledFor < latest.scheduledFor) ?? null) : null;

  const timeline = useMemo<TimelinePoint[]>(() => {
    const seeded = new Set(data.timeline.map((p) => p.runId));
    const extra = finished
      .filter((r) => !seeded.has(r.id))
      .map<TimelinePoint>((r) => ({ runId: r.id, label: formatShortDate(r.scheduledFor), scheduledFor: r.scheduledFor, status: r.status, overall: r.mention, byProvider: [], failed: r.failed, planned: r.planned }));
    return [...data.timeline, ...extra].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  }, [data.timeline, finished]);

  const next = useMemo(() => {
    const c = schedules.filter((s) => s.status === "active" && s.nextRunAt).sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));
    return c[0] ?? null;
  }, [schedules]);

  const counts = useMemo(() => {
    const n = (s: string) => schedules.filter((x) => x.status === s).length;
    return { active: n("active") + n("needs_attention"), paused: n("paused"), draft: n("draft") };
  }, [schedules]);

  const statusOf = useMemo(() => new Map(alerts.rows.map((a) => [a.id, a.status])), [alerts.rows]);
  const shellEvents = shell.events;
  const changes = useMemo(() => {
    const open = (e: (typeof shellEvents)[number]) => e.alert !== null && (OPEN_ALERT_STATUSES as readonly string[]).includes(statusOf.get(e.alert.id) ?? e.alert.status);
    const sorted = [...shellEvents].sort((a, b) => b.at.localeCompare(a.at));
    return [...sorted.filter(open), ...sorted.filter((e) => !open(e))].slice(0, 6);
  }, [shellEvents, statusOf]);

  if (schedules.length === 0) return <NoSchedules />;

  const activePrompts = shell.promptBase.filter((p) => p.status === "active").length;
  const latestSim = latest !== null && isSim(latest);
  const unhealthy = data.health.filter((h) => h.state !== "healthy");

  return (
    <div className="flex flex-col gap-4">
      {active && isSim(active) ? (
        <Card variant="action">
          <CardBody className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body-sm font-medium text-fg">
                <Link href={`${base}/runs/${active.id}`} className="text-accent-text hover:underline">{active.id}</Link>{" "}
                <span className="text-fg-muted">{statusMeta("run", active.status).label.toLowerCase()}</span>
              </p>
              <SimulatedBadge />
            </div>
            <Progress value={active.doneJobs} max={active.planned} label={`${active.id} progress`} showCount />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
          <div className="min-w-0">
            <p className="text-label font-medium text-fg-muted">Latest run</p>
            {latest ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Link href={`${base}/runs/${latest.id}`} className="text-body font-medium text-accent-text hover:underline">{latest.id}</Link>
                <Status kind="run" value={latest.status} compact />
                {latestSim ? <SimulatedBadge /> : null}
                <span className="tnum text-helper text-fg-muted">{formatShortDate(latest.scheduledFor, tz)}</span>
              </div>
            ) : (
              <p className="mt-1 text-body-sm text-fg-muted">No run yet</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-label font-medium text-fg-muted">Next scheduled run</p>
            {next?.nextRunAt ? (
              <div className="mt-1">
                <When iso={next.nextRunAt} tz={tz} detail />
                <p className="truncate text-helper text-fg-muted">{next.name} · {formatRelative(next.nextRunAt)}</p>
              </div>
            ) : (
              <p className="mt-1 text-body-sm text-fg-muted">None scheduled</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-label font-medium text-fg-muted">Schedules</p>
            <p className="tnum mt-1 text-body">
              <Link href={`${base}/schedules`} className="font-medium text-accent-text hover:underline">{counts.active} active</Link>
              <span className="text-fg-muted">{counts.paused ? ` · ${counts.paused} paused` : ""}{counts.draft ? ` · ${counts.draft} draft` : ""}</span>
            </p>
          </div>
        </CardBody>
      </Card>

      {latest ? (
        <div className="flex flex-col gap-2">
          <MetricGrid>
            <MetricCell>
              <Metric
                label="Brand mention rate"
                numerator={latest.mention.n}
                denominator={latest.mention.d}
                sampleStatus={sampleStatus(latest.mention.d)}
                delta={previous ? { points: pointChange(previous.mention, latest.mention), versus: `vs ${previous.id}` } : undefined}
              />
            </MetricCell>
            <MetricCell>
              <Metric
                label="Recommendation rate"
                numerator={latest.recommendation.n}
                denominator={latest.recommendation.d}
                sampleStatus={sampleStatus(latest.recommendation.d)}
                delta={previous ? { points: pointChange(previous.recommendation, latest.recommendation) } : undefined}
              />
            </MetricCell>
            <MetricCell>
              {data.metrics && !latestSim ? (
                <Metric
                  label="Owned citation rate"
                  numerator={data.metrics.ownedCitation.n}
                  denominator={data.metrics.ownedCitation.d}
                  unit="citation-capable responses"
                  naReason={data.metrics.ownedCitation.d === 0 ? "No citation-capable responses" : undefined}
                  delta={data.metrics.ownedCitation.d > 0 ? { points: pointChange(data.metrics.ownedCitationPrevious, data.metrics.ownedCitation) } : undefined}
                  info="Responses citing your domain divided by responses from providers that return citations."
                />
              ) : (
                <Metric label="Owned citation rate" numerator={0} denominator={0} naReason="Not computed for simulated runs" />
              )}
            </MetricCell>
            <MetricCell>
              <Metric
                label="Response success rate"
                numerator={latest.succeeded}
                denominator={latest.planned}
                unit="jobs"
                delta={previous ? { points: pointChange({ n: previous.succeeded, d: previous.planned }, { n: latest.succeeded, d: latest.planned }) } : undefined}
              />
            </MetricCell>
          </MetricGrid>
          <TrustLabel
            samples={latest.mention.d}
            promptsIncluded={latest.promptIds?.length}
            promptsTotal={Math.max(latest.promptIds?.length ?? 0, activePrompts)}
            extra={`${latest.channelIds?.length ?? 0} of ${shell.ctx?.channels.length ?? 0} providers`}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Mention rate by run"
          info="Each point shows mentions divided by successful answers. Markers show configuration changes."
          actions={<Segmented label="Lines" size="sm" value={lines} onChange={setLines} options={[{ value: "pooled", label: "Pooled" }, { value: "providers", label: "By provider" }]} />}
        />
        <CardBody className="flex flex-col gap-4">
          {timeline.length >= 2 ? (
            <MentionTrend timeline={timeline} providers={data.providerSeries} markers={data.markers} showProviders={lines === "providers"} />
          ) : (
            <EmptyState icon="monitoring" title="Needs two runs for a trend" />
          )}
          {timeline.length > 0 ? (
            <div className="border-t border-line pt-3">
              <HeatStrip
                label="Run status, oldest to newest"
                cells={timeline.map((p) => ({ id: p.runId, tone: statusMeta("run", p.status).tone, title: `${p.runId} · ${formatShortDate(p.scheduledFor, tz)} · ${statusMeta("run", p.status).label} · ${p.planned - p.failed}/${p.planned} jobs ok` }))}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Changes" actions={<Link href={`${base}/alerts`} className="text-label font-medium text-accent-text hover:underline">All alerts</Link>} />
          <CardBody>
            {changes.length === 0 ? (
              <p className="text-body-sm text-fg-muted">Nothing changed.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {changes.map((e) => {
                  const status = e.alert ? (statusOf.get(e.alert.id) ?? e.alert.status) : null;
                  return (
                    <li key={e.id}>
                      <Link href={`${base}/alerts?event=${e.id}`} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-surface-2/50">
                        <span aria-hidden="true" className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full", circle[EVENT_TONE[e.type]])}>
                          <Icon name={EVENT_ICON[e.type]} size={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-body-sm text-fg", status === "new" && "font-medium")}>
                            {status === "new" ? <span className="sr-only">Unread: </span> : null}
                            {e.title}
                          </span>
                          <span className="tnum mt-0.5 block text-helper text-fg-muted">{eventMeta(e)} · {formatRelative(e.at)}</span>
                        </span>
                        {e.alert ? <Status kind="severity" value={SEVERITY_STATUS[e.alert.severity]} compact /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Provider health" info="Jobs that returned an answer divided by planned jobs in the latest scheduled run. Under 90% is degraded; under 75% is an outage." />
          <CardBody>
            {data.health.length === 0 ? (
              <p className="text-body-sm text-fg-muted">No provider detail yet.</p>
            ) : unhealthy.length === 0 ? (
              <p className="flex items-center gap-2 text-body-sm text-fg-muted">
                <Icon name="check-circle" size={16} className="text-success-icon" />
                All {data.health.length} providers healthy
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {unhealthy.map((h) => {
                  const meta = HEALTH_META[h.state];
                  const failures = Object.entries(h.failureClasses).map(([cls, n]) => `${n} ${FAILURE_LABEL[cls as keyof typeof FAILURE_LABEL].toLowerCase()}`).join(", ");
                  return (
                    <li key={h.channelId} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-body-sm font-medium text-fg">{h.short}</span>
                        <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>
                      </div>
                      <p className="tnum text-helper text-fg-muted">{h.succeeded} / {h.planned} jobs ok{failures ? ` · ${failures}` : ""}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
