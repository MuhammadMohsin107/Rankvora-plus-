/**
 * Pure rules for the Fixes module: task transitions, the finding status machine, simulated apply and
 * simulated verification. No React, no demo data, so it runs in the browser, on the server and in tests.
 */
import { OPEN_TASK_STATUSES } from "@/lib/record-status";
import { type BatchItem, type CheckStatus, type ExecutionMode, type TaskStatus, type VerificationCheck, type VerificationOutcome, type VerificationRecord } from "@/types/fixes";
import type { FindingCategory, FindingStatus } from "@/types/shared-records";

// ---------------------------------------------------------------------------
// Task transitions
// ---------------------------------------------------------------------------

/** Statuses a person may move a task to by hand. Verification outcomes (verified, partial, failed) are never manual. */
const BASE: Record<TaskStatus, TaskStatus[]> = {
  suggested: ["pending_approval", "rejected", "cancelled", "superseded"],
  pending_approval: ["approved", "rejected", "cancelled", "superseded"],
  approved: ["queued", "in_progress", "blocked", "cancelled", "superseded"],
  queued: ["in_progress", "blocked", "cancelled", "superseded"],
  in_progress: ["draft_ready", "blocked", "cancelled", "superseded"],
  blocked: ["in_progress", "rejected", "cancelled", "superseded"],
  draft_ready: ["staged", "pending_approval", "in_progress", "cancelled", "superseded"],
  staged: ["applied", "draft_ready", "cancelled", "superseded"],
  applied: ["published", "verification_pending", "rolled_back"],
  published: ["verification_pending", "rolled_back"],
  verification_pending: ["rolled_back"],
  verified_success: [],
  partially_verified: ["in_progress", "rolled_back", "superseded"],
  failed: ["in_progress", "cancelled", "superseded"],
  rolled_back: ["in_progress", "cancelled"],
  rejected: ["suggested"],
  cancelled: ["suggested"],
  superseded: [],
};

/** What "Run verification" can produce from a task waiting for verification. */
export const VERIFICATION_RESULTS: readonly TaskStatus[] = ["verified_success", "partially_verified", "failed"];

export function allowedMoves(status: TaskStatus, mode: ExecutionMode): TaskStatus[] {
  let moves = BASE[status];
  if (mode === "guidance") {
    moves = moves.filter((s) => !["draft_ready", "staged", "pending_approval", "published"].includes(s));
    if (status === "in_progress") moves = [...moves, "applied"];
    if (status === "suggested") moves = [...moves, "in_progress"];
  }
  if (mode === "ai_draft") {
    moves = moves.filter((s) => s !== "staged" && s !== "published");
    if (status === "draft_ready") moves = [...moves, "applied"];
  }
  if (mode === "cms_staged" && status === "draft_ready") moves = moves.filter((s) => s !== "pending_approval");
  return moves;
}

/** Moves that need an owner or admin (approval is not editing). */
export function needsApprover(target: TaskStatus): boolean {
  return target === "approved";
}

/** Moves that need a typed reason, recorded in history. */
export function needsReason(target: TaskStatus): boolean {
  return target === "rejected" || target === "cancelled" || target === "rolled_back" || target === "superseded";
}

/** Statuses reachable from `start` using manual moves plus verification and write failures. Used by tests. */
export function reachableStatuses(start: TaskStatus = "suggested"): Set<TaskStatus> {
  const seen = new Set<TaskStatus>([start]);
  const queue: TaskStatus[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as TaskStatus;
    const next = [...BASE[current], ...(current === "verification_pending" ? VERIFICATION_RESULTS : []), ...(current === "staged" || current === "applied" ? (["failed"] as TaskStatus[]) : [])];
    for (const status of next) {
      if (!seen.has(status)) {
        seen.add(status);
        queue.push(status);
      }
    }
  }
  return seen;
}

export const isTaskOpen = (status: TaskStatus): boolean => OPEN_TASK_STATUSES.has(status);

/** Task statuses where a change has been written or done by a person: it cannot be cancelled, only rolled back. */
export const WRITTEN_STATUSES: ReadonlySet<TaskStatus> = new Set(["applied", "published", "verification_pending", "verified_success", "partially_verified"]);

/** The four separate states of a fix. Applied is never verified. */
export function lifecycleOf(status: TaskStatus): { completed: boolean; applied: boolean; published: boolean; verified: boolean } {
  const applied = WRITTEN_STATUSES.has(status);
  return {
    completed: applied || ["draft_ready", "staged", "failed", "rolled_back"].includes(status),
    applied,
    published: status === "published" || status === "verification_pending" || status === "verified_success",
    verified: status === "verified_success",
  };
}

// ---------------------------------------------------------------------------
// Finding status machine
// ---------------------------------------------------------------------------

export type FindingReviewAction = "confirm" | "false_positive" | "accept_risk" | "reopen";

const REVIEW: Record<FindingReviewAction, { from: FindingStatus[]; to: FindingStatus }> = {
  confirm: { from: ["new", "under_review", "reopened"], to: "confirmed" },
  false_positive: { from: ["new", "under_review", "confirmed", "reopened"], to: "false_positive" },
  accept_risk: { from: ["new", "under_review", "confirmed", "reopened", "in_remediation"], to: "accepted_risk" },
  reopen: { from: ["verified_resolved", "false_positive", "accepted_risk"], to: "reopened" },
};

export const REVIEW_LABEL: Record<FindingReviewAction, string> = {
  confirm: "Confirm finding",
  false_positive: "Mark false positive",
  accept_risk: "Accept risk",
  reopen: "Reopen",
};

/** Review actions a person can take on a finding in this status. */
export function findingReviewActions(status: FindingStatus): FindingReviewAction[] {
  return (Object.keys(REVIEW) as FindingReviewAction[]).filter((action) => REVIEW[action].from.includes(status));
}

/** Status after a review action, or null when the action is not allowed from `status`. */
export function applyFindingReview(status: FindingStatus, action: FindingReviewAction): FindingStatus | null {
  return REVIEW[action].from.includes(status) ? REVIEW[action].to : null;
}

export const FINDING_CLOSED: ReadonlySet<FindingStatus> = new Set(["verified_resolved", "false_positive", "accepted_risk"]);

/** A task can be created while the finding is open. */
export function canCreateTask(status: FindingStatus): boolean {
  return !FINDING_CLOSED.has(status);
}

/** What a person should do next on a finding. Null when nothing is needed (closed, or no task fits). */
export type FindingNextStep = "confirm" | "create_task" | "create_new_task" | "continue_task" | "verify_task";

/**
 * The single next step for a finding, from its status and its tasks. "create_new_task" is a reopened finding whose
 * earlier task is finished (it did not hold); "continue_task" and "verify_task" point at the task that is already open.
 */
export function nextStepForFinding(status: FindingStatus, hasOpenTask: boolean, hasEarlierTask: boolean): FindingNextStep | null {
  if (status === "new" || status === "under_review") return "confirm";
  if (status === "awaiting_verification") return hasOpenTask ? "verify_task" : null;
  if (status === "confirmed" || status === "reopened" || status === "in_remediation") {
    if (hasOpenTask) return "continue_task";
    if (status === "in_remediation") return null;
    return status === "reopened" && hasEarlierTask ? "create_new_task" : "create_task";
  }
  return null;
}

type SyncInput = {
  finding: FindingStatus;
  task: TaskStatus;
  /** "verification": a verification run produced `task`. "write": a person or a write moved it. */
  cause: "verification" | "write";
  /** Another task of the same finding is still open. */
  otherOpenTask: boolean;
};

/**
 * How a finding follows its task. Returns the new finding status, or null when it does not change.
 * Applied, published and verification pending mean "awaiting verification" (never resolved).
 */
export function findingStatusForTask({ finding, task, cause, otherOpenTask }: SyncInput): FindingStatus | null {
  if (FINDING_CLOSED.has(finding) && cause !== "verification") return null;
  const working: FindingStatus[] = ["new", "under_review", "confirmed", "reopened", "in_remediation"];
  let next: FindingStatus | null = null;
  switch (task) {
    case "suggested":
    case "pending_approval":
    case "approved":
    case "queued":
    case "in_progress":
    case "blocked":
    case "draft_ready":
    case "staged":
      next = working.includes(finding) || finding === "awaiting_verification" ? "in_remediation" : null;
      break;
    case "applied":
    case "published":
    case "verification_pending":
      next = working.includes(finding) ? "awaiting_verification" : null;
      break;
    case "verified_success":
      next = "verified_resolved";
      break;
    case "partially_verified":
      next = "in_remediation";
      break;
    case "failed":
      next = cause === "verification" ? "reopened" : null;
      break;
    case "rolled_back":
      next = finding === "awaiting_verification" ? "in_remediation" : null;
      break;
    case "rejected":
    case "cancelled":
    case "superseded":
      next = finding === "in_remediation" && !otherOpenTask ? "confirmed" : null;
      break;
  }
  return next && next !== finding ? next : null;
}

// ---------------------------------------------------------------------------
// Simulated apply (per item)
// ---------------------------------------------------------------------------

export type ApplyResult = { results: Record<string, BatchItem["result"]>; failed: string[]; applied: string[] };

/**
 * Simulated write of a batch. Items that are ready are applied; conflicts and excluded items are never written.
 * On the first attempt the last ready item fails when there are two or more (a deterministic demo of partial success).
 * A retry only touches the failed items and succeeds.
 */
export function simulateApply(items: readonly { id: string; result: BatchItem["result"] }[], attempt: number): ApplyResult {
  const results: Record<string, BatchItem["result"]> = {};
  const ready = items.filter((i) => i.result === "ready");
  const failing = attempt === 0 && ready.length >= 2 ? ready[ready.length - 1].id : null;
  for (const item of items) {
    if (item.result === "ready") results[item.id] = item.id === failing ? "failed" : "applied";
    else if (item.result === "failed") results[item.id] = attempt > 0 ? "applied" : "failed";
    else results[item.id] = item.result;
  }
  return {
    results,
    failed: Object.keys(results).filter((id) => results[id] === "failed"),
    applied: Object.keys(results).filter((id) => results[id] === "applied"),
  };
}

// ---------------------------------------------------------------------------
// Simulated verification
// ---------------------------------------------------------------------------

export type SimulatedResult = "verified_success" | "partially_verified" | "failed";

export const SIMULATED_LABEL: Record<SimulatedResult, string> = { verified_success: "Success", partially_verified: "Partial", failed: "Failed" };

/** Default outcome of a simulated verification: AI visibility fixes are partial (site facts pass, AI mention unchanged). */
export function defaultSimulatedResult(category: FindingCategory): SimulatedResult {
  return category === "ai_visibility" ? "partially_verified" : "verified_success";
}

const FINDING_EFFECT: Record<SimulatedResult, string> = {
  verified_success: "Finding moves to Verified resolved.",
  partially_verified: "Finding stays in remediation: some checks still fail.",
  failed: "Finding is reopened: the checks did not pass.",
};

/**
 * Builds a verification outcome from the planned checks. Simulated: nothing was re-crawled or re-run.
 * success: every check passes. partial: the first half passes, the rest are inconclusive. failed: every check fails.
 */
export function deriveVerification(input: {
  planned: VerificationRecord["plannedChecks"];
  result: SimulatedResult;
  category: FindingCategory;
  ranAt: string;
  sourceLabel: string;
  sourceHref?: string;
}): VerificationOutcome {
  const { planned, result, category } = input;
  const passCount = result === "verified_success" ? planned.length : result === "partially_verified" ? Math.ceil(planned.length / 2) : 0;
  const checks: VerificationCheck[] = planned.map((check, index) => {
    const pass = index < passCount;
    const after: CheckStatus = pass ? "pass" : result === "failed" ? "fail" : "inconclusive";
    return {
      id: check.id,
      label: check.label,
      before: { status: "fail", detail: "Not met before the change." },
      after: {
        status: after,
        detail: pass ? `Expected: ${check.expect}.` : result === "failed" ? "Still not met in the re-check." : category === "ai_visibility" ? "AI answers have not changed yet. Re-check after the next monitoring runs." : "Could not confirm yet.",
      },
    };
  });
  return {
    result,
    checks,
    ranAt: input.ranAt,
    sourceLabel: input.sourceLabel,
    sourceHref: input.sourceHref,
    findingEffect: FINDING_EFFECT[result],
  };
}

