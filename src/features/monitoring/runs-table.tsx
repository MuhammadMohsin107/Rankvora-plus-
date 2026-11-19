"use client";

import Link from "next/link";

import { Status } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Mono } from "@/components/ui/misc";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDuration } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { RunSummary } from "@/types/monitoring";

import { formatUsd } from "./labels";
import { When } from "./when";

export function RunsTable({ storeId, runs, storeTimezone, compact }: { storeId: string; runs: RunSummary[]; storeTimezone: string; compact?: boolean }) {
  const base = `/stores/${storeId}/monitoring`;
  const schedules = [...new Map(runs.map((r) => [r.scheduleId, r.scheduleName])).entries()];

  const columns: Column<RunSummary>[] = [
    {
      id: "id",
      header: "Run",
      sort: (r) => r.scheduledFor,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`${base}/runs/${r.id}`} className="text-[13px] font-medium text-accent-text hover:underline">{r.id}</Link>
          {r.trigger === "manual" ? <p className="text-xs text-fg-subtle">Manual</p> : null}
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
              <div className="min-w-0">
                <Link href={`${base}/schedules/${r.scheduleId}`} className="block max-w-56 truncate text-[13px] text-fg hover:underline">{r.scheduleName}</Link>
                <p className="text-xs text-fg-subtle">v{r.scheduleVersion}</p>
              </div>
            ),
          },
        ]),
    { id: "when", header: "Scheduled for", hideBelow: "sm", sort: (r) => r.scheduledFor, cell: (r) => <When iso={r.scheduledFor} tz={storeTimezone} /> },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Status kind="run" value={r.status} /> },
    {
      id: "jobs",
      header: "Jobs ok / planned",
      sort: (r) => r.succeeded / Math.max(1, r.planned),
      cell: (r) => (
        <div className="flex min-w-28 flex-col gap-1">
          <span className="tnum text-[13px] text-fg">{r.succeeded} / {r.planned}</span>
          <Progress value={r.succeeded} max={r.planned} label={`${r.id} jobs succeeded`} tone={r.failed > 0 ? "warning" : "success"} />
        </div>
      ),
    },
    { id: "failed", header: "Failed", align: "right", hideBelow: "md", sort: (r) => r.failed, cell: (r) => <span className={r.failed > 0 ? "tnum text-[13px] font-medium text-danger" : "tnum text-[13px] text-fg-muted"}>{r.failed}</span> },
    {
      id: "cost",
      header: "Duration · cost",
      hideBelow: "lg",
      sort: (r) => r.costUsd,
      cell: (r) => (
        <div>
          <p className="tnum whitespace-nowrap text-[13px] text-fg">{r.durationSeconds === null ? "—" : formatDuration(r.durationSeconds)}</p>
          <p className="tnum whitespace-nowrap text-xs text-fg-subtle">{formatUsd(r.costUsd)} estimate</p>
        </div>
      ),
    },
    { id: "snapshot", header: "Snapshot", hideBelow: "xl", cell: (r) => <Mono>{r.snapshotId}</Mono> },
  ];

  return (
    <DataTable
      label="Monitoring runs"
      data={runs}
      rowKey={(r) => r.id}
      columns={columns}
      defaultSort={{ column: "id", dir: "desc" }}
      pageSize={compact ? 5 : 10}
      dense={compact}
      searchable={compact ? undefined : { placeholder: "Search runs", text: (r) => `${r.id} ${r.scheduleName} ${r.snapshotId}` }}
      filters={
        compact
          ? undefined
          : [
              { id: "status", label: "Status", options: Object.entries(STATUS.run).map(([value, meta]) => ({ value, label: meta.label })), value: (r) => r.status },
              ...(schedules.length > 1 ? [{ id: "schedule", label: "Schedule", options: schedules.map(([value, label]) => ({ value, label })), value: (r: RunSummary) => r.scheduleId }] : []),
            ]
      }
      empty={<EmptyState icon="history" title="No runs yet" description="Runs appear here after a schedule starts." />}
    />
  );
}
