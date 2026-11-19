"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { STATUS, statusMeta } from "@/lib/status";
import type { Role } from "@/types/core";
import type { TaskStatus, TaskSummary } from "@/types/fixes";

import { APPROVER_REASON, canApprove, dueInfo, MODE_LABEL, Person } from "./fixes-shared";
import { allowedMoves, needsApprover } from "./transitions";

type Column3 = { id: string; label: string; statuses: TaskStatus[] };

const BOARD_COLUMNS: Column3[] = [
  { id: "suggested", label: "Suggested & approval", statuses: ["suggested", "pending_approval"] },
  { id: "active", label: "Approved & active", statuses: ["approved", "queued", "in_progress", "blocked"] },
  { id: "draft", label: "Draft & staged", statuses: ["draft_ready", "staged"] },
  { id: "live", label: "Applied & published", statuses: ["applied", "published"] },
  { id: "verify", label: "Verification pending", statuses: ["verification_pending"] },
  { id: "done", label: "Done", statuses: ["verified_success", "partially_verified", "failed", "rolled_back", "rejected", "superseded"] },
];

const PRIORITY_ORDER = Object.keys(STATUS.priority);
const RISK_ORDER = Object.keys(STATUS.risk);

const moveLabel = (target: TaskStatus, status: TaskStatus): string => {
  if (target === "applied") return status === "in_progress" || status === "draft_ready" ? "Mark applied" : "Move to Applied";
  if (target === "approved") return "Approve";
  if (target === "rejected") return "Reject or cancel";
  return `Move to ${statusMeta("task", target).label}`;
};

type ViewMode = "board" | "list";

/** Task board / list. Cards move between allowed statuses through a menu (no drag-only interaction). */
export function TaskBoard({ storeId, tasks, role }: { storeId: string; tasks: TaskSummary[]; role: Role }) {
  const toast = useToast();
  const [view, setView] = useState<ViewMode>("board");
  const [statuses, setStatuses] = useState<Record<string, TaskStatus>>({});

  const rows = useMemo(() => tasks.map((t) => ({ ...t, status: statuses[t.id] ?? t.status })), [tasks, statuses]);
  const base = `/stores/${storeId}/fixes`;

  const move = (task: TaskSummary, target: TaskStatus) => {
    setStatuses((current) => ({ ...current, [task.id]: target }));
    toast.push({
      title: `${task.id} moved to ${statusMeta("task", target).label}`,
      description: target === "applied" || target === "published" ? "Applied and published are not verified. Demo action, not saved." : "Demo action, not saved.",
    });
  };

  const menuItems = (task: TaskSummary): MenuItem[] => {
    const moves = allowedMoves(task.status, task.mode);
    const items: MenuItem[] = [];
    if (moves.length > 0) {
      items.push({ type: "label", label: "Move to" });
      for (const target of moves) {
        const blocked = needsApprover(target) && !canApprove(role);
        items.push({
          label: moveLabel(target, task.status),
          icon: statusMeta("task", target).icon,
          disabled: blocked,
          disabledReason: APPROVER_REASON,
          onSelect: () => move(task, target),
        });
      }
    }
    return items;
  };

  /** Row / card menu. Opening the task is the title link, so only moves live here. */
  const moveMenu = (task: TaskSummary, className?: string) => {
    const items = menuItems(task);
    if (items.length === 0) return null;
    return <Menu trigger={<IconButton icon="more" label={`Move ${task.id}`} size="sm" className={className} />} items={items} />;
  };

  const filters: TableFilter<TaskSummary>[] = [
    { id: "status", label: "Status", options: Object.entries(STATUS.task).map(([value, m]) => ({ value, label: m.label })), value: (r) => r.status },
    {
      id: "assignee",
      label: "Assignee",
      options: [...new Set(tasks.map((t) => t.assignee ?? "Unassigned"))].map((name) => ({ value: name, label: name })),
      value: (r) => r.assignee ?? "Unassigned",
    },
    { id: "priority", label: "Priority", options: Object.entries(STATUS.priority).map(([value, m]) => ({ value, label: m.label })), value: (r) => r.priority },
    { id: "risk", label: "Risk", options: Object.entries(STATUS.risk).map(([value, m]) => ({ value, label: m.label })), value: (r) => r.risk },
  ];

  const columns: Column<TaskSummary>[] = [
    {
      id: "title",
      header: "Task",
      sort: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-[26rem]">
          <Link href={`${base}/tasks/${r.id}`} className="line-clamp-2 font-medium text-fg hover:text-accent-text hover:underline">
            {r.title}
          </Link>
          <p className="tnum mt-0.5 text-xs text-fg-subtle">{r.id}</p>
        </div>
      ),
    },
    { id: "status", header: "Status", sort: (r) => Object.keys(STATUS.task).indexOf(r.status), cell: (r) => <Status kind="task" value={r.status} /> },
    { id: "assignee", header: "Assignee", hideBelow: "md", sort: (r) => r.assignee ?? "~", cell: (r) => <Person name={r.assignee} /> },
    {
      id: "due",
      header: "Due",
      hideBelow: "lg",
      sort: (r) => r.dueAt,
      cell: (r) => {
        const due = dueInfo(r.dueAt, r.status);
        return <span className={cn("tnum whitespace-nowrap", due.overdue ? "font-medium text-danger" : "text-fg-muted")}>{due.overdue ? `${due.text} · overdue` : due.text}</span>;
      },
    },
    { id: "priority", header: "Priority", sort: (r) => PRIORITY_ORDER.indexOf(r.priority), cell: (r) => <Status kind="priority" value={r.priority} /> },
    { id: "risk", header: "Risk", hideBelow: "md", sort: (r) => RISK_ORDER.indexOf(r.risk), cell: (r) => <Status kind="risk" value={r.risk} /> },
    { id: "mode", header: "Mode", hideBelow: "xl", cell: (r) => <span className="whitespace-nowrap text-fg-muted">{MODE_LABEL[r.mode]}</span> },
    {
      id: "finding",
      header: "Finding",
      hideBelow: "xl",
      cell: (r) => (
        <Link href={`${base}/findings/${r.findingId}`} className="tnum text-accent-text hover:underline">
          {r.findingId}
        </Link>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => moveMenu(r),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Segmented
          label="Task view"
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: "Board", icon: "columns" },
            { value: "list", label: "List", icon: "list" },
          ]}
        />
      </div>

      {view === "board" ? (
        <div className="ui-scroll -mx-1 overflow-x-auto px-1 pb-2">
          <div className="grid grid-flow-col auto-cols-[minmax(17rem,1fr)] gap-3">
            {BOARD_COLUMNS.map((column) => {
              const items = rows.filter((t) => column.statuses.includes(t.status));
              const headingId = `col-${column.id}`;
              return (
                <section key={column.id} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface-2/50 p-2">
                  <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
                    <h2 id={headingId} className="truncate text-[13px] font-semibold text-fg">{column.label}</h2>
                    <span className="tnum rounded-full bg-surface px-1.5 text-[11px] text-fg-muted">{items.length}</span>
                  </header>
                  {items.length === 0 ? (
                    <p className="rounded-control border border-dashed border-line-strong px-3 py-6 text-center text-xs text-fg-subtle">No tasks</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {items.map((task) => {
                        const due = dueInfo(task.dueAt, task.status);
                        return (
                          <li key={task.id}>
                            <article className="flex flex-col gap-2.5 rounded-control border border-line bg-surface p-3 shadow-card">
                              <div className="flex items-start justify-between gap-2">
                                <h3 className="min-w-0 text-[13px] font-medium leading-snug text-fg">
                                  <Link href={`${base}/tasks/${task.id}`} className="line-clamp-3 hover:text-accent-text hover:underline">
                                    {task.title}
                                  </Link>
                                </h3>
                                {moveMenu(task, "-mr-1.5 -mt-1.5 shrink-0")}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {column.statuses.length > 1 ? <Status kind="task" value={task.status} /> : null}
                                <Status kind="priority" value={task.priority} />
                                <Status kind="risk" value={task.risk} />
                              </div>
                              {task.blockers.length > 0 ? (
                                <p className="flex items-start gap-1.5 text-xs text-warning">
                                  <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
                                  <span className="min-w-0">{task.blockers[0]}</span>
                                </p>
                              ) : null}
                              <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
                                <span className="min-w-0 text-[13px]"><Person name={task.assignee} muted /></span>
                                <span className={cn("tnum flex shrink-0 items-center gap-1", due.overdue ? "font-medium text-danger" : "text-fg-subtle")}>
                                  <Icon name="calendar" size={13} />
                                  {due.text}
                                </span>
                              </div>
                            </article>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <DataTable
          label="Fix tasks"
          data={rows}
          rowKey={(r) => r.id}
          columns={columns}
          filters={filters}
          searchable={{ placeholder: "Search tasks", text: (r) => `${r.title} ${r.id} ${r.findingId} ${r.assignee ?? ""}` }}
          defaultSort={{ column: "priority", dir: "asc" }}
          pageSize={10}
        />
      )}
    </div>
  );
}
