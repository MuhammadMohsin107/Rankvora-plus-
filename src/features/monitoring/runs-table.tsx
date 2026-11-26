"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { SimulatedBadge } from "@/components/ui/demo";
import { DateRange, makeRange, type DateRangeValue } from "@/components/ui/date-range";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { DEMO_NOW, formatDuration } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { RunRec, RunSummary } from "@/types/monitoring";

import { formatUsd } from "./labels";
import { isActiveRun } from "./run-sim";
import { useMonitoring } from "./state";
import { NoSchedules } from "./no-schedules";
import { HistorySwitch } from "./monitoring-header";
import { When } from "./when";

const ANCHOR = DEMO_NOW.slice(0, 10);
const isSim = (r: RunSummary): r is RunRec => (r as RunRec).simulated === true;

/** Runs of the website, or the runs passed in (a schedule's recent runs). Filters: schedule, provider, prompt, status, version, date. */
export function RunsTable({ runs: given, compact }: { runs?: RunSummary[]; compact?: boolean }) {
  const { runs: all, schedules: allSchedules, base, data, prompts } = useMonitoring();
  const runs = given ?? all;
  const [range, setRange] = useState<DateRangeValue>(() => makeRange("90d", ANCHOR));

  const inRange = useMemo(() => {
    if (compact) return runs;
    // Rolling presets mean "up to now", so a run created today is never hidden by the end date.
    return runs.filter((r) => {
      const day = r.scheduledFor.slice(0, 10);
      return day >= range.from && (range.preset !== "custom" || day <= range.to);
    });
  }, [runs, range, compact]);

  const schedules = [...new Map(runs.map((r) => [r.scheduleId, r.scheduleName])).entries()];
  const providerLabel = (id: string) => data.ctx?.channels.find((c) => c.id === id)?.providerLabel ?? id;
  const channelIds = [...new Set(runs.flatMap((r) => r.channelIds ?? []))];
  const promptIds = [...new Set(runs.flatMap((r) => r.promptIds ?? []))];
  const promptText = (id: string) => prompts.find((p) => p.id === id)?.text ?? id;
  const versions = [...new Set(runs.map((r) => r.scheduleVersion))].sort((a, b) => a - b);

  const columns: Column<RunSummary>[] = [
    {
      id: "id",
      header: "Run",
      sort: (r) => r.id,
      cell: (r) => (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Link href={`${base}/runs/${r.id}`} className="text-body-sm font-medium text-accent-text hover:underline">{r.id}</Link>
          {isSim(r) ? <SimulatedBadge /> : r.trigger === "manual" ? <span className="text-helper text-fg-muted">Manual</span> : null}
        </div>
      ),
    },
    ...(compact
      ? []
      : [
          {
            id: "schedule",
            header: "Schedule",
            hideBelow: "lg" as const,
            sort: (r: RunSummary) => r.scheduleName,
            cell: (r: RunSummary) => (
              <span className="block max-w-56 truncate text-body-sm text-fg">
                <Link href={`${base}/schedules/${r.scheduleId}`} className="hover:underline">{r.scheduleName}</Link>
                <span className="text-fg-muted"> · v{r.scheduleVersion}</span>
              </span>
            ),
          },
        ]),
    { id: "when", header: "Scheduled for", hideBelow: "sm", sort: (r) => r.scheduledFor, cell: (r) => <When iso={r.scheduledFor} tz={data.timezone} /> },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Status kind="run" value={r.status} /> },
    {
      id: "jobs",
      header: "Jobs ok / planned",
      sort: (r) => r.succeeded / Math.max(1, r.planned),
      cell: (r) => (
        <div className="flex min-w-28 flex-col gap-1">
          {isActiveRun(r.status) && isSim(r) ? (
            <>
              <span className="tnum text-body-sm text-fg">{r.doneJobs} / {r.planned} done</span>
              <Progress value={r.doneJobs} max={r.planned} label={`${r.id} progress`} />
            </>
          ) : (
            <>
              <span className="tnum text-body-sm text-fg">{r.succeeded} / {r.planned}</span>
              <Progress value={r.succeeded} max={r.planned} label={`${r.id} jobs succeeded`} tone={r.failed > 0 ? "warning" : "success"} />
            </>
          )}
        </div>
      ),
    },
    { id: "duration", header: "Duration", hideBelow: "lg", sort: (r) => r.durationSeconds, cell: (r) => <span className="tnum whitespace-nowrap text-body-sm text-fg">{r.durationSeconds === null ? "—" : formatDuration(r.durationSeconds)}</span> },
    { id: "cost", header: "Cost (est.)", align: "right", hideBelow: "xl", sort: (r) => r.costUsd, cell: (r) => <span className="tnum whitespace-nowrap text-body-sm text-fg">{formatUsd(r.costUsd)}</span> },
  ];

  if (!compact && !given && allSchedules.length === 0) return <NoSchedules />;

  return (
    <div className="flex flex-col gap-3">
      {compact ? null : <HistorySwitch current="runs" />}
      <DataTable
        label="Monitoring runs"
        data={inRange}
        rowKey={(r) => r.id}
        columns={columns}
        pageSize={compact ? 5 : 10}
        dense={compact}
        mobileCards={!compact}
        searchable={compact ? undefined : { placeholder: "Search runs", text: (r) => `${r.id} ${r.scheduleName}` }}
        filters={
          compact
            ? undefined
            : [
                { id: "status", label: "Status", options: Object.entries(STATUS.run).map(([value, meta]) => ({ value, label: meta.label })), value: (r) => r.status },
                ...(schedules.length > 1 ? [{ id: "schedule", label: "Schedule", options: schedules.map(([value, label]) => ({ value, label })), value: (r: RunSummary) => r.scheduleId }] : []),
                { id: "provider", label: "Provider", options: channelIds.map((value) => ({ value, label: providerLabel(value) })), value: (r) => r.channelIds ?? [] },
                { id: "prompt", label: "Prompt", options: promptIds.map((value) => ({ value, label: promptText(value).slice(0, 48) })), value: (r) => r.promptIds ?? [] },
                ...(versions.length > 1 ? [{ id: "version", label: "Version", options: versions.map((v) => ({ value: String(v), label: `v${v}` })), value: (r: RunSummary) => String(r.scheduleVersion) }] : []),
              ]
        }
        toolbarExtra={compact ? undefined : <DateRange value={range} onChange={setRange} anchorDate={ANCHOR} presets={["7d", "30d", "90d"]} align="end" />}
        empty={<EmptyState icon="history" title="No runs yet" />}
      />
    </div>
  );
}
