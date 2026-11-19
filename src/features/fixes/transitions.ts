import type { ExecutionMode, TaskStatus } from "@/types/fixes";

/** Statuses a person may move a task to by hand. Verification outcomes are never manual. */
const BASE: Record<TaskStatus, TaskStatus[]> = {
  suggested: ["pending_approval", "rejected"],
  pending_approval: ["approved", "rejected"],
  approved: ["queued", "in_progress", "blocked"],
  queued: ["in_progress", "blocked"],
  in_progress: ["draft_ready", "blocked"],
  blocked: ["in_progress", "rejected"],
  draft_ready: ["staged", "pending_approval", "in_progress"],
  staged: ["applied", "draft_ready"],
  applied: ["published", "verification_pending", "rolled_back"],
  published: ["verification_pending", "rolled_back"],
  verification_pending: [],
  verified_success: [],
  partially_verified: ["in_progress"],
  failed: ["in_progress"],
  rolled_back: ["in_progress"],
  rejected: ["suggested"],
  superseded: [],
};

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
