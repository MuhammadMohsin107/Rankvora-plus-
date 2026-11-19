import type { IconName } from "@/components/ui/icon";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export type StatusMeta = { label: string; tone: Tone; icon: IconName };

const m = (label: string, tone: Tone, icon: IconName): StatusMeta => ({ label, tone, icon });

/**
 * Single source of truth for status vocabulary (exact terms from the specs).
 * Every status is shown as icon + text + tone — never colour alone.
 */
export const STATUS = {
  store: {
    draft: m("Draft", "neutral", "circle"),
    needs_review: m("Needs review", "warning", "alert-circle"),
    ready: m("Ready", "info", "check-circle"),
    active: m("Active", "success", "circle-dot"),
    paused: m("Paused", "neutral", "pause"),
    disconnected: m("Disconnected", "danger", "x-circle"),
    archived: m("Archived", "neutral", "minus-circle"),
  },
  prompt: {
    draft: m("Draft", "neutral", "circle"),
    active: m("Active", "success", "circle-dot"),
    paused: m("Paused", "neutral", "pause"),
    archived: m("Archived", "neutral", "minus-circle"),
  },
  audit: {
    draft: m("Draft", "neutral", "circle"),
    validating: m("Validating", "info", "loader"),
    queued: m("Queued", "neutral", "clock"),
    in_progress: m("In progress", "accent", "loader"),
    completed: m("Completed", "success", "check-circle"),
    completed_with_warnings: m("Completed with warnings", "warning", "alert-triangle"),
    partially_completed: m("Partially completed", "warning", "alert-triangle"),
    blocked: m("Blocked", "danger", "lock"),
    failed: m("Failed", "danger", "x-circle"),
    cancelled: m("Cancelled", "neutral", "minus-circle"),
  },
  job: {
    queued: m("Queued", "neutral", "clock"),
    running: m("Running", "accent", "loader"),
    retry_scheduled: m("Retry scheduled", "warning", "refresh"),
    succeeded: m("Succeeded", "success", "check-circle"),
    failed: m("Failed", "danger", "x-circle"),
    cancelled: m("Cancelled", "neutral", "minus-circle"),
  },
  run: {
    queued: m("Queued", "neutral", "clock"),
    running: m("Running", "accent", "loader"),
    completed: m("Completed", "success", "check-circle"),
    completed_with_warnings: m("Completed with warnings", "warning", "alert-triangle"),
    partially_completed: m("Partially completed", "warning", "alert-triangle"),
    failed: m("Failed", "danger", "x-circle"),
    cancelled: m("Cancelled", "neutral", "minus-circle"),
    skipped: m("Skipped", "neutral", "minus-circle"),
  },
  schedule: {
    draft: m("Draft", "neutral", "circle"),
    validating: m("Validating", "info", "loader"),
    active: m("Active", "success", "circle-dot"),
    paused: m("Paused", "neutral", "pause"),
    needs_attention: m("Needs attention", "warning", "alert-triangle"),
    cancelled: m("Cancelled", "neutral", "minus-circle"),
  },
  check: {
    pass: m("Pass", "success", "check-circle"),
    fail: m("Fail", "danger", "x-circle"),
    warning: m("Warning", "warning", "alert-triangle"),
    not_applicable: m("Not applicable", "neutral", "minus-circle"),
    not_assessed: m("Not assessed", "neutral", "circle"),
    inconclusive: m("Inconclusive", "info", "help"),
    blocked: m("Blocked", "warning", "lock"),
    error: m("Error", "danger", "alert-circle"),
  },
  finding: {
    new: m("New", "accent", "circle-dot"),
    under_review: m("Under review", "info", "eye"),
    confirmed: m("Confirmed", "warning", "check-circle"),
    in_remediation: m("In remediation", "accent", "fixes"),
    awaiting_verification: m("Awaiting verification", "info", "clock"),
    verified_resolved: m("Verified resolved", "success", "shield-check"),
    reopened: m("Reopened", "danger", "refresh"),
    accepted_risk: m("Accepted risk", "neutral", "shield"),
    false_positive: m("False positive", "neutral", "x-circle"),
  },
  task: {
    suggested: m("Suggested", "neutral", "sparkles"),
    pending_approval: m("Pending approval", "warning", "clock"),
    approved: m("Approved", "info", "check-circle"),
    queued: m("Queued", "neutral", "clock"),
    in_progress: m("In progress", "accent", "loader"),
    blocked: m("Blocked", "danger", "lock"),
    draft_ready: m("Draft ready", "info", "file-text"),
    staged: m("Staged", "info", "layers"),
    applied: m("Applied", "accent", "check"),
    published: m("Published", "accent", "globe"),
    verification_pending: m("Verification pending", "warning", "clock"),
    verified_success: m("Verified success", "success", "shield-check"),
    partially_verified: m("Partially verified", "warning", "alert-triangle"),
    failed: m("Failed", "danger", "x-circle"),
    rolled_back: m("Rolled back", "neutral", "undo"),
    rejected: m("Rejected / cancelled", "neutral", "minus-circle"),
    superseded: m("Superseded", "neutral", "minus-circle"),
  },
  severity: {
    critical: m("Critical", "danger", "alert-triangle"),
    high: m("High", "danger", "alert-circle"),
    medium: m("Medium", "warning", "alert-circle"),
    low: m("Low", "info", "info"),
    informational: m("Informational", "neutral", "info"),
  },
  priority: {
    P0: m("P0 Urgent", "danger", "flag"),
    P1: m("P1 High", "warning", "flag"),
    P2: m("P2 Normal", "info", "flag"),
    P3: m("P3 Low", "neutral", "flag"),
  },
  confidence: {
    high: m("High confidence", "success", "check-circle"),
    medium: m("Medium confidence", "warning", "circle-dot"),
    low: m("Low confidence", "danger", "alert-circle"),
  },
  risk: {
    low: m("Low risk", "success", "shield-check"),
    medium: m("Medium risk", "warning", "shield"),
    high: m("High risk", "danger", "shield"),
    critical: m("Critical risk", "danger", "alert-triangle"),
  },
  cause: {
    confirmed: m("Confirmed cause", "success", "check-circle"),
    likely: m("Likely cause", "warning", "circle-dot"),
    hypothesis: m("Hypothesis", "neutral", "help"),
  },
  alert: {
    new: m("New", "accent", "circle-dot"),
    read: m("Read", "neutral", "eye"),
    acknowledged: m("Acknowledged", "info", "check"),
    resolved: m("Resolved", "success", "check-circle"),
    muted: m("Muted", "neutral", "minus-circle"),
  },
  delivery: {
    pending: m("Pending", "neutral", "clock"),
    sent: m("Sent", "success", "check"),
    failed: m("Failed", "danger", "x-circle"),
    retrying: m("Retrying", "warning", "refresh"),
  },
  comparison: {
    draft: m("Draft", "neutral", "circle"),
    validating: m("Validating", "info", "loader"),
    queued: m("Queued", "neutral", "clock"),
    running: m("Running", "accent", "loader"),
    completed: m("Completed", "success", "check-circle"),
    completed_with_warnings: m("Completed with warnings", "warning", "alert-triangle"),
    partially_comparable: m("Partially comparable", "warning", "alert-triangle"),
    not_comparable: m("Not comparable", "danger", "x-circle"),
    insufficient_data: m("Insufficient data", "warning", "info"),
    failed: m("Failed", "danger", "x-circle"),
    cancelled: m("Cancelled", "neutral", "minus-circle"),
    archived: m("Archived", "neutral", "minus-circle"),
  },
  comparability: {
    comparable: m("Comparable", "success", "check-circle"),
    partially_comparable: m("Partially comparable", "warning", "alert-triangle"),
    comparable_with_warnings: m("Comparable with warnings", "warning", "alert-triangle"),
    not_comparable: m("Not comparable", "danger", "x-circle"),
    insufficient_data: m("Insufficient data", "warning", "info"),
  },
  integration: {
    connected: m("Connected", "success", "check-circle"),
    needs_attention: m("Needs attention", "warning", "alert-triangle"),
    disconnected: m("Disconnected", "danger", "x-circle"),
    manual: m("Manual", "neutral", "pencil"),
    not_connected: m("Not connected", "neutral", "minus-circle"),
  },
  competitor: {
    suggested: m("Suggested", "warning", "sparkles"),
    confirmed: m("Confirmed", "success", "check-circle"),
    archived: m("Archived", "neutral", "minus-circle"),
  },
  sentiment: {
    positive: m("Positive", "success", "check-circle"),
    neutral: m("Neutral", "neutral", "minus-circle"),
    negative: m("Negative", "danger", "x-circle"),
    mixed: m("Mixed", "warning", "alert-circle"),
    unknown: m("Unknown", "neutral", "help"),
  },
  recommendation: {
    recommended: m("Recommended", "success", "check-circle"),
    merely_mentioned: m("Mentioned only", "info", "circle-dot"),
    not_recommended: m("Not recommended", "danger", "x-circle"),
    unclear: m("Unclear", "neutral", "help"),
    none: m("Not mentioned", "neutral", "minus-circle"),
  },
} as const satisfies Record<string, Record<string, StatusMeta>>;

export type StatusKind = keyof typeof STATUS;
export type StatusValue<K extends StatusKind> = keyof (typeof STATUS)[K] & string;

export function statusMeta<K extends StatusKind>(kind: K, value: StatusValue<K>): StatusMeta {
  return (STATUS[kind] as Record<string, StatusMeta>)[value];
}

/** Title-cases a snake_case value for display where no vocabulary entry applies. */
export function humanize(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
