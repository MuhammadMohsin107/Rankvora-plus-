import { SimulatedBadge } from "@/components/ui/demo";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import type { ExecutionMode, ExecutionRecord, TaskStatus } from "@/types/fixes";

import { lifecycleOf } from "./fixes-logic";

type StepState = "done" | "pending" | "na" | "failed" | "partial" | "reverted" | "waiting";

const VIEW: Record<StepState, { text: string; icon: IconName; tone: string }> = {
  done: { text: "Done", icon: "check-circle", tone: "text-success-icon" },
  pending: { text: "Not yet", icon: "circle", tone: "text-fg-faint" },
  waiting: { text: "Pending", icon: "clock", tone: "text-warning-icon" },
  na: { text: "Not applicable", icon: "minus-circle", tone: "text-fg-faint" },
  failed: { text: "Failed", icon: "x-circle", tone: "text-danger-icon" },
  partial: { text: "Partly", icon: "alert-triangle", tone: "text-warning-icon" },
  reverted: { text: "Rolled back", icon: "undo", tone: "text-fg-subtle" },
};

type Step = { id: string; label: string; state: StepState; at: string | null };

/**
 * The four separate states of a fix: completed, applied, published, verified. Applied is never verified.
 * A single compact row of four steps.
 */
export function LifecycleTracker({ status, mode, execution }: { status: TaskStatus; mode: ExecutionMode; execution: ExecutionRecord }) {
  const life = lifecycleOf(status);
  const rolledBack = status === "rolled_back";
  const writeFailed = status === "failed" && Boolean(execution.failure);
  const noPublishStep = mode === "guidance" || mode === "ai_draft";
  const appliedDone = Boolean(execution.appliedAt) || life.applied;

  const steps: Step[] = [
    { id: "completed", label: "Completed", state: execution.completedAt || life.completed ? "done" : "pending", at: execution.completedAt },
    { id: "applied", label: "Applied", state: writeFailed ? "failed" : rolledBack && execution.appliedAt ? "reverted" : appliedDone ? "done" : "pending", at: writeFailed ? (execution.failure?.at ?? null) : execution.appliedAt },
    { id: "published", label: "Published", state: noPublishStep ? "na" : writeFailed ? "pending" : rolledBack && execution.publishedAt ? "reverted" : execution.publishedAt || life.published ? "done" : "pending", at: execution.publishedAt },
    {
      id: "verified",
      label: "Verified",
      state: status === "verified_success" ? "done" : status === "partially_verified" ? "partial" : status === "verification_pending" ? "waiting" : status === "failed" && !writeFailed ? "failed" : rolledBack ? "na" : "pending",
      at: null,
    },
  ];

  const anyDone = steps.some((step) => step.state !== "pending" && step.state !== "na");

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
    <ol aria-label="Lifecycle: completed, applied, published, verified" className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {steps.map((step) => {
        const view = VIEW[step.state];
        return (
          <li key={step.id} className="flex min-w-0 items-center gap-2">
            <Icon name={view.icon} size={18} className={cn("shrink-0", view.tone)} />
            <div className="min-w-0">
              <p className="text-label font-medium text-fg">{step.label}</p>
              <p className="tnum truncate text-helper text-fg-muted">
                {view.text}
                {step.at && step.state !== "na" ? ` · ${formatShortDate(step.at)}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
    {anyDone ? <SimulatedBadge className="self-start" /> : null}
    </div>
  );
}
