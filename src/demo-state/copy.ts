/** Honest toast copy for local demo actions: says what changed locally, never claims an external action. */

export type SimulatedTone = "success" | "info" | "warning";
export type SimulatedToast = { title: string; tone: SimulatedTone };

const MESSAGES = {
  "finding.created": "Finding added",
  "finding.updated": "Finding updated",
  "task.created": "Task created",
  "task.approved": "Task approved",
  "task.rejected": "Task rejected",
  "task.applied": "Task marked applied",
  "task.published": "Task marked published",
  "task.verified": "Verification recorded",
  "task.rolled_back": "Task rolled back",
  "task.updated": "Task updated",
  "run.started": "Run started",
  "run.completed": "Run completed",
  "alert.read": "Alert marked read",
  "alert.acknowledged": "Alert acknowledged",
  "alert.muted": "Alert muted",
  "alert.resolved": "Alert resolved",
  "alert.dismissed": "Alert dismissed",
  "comparison.created": "Comparison created",
  "comparison.archived": "Comparison archived",
  "comparison.annotated": "Note added",
  "schedule.created": "Schedule created",
  "schedule.updated": "Schedule saved",
  "schedule.paused": "Schedule paused",
  "schedule.resumed": "Schedule resumed",
  "schedule.cancelled": "Schedule cancelled",
  "schedule.duplicated": "Schedule duplicated",
  "prompt.created": "Prompt created",
  "prompt.updated": "Prompt saved",
  "report.generated": "Report generated",
  "website.created": "Website added",
  "website.updated": "Website saved",
  "audit.started": "Audit started",
  "audit.paused": "Audit paused",
  "audit.resumed": "Audit resumed",
  "audit.completed": "Audit completed",
  "audit.cancelled": "Audit cancelled",
  "member.invited": "Invite created",
  "member.updated": "Member updated",
  "settings.saved": "Settings saved",
  reset: "Demo data reset",
} as const satisfies Record<string, string>;

export type SimulatedKind = keyof typeof MESSAGES;

/**
 * `simulatedToast("task.approved")` -> { title: "Task approved (simulated)", tone: "success" }.
 * Pass any other string to use it as the label: `simulatedToast("CSV prepared")`.
 * Pass the result straight to `useToast().push(...)`.
 */
export function simulatedToast(kind: SimulatedKind | (string & {}), tone: SimulatedTone = "success"): SimulatedToast {
  const label = Object.hasOwn(MESSAGES, kind) ? MESSAGES[kind as SimulatedKind] : kind;
  return { title: kind === "reset" ? label : `${label} (simulated)`, tone };
}
