"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Segmented } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { DEMO_NOW } from "@/lib/format";
import { STATUS, statusMeta } from "@/lib/status";
import type { Role } from "@/types/core";
import type { AssigneeOption, FindingRow, TaskRow, TaskStatus, TaskSummary } from "@/types/fixes";

import { ReasonDialog, REASONS, SupersedeDialog } from "./fix-dialogs";
import { allowedMoves, isTaskOpen, needsApprover } from "./fixes-logic";
import { APPROVER_REASON, canApprove, CATEGORY_LABEL, dueInfo, MODE_LABEL, Person } from "./fixes-shared";
import { ListToolbar, type FilterDef } from "./list-toolbar";
import { useFixData } from "./use-fix-data";

type BoardColumn = { id: string; label: string; statuses: TaskStatus[] };

/** Five columns grouping all 18 statuses. The status badge on a card says which one. */
const BOARD_COLUMNS: BoardColumn[] = [
  { id: "planned", label: "Planned", statuses: ["suggested", "pending_approval", "approved", "queued"] },
  { id: "work", label: "In work", statuses: ["in_progress", "blocked", "draft_ready", "staged"] },
  { id: "live", label: "Applied or published", statuses: ["applied", "published"] },
  { id: "verify", label: "Verification", statuses: ["verification_pending", "partially_verified"] },
  { id: "closed", label: "Closed", statuses: ["verified_success", "failed", "rolled_back", "rejected", "cancelled", "superseded"] },
];

const PRIORITY_ORDER = Object.keys(STATUS.priority);
const RISK_ORDER = Object.keys(STATUS.risk);
const WEEK = 7 * 24 * 3600 * 1000;

const options = (map: Record<string, { label: string }>) => Object.entries(map).map(([value, m]) => ({ value, label: m.label }));

const moveLabel = (target: TaskStatus, from: TaskStatus): string => {
  switch (target) {
    case "applied":
      return from === "in_progress" || from === "draft_ready" ? "Mark applied" : "Move to Applied";
    case "approved":
      return "Approve";
    case "rejected":
      return "Reject";
    case "cancelled":
      return "Cancel task";
    case "superseded":
      return "Replace with another task";
    case "rolled_back":
      return "Roll back";
    case "suggested":
      return "Reopen as suggested";
    default:
      return `Move to ${statusMeta("task", target).label}`;
  }
};

function dueMatches(task: TaskSummary, value: string): boolean {
  if (value === "none") return !task.dueAt;
  if (!task.dueAt) return false;
  const due = Date.parse(task.dueAt);
  const now = Date.parse(DEMO_NOW);
  if (value === "overdue") return isTaskOpen(task.status) && task.status !== "verification_pending" && due < now;
  if (value === "week") return due >= now && due <= now + WEEK;
  return true;
}

function matches(task: TaskRow, values: Record<string, string>): boolean {
  if (values.status && task.status !== values.status) return false;
  if (values.assignee && (task.assignee ?? "Unassigned") !== values.assignee) return false;
  if (values.due && !dueMatches(task, values.due)) return false;
  if (values.risk && task.risk !== values.risk) return false;
  if (values.category && task.category !== values.category) return false;
  if (values.finding && task.findingId !== values.finding) return false;
  if (values.priority && task.priority !== values.priority) return false;
  if (values.dependencies && (values.dependencies === "unmet") !== task.openDependencies > 0) return false;
  if (values.blockers && (values.blockers === "yes") !== task.blockers.length > 0) return false;
  return true;
}

type Props = { storeId: string; tasks: TaskSummary[]; findings: FindingRow[]; role: Role; assignees: AssigneeOption[]; actorName: string };
type Pending = { task: TaskRow; target: "rejected" | "cancelled" | "rolled_back" | "superseded" } | null;
type ViewMode = "board" | "list";

/** Task board / list. Cards move between allowed statuses through a menu; every move is saved locally with an event. */
export function TaskBoard({ storeId, tasks: baseTasks, findings, role, actorName }: Props) {
  const fix = useFixData(storeId, baseTasks, findings, actorName);
  const [view, setView] = useState<ViewMode>("board");
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending>(null);
  const base = `/stores/${storeId}/fixes`;
  const rows = fix.tasks;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((t) => matches(t, values) && (!needle || `${t.title} ${t.id} ${t.findingId} ${t.assignee ?? ""}`.toLowerCase().includes(needle)));
  }, [rows, values, query]);

  const primary: FilterDef[] = [
    { id: "status", label: "Status", options: options(STATUS.task) },
    { id: "assignee", label: "Assignee", options: [...new Set(rows.map((t) => t.assignee ?? "Unassigned"))].map((name) => ({ value: name, label: name })) },
    { id: "due", label: "Due", options: [{ value: "overdue", label: "Overdue" }, { value: "week", label: "Due in 7 days" }, { value: "none", label: "No due date" }] },
    { id: "risk", label: "Risk", options: options(STATUS.risk) },
  ];
  const more: FilterDef[] = [
    { id: "category", label: "Category", options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })) },
    { id: "finding", label: "Related finding", options: [...new Map(rows.map((t) => [t.findingId, t.findingTitle])).entries()].map(([value, label]) => ({ value, label: `${value} · ${label}` })) },
    { id: "priority", label: "Priority", options: options(STATUS.priority) },
    { id: "dependencies", label: "Dependencies", options: [{ value: "unmet", label: "Unmet dependencies" }, { value: "met", label: "All met" }] },
    { id: "blockers", label: "Blockers", options: [{ value: "yes", label: "Has blockers" }, { value: "no", label: "No blockers" }] },
  ];

  const select = (task: TaskRow, target: TaskStatus) => {
    if (target === "rejected" || target === "cancelled" || target === "rolled_back" || target === "superseded") setPending({ task, target });
    else fix.moveTask(task, target);
  };

  const menuItems = (task: TaskRow): MenuItem[] => {
    const moves = allowedMoves(task.status, task.mode);
    const items: MenuItem[] = [{ label: "Open task", icon: "arrow-up-right", href: `${base}/tasks/${task.id}` }];
    if (moves.length > 0) {
      items.push({ type: "separator" }, { type: "label", label: "Move to" });
      for (const target of moves) {
        items.push({
          label: moveLabel(target, task.status),
          icon: statusMeta("task", target).icon,
          disabled: needsApprover(target) && !canApprove(role),
          disabledReason: APPROVER_REASON,
          onSelect: () => select(task, target),
        });
      }
    }
    return items;
  };

  const moveMenu = (task: TaskRow, className?: string) => <Menu trigger={<IconButton icon="more" label={`Actions for ${task.id}`} size="sm" className={className} />} items={menuItems(task)} />;

  const columns: Column<TaskRow>[] = [
    {
      id: "title",
      header: "Task",
      sort: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-[26rem]">
          <Link href={`${base}/tasks/${r.id}`} className="line-clamp-2 font-medium text-fg hover:text-accent-text hover:underline">
            {r.title}
          </Link>
          <p className="tnum mt-0.5 truncate text-helper text-fg-subtle">
            {r.id} · <Link href={`${base}/findings/${r.findingId}`} className="hover:underline">{r.findingId}</Link> · {MODE_LABEL[r.mode]}
          </p>
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
        return <span className={cn("tnum whitespace-nowrap", due.overdue ? "font-medium text-danger-text" : "text-fg-muted")}>{due.overdue ? `${due.text} · overdue` : due.text}</span>;
      },
    },
    {
      id: "priority",
      header: "Priority",
      sort: (r) => PRIORITY_ORDER.indexOf(r.priority) * 10 + RISK_ORDER.indexOf(r.risk),
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Status kind="priority" value={r.priority} />
          <span className="text-helper text-fg-subtle">{STATUS.risk[r.risk].label}</span>
        </div>
      ),
    },
    { id: "actions", header: "Actions", srOnlyHeader: true, align: "right", width: "w-12", cell: (r) => moveMenu(r) },
  ];

  const clear = () => {
    setQuery("");
    setValues({});
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ListToolbar
        label="Tasks"
        query={query}
        onQuery={setQuery}
        placeholder="Search tasks"
        primary={primary}
        more={more}
        values={values}
        onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onClear={clear}
        shown={filtered.length}
        total={rows.length}
        actions={
          <Segmented
            label="Task view"
            value={view}
            onChange={setView}
            options={[
              { value: "board", label: "Board", icon: "columns" },
              { value: "list", label: "List", icon: "list" },
            ]}
          />
        }
      />

      {view === "board" ? (
        <div className="@container min-w-0 max-w-full rounded-card border border-line bg-surface p-3 shadow-card">
          <div className="ui-scroll min-w-0 overflow-x-auto">
            <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 @5xl:grid-flow-row @5xl:grid-cols-5 @5xl:auto-cols-auto">
              {BOARD_COLUMNS.map((column) => {
                const items = filtered.filter((t) => column.statuses.includes(t.status));
                const headingId = `col-${column.id}`;
                return (
                  <section key={column.id} aria-labelledby={headingId} className="flex min-w-0 flex-col gap-2 rounded-control bg-surface-2 p-2">
                    <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
                      <h2 id={headingId} className="truncate text-label font-semibold text-fg">{column.label}</h2>
                      <span className="tnum rounded-full bg-surface px-1.5 text-helper text-fg-muted">{items.length}</span>
                    </header>
                    {items.length === 0 ? (
                      <p className="rounded-control border border-dashed border-line-strong px-3 py-6 text-center text-helper text-fg-subtle">No tasks</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {items.map((task) => {
                          const due = dueInfo(task.dueAt, task.status);
                          return (
                            <li key={task.id}>
                              <article className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3 shadow-card">
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className="min-w-0 text-label font-medium leading-snug text-fg">
                                    <Link href={`${base}/tasks/${task.id}`} className="line-clamp-3 hover:text-accent-text hover:underline">
                                      {task.title}
                                    </Link>
                                  </h3>
                                  {moveMenu(task, "-mr-1.5 -mt-1.5 shrink-0")}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Status kind="task" value={task.status} />
                                  <Status kind="priority" value={task.priority} compact />
                                </div>
                                {task.blockers.length > 0 ? (
                                  <p className="flex items-start gap-1.5 text-helper text-warning-text">
                                    <Icon name="lock" size={13} className="mt-0.5 shrink-0" />
                                    <span className="min-w-0">{task.blockers[0]}</span>
                                  </p>
                                ) : null}
                                <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-helper">
                                  <span className="min-w-0"><Person name={task.assignee} muted /></span>
                                  <span className={cn("tnum flex shrink-0 items-center gap-1", due.overdue ? "font-medium text-danger-text" : "text-fg-subtle")}>
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
        </div>
      ) : (
        <DataTable
          label="Fix tasks"
          data={filtered}
          rowKey={(r) => r.id}
          columns={columns}
          rowLabel={(r) => r.title}
          defaultSort={{ column: "priority", dir: "asc" }}
          mobileCards
          pageSize={10}
        />
      )}

      <ReasonDialog
        open={pending?.target === "rejected"}
        onClose={() => setPending(null)}
        title="Reject task"
        description={pending?.task.title}
        confirmLabel="Reject"
        reasons={REASONS.reject}
        onConfirm={(reason) => {
          if (pending) fix.moveTask(pending.task, "rejected", { reason });
          setPending(null);
        }}
      />
      <ReasonDialog
        open={pending?.target === "cancelled"}
        onClose={() => setPending(null)}
        title="Cancel task"
        description={pending?.task.title}
        confirmLabel="Cancel task"
        reasons={REASONS.cancel}
        onConfirm={(reason) => {
          if (pending) fix.moveTask(pending.task, "cancelled", { reason });
          setPending(null);
        }}
      />
      <ReasonDialog
        open={pending?.target === "rolled_back"}
        onClose={() => setPending(null)}
        title="Roll back this change"
        description="Simulated: restores the version from before this task."
        confirmLabel="Roll back"
        reasons={REASONS.rollback}
        onConfirm={(reason) => {
          if (pending) fix.moveTask(pending.task, "rolled_back", { reason });
          setPending(null);
        }}
      />
      <SupersedeDialog
        open={pending?.target === "superseded"}
        onClose={() => setPending(null)}
        candidates={pending ? rows.filter((t) => t.findingId === pending.task.findingId && t.id !== pending.task.id && isTaskOpen(t.status)) : []}
        onConfirm={(successorId, reason) => {
          if (pending) fix.moveTask(pending.task, "superseded", { successorId, reason });
          setPending(null);
        }}
      />
    </div>
  );
}
