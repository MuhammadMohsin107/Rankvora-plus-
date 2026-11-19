import Link from "next/link";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge, Status } from "@/components/ui/badge";
import { KeyValue, Metric, MetricCell } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { Limitations, MetricStrip, ReportFrame, ReportSection, SourceLinks } from "@/features/reports/report-parts";
import { formatCurrency, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import { humanize, type StatusValue } from "@/lib/status";
import type { MonitoringEvent, MonitoringReportData, ReportRecord } from "@/types/comparison";

const SECTIONS = [
  { id: "summary", title: "Run summary" },
  { id: "metrics", title: "Metrics" },
  { id: "providers", title: "By provider" },
  { id: "events", title: "Events" },
  { id: "alerts", title: "Alerts" },
  { id: "usage", title: "Usage" },
  { id: "limitations", title: "Limitations" },
  { id: "sources", title: "Sources and versions" },
];

const eventMeta: Record<MonitoringEvent["kind"], { label: string; tone: "success" | "danger"; icon: "arrow-up" | "arrow-down" }> = {
  new_mention: { label: "New mention", tone: "success", icon: "arrow-up" },
  lost_mention: { label: "Lost mention", tone: "danger", icon: "arrow-down" },
  new_recommendation: { label: "New recommendation", tone: "success", icon: "arrow-up" },
  recommendation_lost: { label: "Recommendation lost", tone: "danger", icon: "arrow-down" },
};

const severityTone = { info: "neutral", low: "info", medium: "warning", high: "danger", critical: "danger" } as const;

export function MonitoringReport({ report, data, storeId, limitations }: { report: ReportRecord; data: MonitoringReportData; storeId: string; limitations: string[] }) {
  const { run } = data;
  const versus = data.previousRunId ? `vs ${data.previousRunId}` : undefined;
  const sources = [
    { label: "Monitoring run", id: run.id, href: `/stores/${storeId}/monitoring/runs/${run.id}` },
    { label: "Schedule", id: run.scheduleId, href: `/stores/${storeId}/monitoring/schedules/${run.scheduleId}` },
    ...(data.previousRunId ? [{ label: "Previous run", id: data.previousRunId, href: `/stores/${storeId}/monitoring/runs/${data.previousRunId}` }] : []),
  ];

  const providerRows: BarCompareRow[] = data.channels
    .filter((c) => c.previousMention)
    .map((c) => ({ id: c.id, label: c.label, baseline: c.previousMention, current: c.mention }));

  const counts = (["new_mention", "lost_mention", "new_recommendation", "recommendation_lost"] as const).map((kind) => ({ kind, count: data.events.filter((e) => e.kind === kind).length }));

  return (
    <ReportFrame report={report} sections={SECTIONS} sources={sources}>
      <ReportSection id="summary" number={1} title="Run summary">
        <KeyValue
          columns={2}
          items={[
            { label: "Run", value: <Mono>{run.id}</Mono> },
            { label: "Status", value: <Status kind="run" value={run.status as StatusValue<"run">} /> },
            { label: "Scheduled for", value: <span className="tnum">{formatDateTime(run.scheduledFor)} UTC</span> },
            { label: "Snapshot", value: <Mono>{run.snapshotId}</Mono> },
          ]}
        />
        <MetricStrip columns={3}>
          <MetricCell>
            <Metric label="Jobs succeeded" numerator={run.succeededJobs} denominator={run.plannedJobs} unit="planned jobs" />
          </MetricCell>
          <MetricCell>
            <Metric label="Jobs failed" value={String(run.failedJobs)} basis="excluded from rates" />
          </MetricCell>
          <MetricCell>
            <Metric label="Analysed responses" value={String(data.mention.current.d)} basis="successful, eligible" />
          </MetricCell>
        </MetricStrip>
      </ReportSection>

      <ReportSection id="metrics" number={2} title="Metrics" subtitle={data.previousRunId ? `Compared with ${data.previousRunId}, whole run` : "First run, nothing to compare with"}>
        <MetricStrip columns={3}>
          <MetricCell>
            <Metric
              label="Brand mention rate"
              numerator={data.mention.current.n}
              denominator={data.mention.current.d}
              delta={data.mention.previous ? { points: pointChange(data.mention.previous, data.mention.current), versus } : undefined}
              basis="API answer samples"
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Recommendation rate"
              numerator={data.recommendation.current.n}
              denominator={data.recommendation.current.d}
              delta={data.recommendation.previous ? { points: pointChange(data.recommendation.previous, data.recommendation.current), versus } : undefined}
            />
          </MetricCell>
          <MetricCell>
            <Metric
              label="Owned citation rate"
              numerator={data.citation.current?.n}
              denominator={data.citation.current?.d}
              unit="responses with citation data"
              naReason={data.citation.current ? undefined : "No provider returned citation data"}
              delta={data.citation.current && data.citation.previous ? { points: pointChange(data.citation.previous, data.citation.current), versus } : undefined}
            />
          </MetricCell>
        </MetricStrip>
      </ReportSection>

      <ReportSection id="providers" number={3} title="By provider" subtitle="Mention rate by provider API, model and search mode">
        {providerRows.length > 0 ? <BarCompare rows={providerRows} baselineLabel="Prev" currentLabel="This" /> : <p className="text-[13px] text-fg-muted">No previous run to compare with.</p>}
      </ReportSection>

      <ReportSection id="events" number={4} title="Events" subtitle={data.previousRunId ? `Changes on matching slots since ${data.previousRunId}` : undefined}>
        {data.previousRunId ? (
          <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {counts.map((c) => (
                <li key={c.kind} className="flex flex-col gap-1 rounded-control border border-line px-3 py-2">
                  <span className="text-xs text-fg-subtle">{eventMeta[c.kind].label}</span>
                  <span className="tnum text-lg font-semibold text-fg">{c.count}</span>
                </li>
              ))}
            </ul>
            {data.events.length === 0 ? (
              <p className="text-[13px] text-fg-muted">No change on matching slots.</p>
            ) : (
              <ul className="divide-y divide-line rounded-control border border-line">
                {data.events.slice(0, 10).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="max-w-lg truncate text-[13px] text-fg" title={e.promptText}>{e.promptText}</p>
                      <p className="truncate text-xs text-fg-subtle">{e.channelLabel}</p>
                    </div>
                    <Badge tone={eventMeta[e.kind].tone} icon={eventMeta[e.kind].icon}>{eventMeta[e.kind].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {data.events.length > 10 ? <p className="tnum text-xs text-fg-subtle">Showing 10 of {data.events.length} events.</p> : null}
          </>
        ) : (
          <p className="text-[13px] text-fg-muted">Events need a previous run.</p>
        )}
      </ReportSection>

      <ReportSection id="alerts" number={5} title="Alerts">
        {data.alerts.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No alerts were raised by this run.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {data.alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="max-w-lg text-[13px] text-fg">{a.title}</p>
                  <p className="text-xs text-fg-subtle">{formatRelative(a.at)} · <Link href={`/stores/${storeId}/monitoring/alerts`} className="text-accent-text hover:underline">Open alerts</Link></p>
                </div>
                <Badge tone={severityTone[a.severity as keyof typeof severityTone]} className="capitalize">{a.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="usage" number={6} title="Usage">
        <MetricStrip columns={4}>
          <MetricCell><Metric label="Requests" value={formatNumber(data.usage.requests)} basis="provider calls" /></MetricCell>
          <MetricCell><Metric label="Tokens in / out" value={`${formatNumber(data.usage.inputTokens)} / ${formatNumber(data.usage.outputTokens)}`} basis="all requests" /></MetricCell>
          <MetricCell><Metric label="Search calls" value={formatNumber(data.usage.searchCalls)} basis="tool calls" /></MetricCell>
          <MetricCell><Metric label="Cost" value={formatCurrency(data.usage.costUsd)} basis="estimate, USD" /></MetricCell>
        </MetricStrip>
        {data.failedByClass.length > 0 ? (
          <p className="tnum text-xs text-fg-subtle">Failed requests: {data.failedByClass.map((f) => `${humanize(f.cls)} ${f.count}`).join(" · ")}</p>
        ) : null}
      </ReportSection>

      <ReportSection id="limitations" number={7} title="Limitations">
        <Limitations items={limitations} />
      </ReportSection>

      <ReportSection id="sources" number={8} title="Sources and versions">
        <SourceLinks sources={sources} />
        <KeyValue
          columns={2}
          items={[
            { label: "Report version", value: report.version },
            { label: "Generated", value: <span className="tnum">{formatDateTime(report.createdAt)} UTC</span> },
          ]}
        />
      </ReportSection>
    </ReportFrame>
  );
}
