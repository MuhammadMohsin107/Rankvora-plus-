import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { ExecutionMode, ExecutionRecord, TaskStatus } from "@/types/fixes";

type StepState = "done" | "pending" | "na" | "failed" | "partial" | "reverted";

const STATE_VIEW: Record<StepState, { text: string; icon: IconName; tone: string; ring: string }> = {
  done: { text: "Done", icon: "check-circle", tone: "text-success", ring: "border-success/30 bg-success-soft/50" },
  pending: { text: "Not yet", icon: "circle", tone: "text-fg-subtle", ring: "border-line bg-surface" },
  na: { text: "Not applicable", icon: "minus-circle", tone: "text-fg-subtle", ring: "border-line bg-surface-2/50" },
  failed: { text: "Failed", icon: "x-circle", tone: "text-danger", ring: "border-danger/30 bg-danger-soft/50" },
  partial: { text: "Partly verified", icon: "alert-triangle", tone: "text-warning", ring: "border-warning/30 bg-warning-soft/50" },
  reverted: { text: "Rolled back", icon: "undo", tone: "text-fg-muted", ring: "border-line-strong bg-surface-2/60" },
};

const WORK_DONE: ReadonlySet<TaskStatus> = new Set(["draft_ready", "staged", "applied", "published", "verification_pending", "verified_success", "partially_verified", "failed", "rolled_back"]);
const APPLIED: ReadonlySet<TaskStatus> = new Set(["applied", "published", "verification_pending", "verified_success", "partially_verified"]);

type Step = { id: string; label: string; hint: string; state: StepState; at: string | null };

/** The four separate states of a fix: completed, applied, published, verified. Applied is never verified. */
export function LifecycleTracker({ status, mode, execution }: { status: TaskStatus; mode: ExecutionMode; execution: ExecutionRecord }) {
  const rolledBack = status === "rolled_back";
  const appliedDone = Boolean(execution.appliedAt) || APPLIED.has(status);
  const publishedDone = Boolean(execution.publishedAt) || status === "published" || status === "verification_pending" || status === "verified_success";
  const noPublishStep = mode === "guidance" || mode === "ai_draft";

  const steps: Step[] = [
    {
      id: "completed",
      label: "Completed",
      hint: "Work or draft finished",
      state: execution.completedAt || WORK_DONE.has(status) ? "done" : "pending",
      at: execution.completedAt,
    },
    {
      id: "applied",
      label: "Applied",
      hint: "Change written or done",
      state: rolledBack && execution.appliedAt ? "reverted" : appliedDone ? "done" : "pending",
      at: execution.appliedAt,
    },
    {
      id: "published",
      label: "Published",
      hint: "Live to visitors",
      state: noPublishStep ? "na" : rolledBack && execution.publishedAt ? "reverted" : publishedDone ? "done" : "pending",
      at: execution.publishedAt,
    },
    {
      id: "verified",
      label: "Verified",
      hint: "Re-check passed",
      state: status === "verified_success" ? "done" : status === "partially_verified" ? "partial" : status === "failed" ? "failed" : rolledBack ? "na" : "pending",
      at: null,
    },
  ];

  return (
    <Card>
      <CardHeader title="Lifecycle" info="Four separate states. Applied or published does not mean verified." />
      <CardBody className="pt-3">
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => {
            const view = STATE_VIEW[step.state];
            const verifiedPending = step.id === "verified" && status === "verification_pending";
            return (
              <li key={step.id} title={step.hint} className={cn("flex items-start gap-2.5 rounded-control border px-3 py-2.5", view.ring)}>
                <Icon name={verifiedPending ? "clock" : view.icon} size={18} className={cn("mt-0.5 shrink-0", verifiedPending ? "text-warning" : view.tone)} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-fg">{step.label}</p>
                  <p className="text-xs text-fg-muted">{verifiedPending ? "Pending" : view.text}</p>
                  {step.at && step.state !== "na" ? <p className="tnum mt-0.5 text-xs text-fg-subtle">{formatDateTime(step.at)}</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
