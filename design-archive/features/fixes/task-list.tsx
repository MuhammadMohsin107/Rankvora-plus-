"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { DEMO_NOW } from "@/lib/format";
import { STATUS, statusMeta } from "@/lib/status";
import type { Role } from "@/types/core";
import type { FindingRow, TaskRow, TaskStatus, TaskSummary } from "@/types/fixes";

import { ReasonDialog, REASONS, SupersedeDialog } from "./fix-dialogs";
import { allowedMoves, isTaskOpen, needsApprover } from "./fixes-logic";
import { APPROVER_REASON, canApprove, CATEGORY_LABEL, dueInfo, MODE_LABEL } from "./fixes-shared";
import { ListToolbar, type FilterDef } from "./list-toolbar";
import { useFixData } from "./use-fix-data";

const PRIORITY_ORDER = Object.keys(STATUS.priority);
const RISK_ORDER = Object.keys(STATUS.risk);
const WEEK = 7 * 24 * 3600 * 1000;
/** Steps that write to the website. Only the Execution tab records them for connector-backed tasks. */
const EXTERNAL_WRITE_STEPS: ReadonlySet<TaskStatus> = new Set(["staged", "applied", "published"]);

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
  if (values.due && !dueMatches(task, values.due)) return false;
  if (values.risk && task.risk !== values.risk) return false;
  if (values.category && task.category !== values.category) return false;
  if (values.finding && task.findingId !== values.finding) return false;
  if (values.priority && task.priority !== values.priority) return false;
  if (values.dependencies && (values.dependencies === "unmet") !== task.openDependencies > 0) return false;
  if (values.blockers && (values.blockers === "yes") !== task.blockers.length > 0) return false;
  return true;
}

type Props = { storeId: string; tasks: TaskSummary[]; findings: FindingRow[]; role: Role; actorName: string };
type Pending = { task: TaskRow; target: "rejected" | "cancelled" | "rolled_back" | "superseded" } | null;

/** The tasks list. A row's menu moves it between allowed statuses; every move is saved locally with an event. */
export function TaskList({ storeId, tasks: baseTasks, findings, role, actorName }: Props) {
  const fix = useFixData(storeId, baseTasks, findings, actorName);
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending>(null);
  const base = `/stores/${storeId}/fixes`;
  const rows = fix.tasks;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((t) => matches(t, values) && (!needle || `${t.title} ${t.id} ${t.findingId}`.toLowerCase().includes(needle)));
  }, [rows, values, query]);

  const primary: FilterDef[] = [
    { id: "status", label: "Status", options: options(STATUS.task) },
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
    // Writes to the website (stage, apply, publish) are recorded in the task's Execution tab, which checks approval and the connector.
    const moves = allowedMoves(task.status, task.mode).filter((target) => !EXTERNAL_WRITE_STEPS.has(target) || task.mode === "guidance" || task.mode === "ai_draft");
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
      />

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
