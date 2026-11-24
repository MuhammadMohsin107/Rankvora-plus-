"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { STATUS } from "@/lib/status";
import type { ScheduleRec } from "@/types/monitoring";

import { NoSchedules } from "./no-schedules";
import { useMonitoring, type MonitoringApi } from "./state";
import { When } from "./when";

type MenuArgs = {
  row: ScheduleRec;
  api: MonitoringApi;
  onCancel: () => void;
  onDuplicated: (id: string) => void;
  /** Only the entries that are not already buttons (schedule header). */
  secondaryOnly?: boolean;
};

/** Menu entries shared by the schedules table and the schedule detail header. All of them change the shared state. */
export function scheduleMenuItems({ row, api, onCancel, onDuplicated, secondaryOnly = false }: MenuArgs): MenuItem[] {
  const base = `${api.base}/schedules/${row.id}`;
  const cancelled = row.status === "cancelled";
  const draft = row.status === "draft";
  const duplicate: MenuItem = {
    label: "Duplicate",
    icon: "copy",
    onSelect: () => {
      const copy = api.duplicateSchedule(row.id);
      if (copy) onDuplicated(copy.id);
    },
  };
  const cancel: MenuItem = { label: "Cancel schedule", icon: "x-circle", tone: "danger", onSelect: onCancel, disabled: cancelled, disabledReason: "Already cancelled" };
  if (secondaryOnly) return [duplicate, { type: "separator" }, cancel];
  const stateItem: MenuItem = draft
    ? { label: "Activate", icon: "play", onSelect: () => api.activateSchedule(row.id) }
    : row.status === "paused"
      ? { label: "Resume", icon: "play", onSelect: () => api.resumeSchedule(row.id) }
      : { label: "Pause", icon: "pause", onSelect: () => api.pauseSchedule(row.id), disabled: cancelled, disabledReason: "Schedule is cancelled" };
  return [
    { label: "Edit", icon: "pencil", href: `${base}/edit`, disabled: cancelled, disabledReason: "Cancelled schedules cannot be edited" },
    stateItem,
    { label: "Run now", icon: "bolt", onSelect: () => api.openRunNow({ scheduleId: row.id }), disabled: cancelled || draft, disabledReason: draft ? "Activate the schedule first" : "Schedule is cancelled" },
    duplicate,
    { type: "separator" },
    cancel,
  ];
}

export function CancelScheduleDialog({ name, open, onClose, onConfirm }: { name: string; open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog open={open} onClose={onClose} onConfirm={onConfirm} title="Cancel this schedule?" confirmLabel="Cancel schedule" cancelLabel="Keep schedule">
      Stops all future runs of “{name}”. Past runs, snapshots and alerts are kept. To run it again, create a new schedule.
    </ConfirmDialog>
  );
}

export function SchedulesTable() {
  const api = useMonitoring();
  const router = useRouter();
  const { schedules, base, data } = api;
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const cancelRow = schedules.find((r) => r.id === cancelTarget);

  if (schedules.length === 0) return <NoSchedules />;

  const columns: Column<ScheduleRec>[] = [
    {
      id: "name",
      header: "Schedule",
      sort: (r) => r.name,
      cell: (r) => <Link href={`${base}/schedules/${r.id}`} className="block max-w-72 truncate text-body-sm font-medium leading-target text-fg hover:text-accent-text hover:underline">{r.name}</Link>,
    },
    { id: "frequency", header: "Frequency", hideBelow: "md", cell: (r) => <span className="whitespace-nowrap text-body-sm text-fg">{r.frequencyLabel}</span> },
    {
      id: "scope",
      header: "Covers",
      hideBelow: "lg",
      cell: (r) => (
        <span className="tnum whitespace-nowrap text-body-sm text-fg">
          {r.activePromptCount} prompts × {r.channels.length} providers
          {r.activePromptCount !== r.promptCount ? <span className="text-fg-muted"> ({r.promptCount - r.activePromptCount} skipped)</span> : null}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sort: (r) => r.status,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Status kind="schedule" value={r.status} />
          {r.statusReason && r.status === "needs_attention" ? (
            <Tooltip content={r.statusReason}><span className="inline-flex cursor-help text-helper text-fg-muted" tabIndex={0}>Why?</span></Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      id: "next",
      header: "Next run",
      sort: (r) => (r.status === "active" || r.status === "needs_attention" ? (r.nextRunAt ?? null) : null),
      hideBelow: "sm",
      cell: (r) => (r.status === "active" || r.status === "needs_attention" ? <When iso={r.nextRunAt} tz={data.timezone} /> : <span className="text-fg-subtle">—</span>),
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
          items={scheduleMenuItems({ row: r, api, onCancel: () => setCancelTarget(r.id), onDuplicated: (id) => router.push(`${base}/schedules/${id}/edit`) })}
        />
      ),
    },
  ];

  return (
    <>
      <DataTable
        label="Monitoring schedules"
        data={schedules}
        rowKey={(r) => r.id}
        columns={columns}
        mobileCards
        searchable={{ placeholder: "Search schedules", text: (r) => `${r.name} ${r.timezone}` }}
        filters={[{ id: "status", label: "Status", options: Object.entries(STATUS.schedule).filter(([value]) => value !== "validating").map(([value, meta]) => ({ value, label: meta.label })), value: (r) => r.status }]}
        empty={<EmptyState icon="monitoring" title="No schedules" />}
      />
      <CancelScheduleDialog
        name={cancelRow?.name ?? ""}
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelRow) api.cancelSchedule(cancelRow.id);
          setCancelTarget(null);
        }}
      />
    </>
  );
}
