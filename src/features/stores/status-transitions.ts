import type { IconName } from "@/components/ui/icon";
import { STATUS } from "@/lib/status";
import type { StoreStatus } from "@/types/core";

// The allowed website status transitions live in docs/backend/backend-plan.md section 3.9;
// the backend will enforce them. Nothing here reads a transition table today.

export type TransitionCopy = {
  /** Menu / button label. */
  label: string;
  icon: IconName;
  confirmTitle: string;
  /** Exact effect, shown in the confirm dialog. */
  effect: string;
  confirmLabel: string;
  tone: "primary" | "danger";
  toastTitle: string;
};

export function transitionCopy(from: StoreStatus, to: StoreStatus, websiteName: string): TransitionCopy {
  if (to === "ready") {
    return {
      label: "Mark ready",
      icon: "check-circle",
      confirmTitle: `Mark ${websiteName} ready?`,
      effect: "Marks setup as complete. Tracking stays off until you activate the website.",
      confirmLabel: "Mark ready",
      tone: "primary",
      toastTitle: `${websiteName} is ready`,
    };
  }
  if (to === "active") {
    const resume = from === "paused";
    return {
      label: resume ? "Resume" : "Activate",
      icon: "play",
      confirmTitle: `${resume ? "Resume" : "Activate"} ${websiteName}?`,
      effect: "Scheduled monitoring runs resume at their next scheduled time. Prompts and history are unchanged.",
      confirmLabel: resume ? "Resume" : "Activate",
      tone: "primary",
      toastTitle: `${websiteName} is active`,
    };
  }
  if (to === "paused") {
    const restore = from === "archived";
    return {
      label: restore ? "Restore" : "Pause",
      icon: restore ? "undo" : "pause",
      confirmTitle: `${restore ? "Restore" : "Pause"} ${websiteName}?`,
      effect: restore
        ? "Makes the website editable again. It stays paused until you resume it."
        : "Scheduled runs stop. Prompts, results and reports are kept. You can resume at any time.",
      confirmLabel: restore ? "Restore" : "Pause website",
      tone: restore ? "primary" : "danger",
      toastTitle: restore ? `${websiteName} restored` : `${websiteName} paused`,
    };
  }
  if (to === "archived") {
    return {
      label: "Archive",
      icon: "minus-circle",
      confirmTitle: `Archive ${websiteName}?`,
      effect: "The website becomes read-only and leaves the website selector. Schedules are cancelled. Results and reports are kept, and you can restore it later.",
      confirmLabel: "Archive website",
      tone: "danger",
      toastTitle: `${websiteName} archived`,
    };
  }
  return {
    label: STATUS.store[to].label,
    icon: STATUS.store[to].icon,
    confirmTitle: `Change ${websiteName} to ${STATUS.store[to].label}?`,
    effect: "Updates the website status.",
    confirmLabel: "Confirm",
    tone: "primary",
    toastTitle: `${websiteName} is ${STATUS.store[to].label.toLowerCase()}`,
  };
}
