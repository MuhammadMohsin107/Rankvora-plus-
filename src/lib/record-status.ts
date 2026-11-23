import type { Finding } from "@/types/shared-records";

/** Finding statuses that still need work. Shared by the Dashboard and website summaries. */
export const OPEN_FINDING_STATUSES = new Set<Finding["status"]>(["new", "under_review", "confirmed", "in_remediation", "awaiting_verification", "reopened"]);

/** Task statuses that are not finished (includes failed, which needs a decision). */
export const OPEN_TASK_STATUSES = new Set<string>([
  "suggested",
  "pending_approval",
  "approved",
  "queued",
  "in_progress",
  "blocked",
  "draft_ready",
  "staged",
  "applied",
  "published",
  "verification_pending",
  "partially_verified",
  "failed",
]);
