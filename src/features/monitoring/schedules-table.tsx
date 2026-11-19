"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { STATUS } from "@/lib/status";
import type { ScheduleRow, ScheduleStatus } from "@/types/monitoring";

import { formatUsd } from "./labels";
import { RunNowDialog, type RunNowTarget } from "./run-now-dialog";
import { When } from "./when";

export function runTargetOf(row: ScheduleRow): RunNowTarget {
  return {
    id: row.id,
    name: row.name,
    jobsPerRun: row.jobsPerRun,
    windowMinutes: row.config.windowMinutes,
    maxConcurrency: row.config.maxConcurrency,
    usageCap: `${row.config.usageCap.jobsPerMonth} jobs / month · ${formatUsd(row.config.usageCap.costUsd)} estimate`,
  };
}

/** Menu entries shared by the schedules table and the schedule detail header. */
export function scheduleMenuItems(args: {
  storeId: string;
  row: ScheduleRow;
  status: ScheduleStatus;
  onToggle: () => void;
  onRunNow: () => void;
  onCancel: () => void;
  includeDetail?: boolean;
}): MenuItem[] {
  const { storeId, row, status, onToggle, onRunNow, onCancel, includeDetail = true } = args;
  const base = `/stores/${storeId}/monitoring/schedules/${row.id}`;
  const cancelled = status === "cancelled";
  const items: MenuItem[] = [];
  if (includeDetail) items.push({ label: "View details", icon: "eye", href: base });
  items.push({ label: "Edit", icon: "pencil", href: `${base}/edit`, disabled: cancelled || !row.editable, disabledReason: cancelled ? "Cancelled schedules cannot be edited" : "The prompt library for this store is not part of the demo" });
  items.push(
    status === "paused"
      ? { label: "Resume", icon: "play", onSelect: onToggle }
      : { label: "Pause", icon: "pause", onSelect: onToggle, disabled: cancelled, disabledReason: "Schedule is cancelled" },
  );
  items.push({ label: "Run now", icon: "bolt", onSelect: onRunNow, disabled: cancelled, disabledReason: "Schedule is cancelled" });
  items.push({ type: "separator" });
  items.push({ label: "Cancel schedule", icon: "x-circle", tone: "danger", onSelect: onCancel, disabled: cancelled, disabledReason: "Already cancelled" });
  return items;
}

export function CancelScheduleDialog({ name, open, onClose, onConfirm }: { name: string; open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={onConfirm} title="Cancel this schedule?" confirmLabel="Cancel schedule" cancelLabel="Keep schedule">
      Stops all future runs of “{name}”. Past runs, snapshots and alerts are kept. This cannot be undone; you would create a new schedule instead.
    </ConfirmDialog>
  );
}

export function SchedulesTable({ storeId, rows, canSchedule, storeTimezone }: { storeId: string; rows: ScheduleRow[]; canSchedule: boolean; storeTimezone: string }) {
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, ScheduleStatus>>({});
  const [runTarget, setRunTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const statusOf = (row: ScheduleRow): ScheduleStatus => overrides[row.id] ?? row.status;
  const base = `/stores/${storeId}/monitoring`;
  const targets = useMemo(() => rows.map(runTargetOf), [rows]);
  const cancelRow = rows.find((r) => r.id === cancelTarget);

  const toggle = (row: ScheduleRow) => {
    const next: ScheduleStatus = statusOf(row) === "paused" ? "active" : "paused";
    setOverrides((current) => ({ ...current, [row.id]: next }));
    toast.push({ title: next === "paused" ? "Schedule paused" : "Schedule resumed", description: next === "paused" ? `${row.name}: no runs until resumed. (Demo)` : `${row.name}: next run follows the timetable. (Demo)`, tone: "success" });
  };

  const columns: Column<ScheduleRow>[] = [
    {
      id: "name",
      header: "Schedule",
      sort: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`${base}/schedules/${r.id}`} className="block max-w-72 truncate text-[13px] font-medium text-fg hover:text-accent-text hover:underline">{r.name}</Link>
          <p className="text-xs text-fg-subtle">v{r.currentVersion} · {r.id}</p>
        </div>
      ),
    },
    {
      id: "frequency",
      header: "Frequency",
      hideBelow: "md",
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap text-[13px] text-fg">{r.frequencyLabel}</p>
          <p className="text-xs text-fg-subtle">{r.timezone}</p>
        </div>
      ),
    },
    {
      id: "scope",
      header: "Prompts × providers",
      hideBelow: "lg",
      cell: (r) => (
        <div>
          <p className="tnum whitespace-nowrap text-[13px] text-fg">
            {r.activePromptCount} × {r.channels.length}
            {r.activePromptCount !== r.promptCount ? <span className="text-fg-subtle"> ({r.promptCount - r.activePromptCount} skipped)</span> : null}
          </p>
          <p className="text-xs text-fg-subtle">{r.channels.map((c) => c.providerLabel).join(", ")} · {r.samples} sample{r.samples === 1 ? "" : "s"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sort: (r) => statusOf(r),
      cell: (r) => {
        const status = statusOf(r);
        const reason = overrides[r.id] ? null : r.statusReason;
        return (
          <div className="flex flex-col items-start gap-1">
            <Status kind="schedule" value={status} />
            {reason && status === "needs_attention" ? (
              <Tooltip content={reason}><span className="inline-flex cursor-help items-center gap-1 text-xs text-fg-subtle" tabIndex={0}>Why?</span></Tooltip>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "next",
      header: "Next run",
      sort: (r) => (statusOf(r) === "paused" || statusOf(r) === "cancelled" ? null : (r.nextRunAt ?? null)),
      hideBelow: "sm",
      cell: (r) => (statusOf(r) === "paused" || statusOf(r) === "cancelled" ? <span className="text-xs text-fg-subtle">{statusOf(r) === "paused" ? "Paused" : "Cancelled"}</span> : <When iso={r.nextRunAt} tz={storeTimezone} />),
    },
    {
      id: "usage",
      header: "Est. usage",
      sort: (r) => r.jobsPerMonth,
      hideBelow: "xl",
      cell: (r) => (
        <div>
          <p className="tnum whitespace-nowrap text-[13px] text-fg">{r.jobsPerRun} jobs / run</p>
          <p className="tnum whitespace-nowrap text-xs text-fg-subtle">~{r.jobsPerMonth} / mo · ~{formatUsd(r.costPerMonthUsd)} estimate</p>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => (
        <Menu
          trigger={<IconButton icon="more" label={`Actions for ${r.name}`} size="sm" />}
          items={scheduleMenuItems({ storeId, row: r, status: statusOf(r), onToggle: () => toggle(r), onRunNow: () => setRunTarget(r.id), onCancel: () => setCancelTarget(r.id) })}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        label="Monitoring schedules"
        data={rows}
        rowKey={(r) => r.id}
        columns={columns}
        searchable={{ placeholder: "Search schedules", text: (r) => `${r.name} ${r.id} ${r.timezone}` }}
        filters={[
          {
            id: "status",
            label: "Status",
            options: Object.entries(STATUS.schedule).map(([value, meta]) => ({ value, label: meta.label })),
            value: (r) => statusOf(r),
          },
        ]}
        empty={<EmptyState icon="monitoring" title="No schedules" action={canSchedule ? <ButtonLink href={`${base}/schedules/new`} variant="primary" icon="plus">New schedule</ButtonLink> : undefined} />}
      />
      <RunNowDialog open={runTarget !== null} onClose={() => setRunTarget(null)} schedules={targets} scheduleId={runTarget ?? undefined} />
      <CancelScheduleDialog
        name={cancelRow?.name ?? ""}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelRow) {
            setOverrides((current) => ({ ...current, [cancelRow.id]: "cancelled" }));
            toast.push({ title: "Schedule cancelled", description: `${cancelRow.name}: future runs removed; past runs kept. (Demo)`, tone: "success" });
          }
          setCancelTarget(null);
        }}
      />
    </>
  );
}
