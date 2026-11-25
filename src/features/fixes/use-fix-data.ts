"use client";

/**
 * Local state for the Fixes module: tasks and findings from the demo-state overlay, and every action that changes them.
 * Each action changes local state, emits an evidence event (task / finding / website ids) and shows a "(simulated)" toast.
 * Nothing leaves the browser.
 */
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useToast } from "@/components/ui/toast";
import { demoNow, demoStore, simulatedToast, useDemoCollection, type DemoEventInput, type DemoEventKind, type DemoEventRefs, type SimulatedTone } from "@/demo-state";
import { statusMeta } from "@/lib/status";
import type { FindingReview, FindingRow, TaskLocal, TaskRow, TaskStatus, TaskSummary } from "@/types/fixes";
import type { FindingStatus } from "@/types/shared-records";

import {
  allowedMoves,
  applyFindingReview,
  FINDING_CLOSED,
  findingStatusForTask,
  isTaskOpen,
  nextLocalTaskId,
  REVIEW_LABEL,
  type FindingReviewAction,
} from "./fixes-logic";
import { eventLabel } from "./history";
import { buildTaskRow, localDigest, type NewTaskInput } from "./local-task";

/** The finding fields every consumer needs; the inbox passes full rows, the task page passes just these. */
export type FindingState = Pick<FindingRow, "id" | "status"> & Partial<FindingRow>;

/** Used when a finding created elsewhere carries no observation date. */
const demoFallbackDate = "2026-11-19T09:00:00Z";

const idOfTask = (row: TaskRow) => row.id;
const idOfFinding = (row: FindingState) => row.id;

const EVENT_FOR_TARGET: Partial<Record<TaskStatus, DemoEventKind>> = {
  approved: "task.approved",
  rejected: "task.rejected",
  applied: "task.applied",
  published: "task.published",
  rolled_back: "task.rolled_back",
  verified_success: "task.verified",
  partially_verified: "task.verified",
  failed: "task.verified",
};

export type TaskEvent = { title: string; detail?: string; kind?: DemoEventKind; refs?: DemoEventRefs };

export type MoveOptions = { reason?: string; successorId?: string };

/** What a move writes onto the task row besides the new status. */
export function movePatch(task: Pick<TaskRow, "id" | "mode"> & Partial<TaskLocal>, target: TaskStatus, by: string, now: string, opts: MoveOptions = {}): Partial<TaskRow> {
  const base: Partial<TaskRow> = { status: target };
  switch (target) {
    case "pending_approval":
      return { ...base, approvalState: "pending", requestedAt: now };
    case "approved":
      return { ...base, approvalState: "approved", decision: { by, at: now, note: "Only this exact diff can be written." } };
    case "rejected":
      return { ...base, rejection: { by, at: now, reason: opts.reason ?? "Rejected" } };
    case "cancelled":
      return { ...base, cancellation: { by, at: now, reason: opts.reason ?? "Cancelled" } };
    case "superseded":
      return { ...base, supersededBy: opts.successorId ?? null, supersession: { by, at: now, successorId: opts.successorId ?? "", reason: opts.reason ?? "Replaced by a newer task" } };
    case "draft_ready":
      return { ...base, completedAt: now };
    case "staged":
      return { ...base, stagedAt: now, completedAt: task.completedAt ?? now };
    case "applied":
      return { ...base, appliedAt: now, completedAt: task.completedAt ?? now };
    case "published":
      return { ...base, publishedAt: now };
    case "rolled_back":
      return {
        ...base,
        rollbackRecord: {
          at: now,
          by,
          reason: opts.reason ?? "Rolled back",
          restoredHash: localDigest(`${task.id}-restored`),
          outcome: "restored",
          note: "Simulated rollback. The version from before this task is restored in this demo only.",
          preservedEdits: [],
        },
      };
    case "suggested":
      return { ...base, rejection: undefined, cancellation: undefined };
    default:
      return base;
  }
}

export function useFixData(storeId: string, baseTasks: readonly TaskSummary[], baseFindings: readonly FindingState[], actorName: string) {
  const toast = useToast();
  const router = useRouter();
  const tasksC = useDemoCollection<TaskRow>("tasks", baseTasks as TaskRow[], idOfTask);
  const findingsC = useDemoCollection<FindingState>("findings", baseFindings as FindingState[], idOfFinding);
  const { update: updateTask, create: createTaskRow } = tasksC;
  const { update: updateFinding } = findingsC;

  /** Tasks of this website, local changes applied. */
  const tasks = useMemo(() => tasksC.rows.filter((r) => r.storeId === storeId && typeof r.title === "string"), [tasksC.rows, storeId]);

  /** Findings of this website, with status and task links following the local state. */
  const findings = useMemo<FindingRow[]>(
    () =>
      findingsC.rows
        .filter((raw) => (raw.storeId === undefined || raw.storeId === storeId) && typeof raw.title === "string")
        .map((raw) => {
          const loose = raw as FindingState & { affectedUrls?: string[]; affectedPromptIds?: string[] };
          return {
            id: raw.id,
            storeId,
            title: raw.title as string,
            category: raw.category ?? "technical",
            severity: raw.severity ?? "medium",
            priority: raw.priority ?? "P2",
            confidence: raw.confidence ?? "medium",
            status: raw.status,
            urlCount: raw.urlCount ?? loose.affectedUrls?.length ?? 0,
            promptCount: raw.promptCount ?? loose.affectedPromptIds?.length ?? 0,
            lastObservedAt: raw.lastObservedAt ?? demoFallbackDate,
            duplicate: raw.duplicate ?? null,
            tasks: tasks.filter((t) => t.findingId === raw.id).map((t) => ({ id: t.id, title: t.title, status: t.status })),
            closed: FINDING_CLOSED.has(raw.status),
            review: raw.review ?? null,
          };
        }),
    [findingsC.rows, tasks, storeId],
  );

  const notify = useCallback(
    (label: string, description?: string, tone: SimulatedTone = "success", action?: { label: string; onClick: () => void }) => {
      toast.push({ ...simulatedToast(label, tone), description, action });
    },
    [toast],
  );

  const findingStatus = useCallback((id: string): FindingStatus | null => findingsC.rows.find((f) => f.id === id)?.status ?? null, [findingsC.rows]);

  /** Moves the finding after a task change, with its own evidence event. */
  const syncFinding = useCallback(
    (findingId: string, taskId: string, target: TaskStatus, cause: "verification" | "write") => {
      const current = findingStatus(findingId);
      if (!current) return null;
      const otherOpenTask = tasks.some((t) => t.findingId === findingId && t.id !== taskId && isTaskOpen(t.status));
      const next = findingStatusForTask({ finding: current, task: target, cause, otherOpenTask });
      if (!next) return null;
      updateFinding(findingId, { status: next, closed: FINDING_CLOSED.has(next) }, {
        kind: "finding.updated",
        label: eventLabel(`Finding ${statusMeta("finding", next).label.toLowerCase()}`, taskId),
        refs: { findingId, taskId, websiteId: storeId },
      });
      return next;
    },
    [findingStatus, tasks, updateFinding, storeId],
  );

  /** Writes a patch to a task with one evidence event, and moves the finding when the status changed. */
  const patchTask = useCallback(
    (task: Pick<TaskRow, "id" | "findingId">, patch: Partial<TaskRow>, event: TaskEvent, cause: "verification" | "write" = "write") => {
      const input: DemoEventInput = {
        kind: event.kind ?? (patch.status ? (EVENT_FOR_TARGET[patch.status] ?? "task.updated") : "task.updated"),
        label: eventLabel(event.title, event.detail),
        refs: { taskId: task.id, findingId: task.findingId, websiteId: storeId, ...event.refs },
      };
      updateTask(task.id, patch, input);
      if (patch.status) return syncFinding(task.findingId, task.id, patch.status, cause);
      return null;
    },
    [updateTask, syncFinding, storeId],
  );

  const moveTask = useCallback(
    (task: TaskRow, target: TaskStatus, opts: MoveOptions = {}) => {
      if (!allowedMoves(task.status, task.mode).includes(target)) {
        notify("Move not allowed", `${statusMeta("task", task.status).label} cannot move to ${statusMeta("task", target).label}.`, "warning");
        return false;
      }
      const label = statusMeta("task", target).label;
      const patch = movePatch(task, target, actorName, demoNow(), opts);
      const title = target === "approved" ? "Approved" : target === "rejected" ? "Rejected" : target === "cancelled" ? "Cancelled" : target === "superseded" ? `Superseded by ${opts.successorId ?? "a newer task"}` : target === "rolled_back" ? "Rolled back" : `Moved to ${label}`;
      patchTask(task, patch, { title, detail: opts.reason });
      const unverified = target === "applied" || target === "published";
      notify(`${task.id} ${target === "approved" ? "approved" : `moved to ${label}`}`, unverified ? "Applied and published are not verified." : undefined, unverified ? "info" : "success");
      return true;
    },
    [actorName, patchTask, notify],
  );

  /** Creates a Suggested task from a finding and moves the finding to In remediation. */
  const createTask = useCallback(
    (input: Omit<NewTaskInput, "storeId" | "actorName" | "now">) => {
      // Read the live store, not this render's rows: bulk create calls this several times in a row.
      const saved = demoStore.getSnapshot();
      const id = nextLocalTaskId([
        ...saved.tasks.created.map((r) => r.id),
        ...saved.tasks.removed,
        ...saved.events.flatMap((e) => (e.refs.taskId ? [e.refs.taskId] : [])),
      ]);
      const row = buildTaskRow({ ...input, storeId, actorName, now: demoNow() });
      const created = createTaskRow({ ...row, id }, (r) => ({
        kind: "task.created",
        label: eventLabel("Task created", `from ${input.finding.id}`),
        refs: { taskId: r.id, findingId: input.finding.id, websiteId: storeId },
      }));
      syncFinding(input.finding.id, created.id, "suggested", "write");
      notify("Task created", `${created.id} · Suggested`, "success", { label: "Open task", onClick: () => router.push(`/stores/${storeId}/fixes/tasks/${created.id}`) });
      return created;
    },
    [storeId, actorName, createTaskRow, syncFinding, notify, router],
  );

  /** Confirm, false positive, accept risk, reopen. Persisted with an event. */
  const reviewFinding = useCallback(
    (findingId: string, action: FindingReviewAction, opts: { reason?: string; expiresAt?: string } = {}) => {
      const current = findingStatus(findingId);
      if (!current) return false;
      const next = applyFindingReview(current, action);
      if (!next) {
        notify("Not allowed", `${REVIEW_LABEL[action]} is not available while the finding is ${statusMeta("finding", current).label.toLowerCase()}.`, "warning");
        return false;
      }
      const at = demoNow();
      const review: FindingReview | null = action === "false_positive" || action === "accept_risk" ? { kind: action === "false_positive" ? "false_positive" : "accepted_risk", reason: opts.reason ?? "", expiresAt: opts.expiresAt, by: actorName, at } : null;
      updateFinding(findingId, { status: next, closed: FINDING_CLOSED.has(next), review }, {
        kind: "finding.updated",
        label: eventLabel(REVIEW_LABEL[action], opts.reason),
        refs: { findingId, websiteId: storeId },
      });
      notify(`Finding ${statusMeta("finding", next).label.toLowerCase()}`);
      return true;
    },
    [findingStatus, updateFinding, notify, actorName, storeId],
  );

  return { tasks, findings, notify, findingStatus, patchTask, moveTask, createTask, reviewFinding, syncFinding, actorName, updateFinding };
}

export type FixData = ReturnType<typeof useFixData>;
