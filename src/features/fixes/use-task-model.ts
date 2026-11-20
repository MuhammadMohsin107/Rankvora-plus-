"use client";

/**
 * Everything the task detail page changes, as one model: the effective task (seeded detail plus local changes),
 * its history from demo-state events, and the actions. Each action writes local state, emits an event and toasts "(simulated)".
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { demoNow, emit, useDemoEvents } from "@/demo-state";
import { statusMeta } from "@/lib/status";
import type { BatchItem, HistoryEvent, TaskDetailData, TaskRow, TaskStatus, TaskSummary } from "@/types/fixes";

import { defaultSimulatedResult, deriveVerification, simulateApply, type SimulatedResult } from "./fixes-logic";
import { eventLabel, toHistoryEvent } from "./history";
import { modeNeedsApproval } from "./local-task";
import { buildTaskView } from "./task-view";
import { movePatch, useFixData } from "./use-fix-data";

export type FixLinks = { latestRunId: string | null; comparisons: { id: string; title: string }[] };

type Args = { storeId: string; detail: TaskDetailData; tasks: readonly TaskSummary[]; actorName: string; links: FixLinks };

export function useTaskModel({ storeId, detail, tasks: baseTasks, actorName, links }: Args) {
  const { task: seededTask, draft } = detail;
  const findingBase = useMemo(() => [{ id: seededTask.findingId, status: detail.findingStatus }], [seededTask.findingId, detail.findingStatus]);
  const fix = useFixData(storeId, baseTasks, findingBase, actorName);
  const { patchTask, moveTask, notify } = fix;

  const row = useMemo<TaskRow>(() => fix.tasks.find((t) => t.id === seededTask.id) ?? (seededTask as TaskRow), [fix.tasks, seededTask]);
  const view = useMemo(() => buildTaskView(detail, row), [detail, row]);
  const seededText = draft.kind === "text" || draft.kind === "patch" ? draft.after : "";

  const [edit, setEdit] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [simulated, setSimulated] = useState<SimulatedResult>(defaultSimulatedResult(seededTask.category));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const text = edit ?? view.text;
  const dirty = edit !== null && edit !== view.text;
  const approvedBase = view.approvedText ?? seededText;
  const diffChanged = view.approvalState === "approved" && text !== approvedBase;
  const needsApproval = modeNeedsApproval(seededTask.mode);

  // History: seeded entries, then local events for this task (oldest first, then sorted by the tab).
  const events = useDemoEvents({ taskId: seededTask.id });
  const history = useMemo<HistoryEvent[]>(() => [...detail.history, ...events.map((e) => toHistoryEvent(e, actorName))], [detail.history, events, actorName]);

  /** An edit after approval invalidates it: the approved diff no longer matches. */
  const invalidateApproval = (nextText: string): Partial<TaskRow> => {
    if (!needsApproval || nextText === approvedBase) return {};
    if (view.approvalState !== "approved" && view.approvalState !== "pending") return {};
    const back: Partial<TaskRow> = { approvalState: "not_requested", approvedText: undefined };
    if (view.status === "approved" || view.status === "pending_approval") back.status = "draft_ready";
    return back;
  };

  const act = {
    startWork: () => {
      patchTask(row, { status: "in_progress" }, { title: "Work started" });
      notify("Work started");
    },
    requestApproval: () => {
      patchTask(row, { status: "pending_approval", approvalState: "pending", requestedAt: demoNow() }, { title: "Approval requested", detail: "Owner or admin must approve the exact diff" });
      notify("Approval requested", "Owner or admin must approve the exact diff.");
    },
    approve: () => {
      patchTask(
        row,
        { approvalState: "approved", approvedText: view.text, decision: { by: actorName, at: demoNow(), note: "Only this exact diff can be written." }, status: view.status === "pending_approval" ? "approved" : view.status },
        { title: "Approved exact diff", kind: "task.approved" },
      );
      notify("Diff approved", "Status Approved. Nothing is written yet.");
    },
    rejectApproval: (reason: string) => {
      patchTask(row, { approvalState: "rejected", decision: { by: actorName, at: demoNow(), note: reason }, status: "in_progress" }, { title: "Approval rejected", detail: reason, kind: "task.rejected" });
      notify("Approval rejected", "The task is back in progress.", "info");
    },
    setText: (value: string) => setEdit(value),
    resetDraft: () => {
      setEdit(null);
      notify("Edits discarded", undefined, "info");
    },
    saveDraft: () => {
      const version = view.version + 1;
      const patch: Partial<TaskRow> = { draftText: text, draftVersion: version, draftClaims: view.claims.filter((c) => text.includes(c.text)), ...invalidateApproval(text) };
      const reapprove = patch.approvalState === "not_requested";
      patchTask(row, patch, { title: `Draft v${version} saved`, detail: reapprove ? "Approval needs to be requested again" : undefined });
      setEdit(null);
      notify(`Draft v${version} saved`, reapprove ? "The diff changed, so approval is needed again." : undefined, reapprove ? "warning" : "success");
    },
    regenerate: () => {
      setGenerating(true);
      later(() => {
        setGenerating(false);
        const gen = (row.draftGen ?? 0) + 1;
        const version = view.version + 1;
        if (draft.kind === "text") {
          const alt = gen % 2 === 1;
          const nextText = alt ? draft.alternate.after : draft.after;
          const claims = alt ? draft.alternate.unsupportedClaims : draft.unsupportedClaims;
          patchTask(row, { draftText: nextText, draftClaims: claims, draftGen: gen, draftVersion: version, ...invalidateApproval(nextText) }, { title: `Draft v${version} regenerated`, detail: `${claims.length} unsupported ${claims.length === 1 ? "claim" : "claims"} flagged` });
          setEdit(null);
          notify(`Draft v${version} regenerated`, `${claims.length} unsupported ${claims.length === 1 ? "claim" : "claims"} flagged. No model was called.`, claims.length ? "warning" : "success");
        } else {
          patchTask(row, { draftGen: gen, draftVersion: version }, { title: `Patch v${version} regenerated`, detail: "Output matches the previous patch" });
          setEdit(null);
          notify("Patch regenerated", "Output matches the previous patch. No model was called.", "info");
        }
      }, 1100);
    },
    batchSet: (id: string, result: BatchItem["result"], message: string) => {
      patchTask(row, { batch: { ...view.batch, [id]: result } }, { title: message });
      notify(message, undefined, "info");
    },
    recheckRemote: () => {
      patchTask(row, { remoteCheckedAt: demoNow() }, { title: "Remote re-checked", detail: view.remote?.changed ? "Still changed" : "Unchanged" });
      notify(view.remote?.changed ? "Still changed" : "Remote unchanged", view.remote?.changed ? "The resource still differs from the draft." : "Simulated check: the copy matches the draft.", view.remote?.changed ? "warning" : "success");
    },
    redraft: () => {
      const conflicts = draft.kind === "batch" ? draft.items.filter((i) => (view.batch[i.id] ?? i.result) === "conflict") : [];
      patchTask(row, { remoteResolved: true, batch: { ...view.batch, ...Object.fromEntries(conflicts.map((i) => [i.id, "ready" as const])) } }, { title: "Redrafted from the current remote copy" });
      notify("Redrafted from current copy", "The hold is cleared. Approval still covers staging.");
    },
    /** Stage, apply, publish or retry. Batch drafts resolve per item. */
    write: (target: TaskStatus, label: string) => {
      const now = demoNow();
      if (draft.kind === "batch" && (target === "applied" || view.status === "failed")) {
        const items = draft.items.map((i) => ({ id: i.id, result: (view.batch[i.id] ?? i.result) as BatchItem["result"] }));
        const attempt = row.applyAttempts ?? 0;
        const sim = simulateApply(items, attempt);
        if (sim.failed.length > 0) {
          patchTask(
            row,
            {
              status: "failed",
              batch: sim.results,
              applyAttempts: attempt + 1,
              failure: {
                at: now,
                stage: "apply",
                code: "BATCH_PARTIAL",
                message: `${sim.applied.length} of ${sim.applied.length + sim.failed.length} items applied, ${sim.failed.length} failed (simulated).`,
                attempts: [{ at: now, result: "Partly failed" }],
                retryable: true,
                retryBlockedBy: null,
                nothingWritten: false,
                nextStep: "Retry the failed items. Items already applied are kept.",
              },
            },
            { title: "Apply partly failed", detail: `${sim.failed.length} of ${sim.applied.length + sim.failed.length} items failed`, kind: "task.updated" },
          );
          notify("Apply partly failed", `${sim.applied.length} applied, ${sim.failed.length} failed. Retry the failed items.`, "warning");
          return;
        }
        patchTask(row, { ...movePatch(row, "applied", actorName, now), batch: sim.results, applyAttempts: attempt + 1, failure: null }, { title: attempt > 0 ? "Retry applied the failed items" : label, detail: `${sim.applied.length} items applied`, kind: "task.applied" });
        notify("Applied", "Not verified yet. Simulated: nothing was written.", "info");
        return;
      }
      patchTask(row, { ...movePatch(row, target, actorName, now), failure: null }, { title: label, detail: "Remote check passed" });
      notify(`${label}: ${statusMeta("task", target).label}`, "Not verified yet. Simulated: nothing was written.", "info");
    },
    rollback: (reason: string) => {
      patchTask(row, movePatch(row, "rolled_back", actorName, demoNow(), { reason }), { title: "Rolled back", detail: reason });
      notify("Rolled back", "Simulated: the previous version is restored in this demo only.", "info");
    },
    markApplied: () => {
      patchTask(row, movePatch(row, "applied", actorName, demoNow()), { title: "Marked applied", detail: "Applied outside Rankvora AI" });
      notify("Marked applied", "Applied is not verified. Queue verification next.", "info");
    },
    queueVerification: () => {
      patchTask(row, { status: "verification_pending" }, { title: "Queued for verification", detail: "Applied is not verified" });
      notify("Queued for verification");
    },
    runVerification: () => {
      setVerifying(true);
      later(() => {
        setVerifying(false);
        const ranAt = demoNow();
        const outcome = deriveVerification({
          planned: detail.verification.plannedChecks,
          result: simulated,
          category: seededTask.category,
          ranAt,
          sourceLabel: "Simulated re-check",
        });
        const passed = outcome.checks.filter((c) => c.after.status === "pass").length;
        const label = statusMeta("task", simulated).label;
        patchTask(
          row,
          { status: simulated, outcome },
          { title: label, detail: `${passed} of ${outcome.checks.length} checks passed`, kind: "task.verified", refs: seededTask.category === "ai_visibility" && links.latestRunId ? { runId: links.latestRunId } : undefined },
          "verification",
        );
        notify(label, `${passed} of ${outcome.checks.length} checks passed. ${outcome.findingEffect}`, simulated === "verified_success" ? "success" : "warning");
      }, 1500);
    },
    cancel: (reason: string) => moveTask(row, "cancelled", { reason }),
    reject: (reason: string) => moveTask(row, "rejected", { reason }),
    supersede: (successorId: string, reason: string) => moveTask(row, "superseded", { successorId, reason }),
    reopen: () => moveTask(row, "suggested"),
    assign: (name: string) => fix.assign(row, name),
    annotate: (comparisonId: string) => {
      const comparison = links.comparisons.find((c) => c.id === comparisonId);
      emit({
        kind: "comparison.annotated",
        label: eventLabel("Fix added to the Comparison timeline", `${seededTask.id}${comparison ? ` · ${comparison.title}` : ""}`),
        refs: { taskId: seededTask.id, findingId: seededTask.findingId, comparisonId, websiteId: storeId },
      });
      notify("Added to the Comparison timeline", comparison?.title);
    },
  };

  return { row, view, text, dirty, diffChanged, needsApproval, history, generating, verifying, simulated, setSimulated, act, fix };
}

export type TaskModel = ReturnType<typeof useTaskModel>;
