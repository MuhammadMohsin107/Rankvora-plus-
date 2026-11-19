import type { IconName } from "@/components/ui/icon";
import { STATUS } from "@/lib/status";
import type { StoreStatus } from "@/types/core";

/** Allowed store status transitions (vocabulary from the specification). */
export const ALLOWED_TRANSITIONS: Record<StoreStatus, StoreStatus[]> = {
  draft: ["ready", "archived"],
  needs_review: ["ready", "archived"],
  ready: ["active", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  disconnected: ["active", "archived"],
  archived: ["paused"],
};

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

export function transitionCopy(from: StoreStatus, to: StoreStatus, storeName: string): TransitionCopy {
  if (to === "ready") {
    return {
      label: "Mark ready",
      icon: "check-circle",
      confirmTitle: `Mark ${storeName} ready?`,
      effect: "Marks setup as complete. Tracking stays off until you activate the store.",
      confirmLabel: "Mark ready",
      tone: "primary",
      toastTitle: `${storeName} is ready`,
    };
  }
  if (to === "active") {
    const resume = from === "paused";
    return {
      label: resume ? "Resume" : "Activate",
      icon: "play",
      confirmTitle: `${resume ? "Resume" : "Activate"} ${storeName}?`,
      effect: "Scheduled monitoring runs resume at their next scheduled time. Prompts and history are unchanged.",
      confirmLabel: resume ? "Resume" : "Activate",
      tone: "primary",
      toastTitle: `${storeName} is active`,
    };
  }
  if (to === "paused") {
    const restore = from === "archived";
    return {
      label: restore ? "Restore" : "Pause",
      icon: restore ? "undo" : "pause",
      confirmTitle: `${restore ? "Restore" : "Pause"} ${storeName}?`,
      effect: restore
        ? "Makes the store editable again. It stays paused until you resume it."
        : "Scheduled runs stop. Prompts, results and reports are kept. You can resume at any time.",
      confirmLabel: restore ? "Restore" : "Pause store",
      tone: restore ? "primary" : "danger",
      toastTitle: restore ? `${storeName} restored` : `${storeName} paused`,
    };
  }
  if (to === "archived") {
    return {
      label: "Archive",
      icon: "minus-circle",
      confirmTitle: `Archive ${storeName}?`,
      effect: "The store becomes read-only and leaves the store switcher. Schedules are cancelled. Results and reports are kept, and you can restore it later.",
      confirmLabel: "Archive store",
      tone: "danger",
      toastTitle: `${storeName} archived`,
    };
  }
  return {
    label: STATUS.store[to].label,
    icon: STATUS.store[to].icon,
    confirmTitle: `Change ${storeName} to ${STATUS.store[to].label}?`,
    effect: "Updates the store status.",
    confirmLabel: "Confirm",
    tone: "primary",
    toastTitle: `${storeName} is ${STATUS.store[to].label.toLowerCase()}`,
  };
}
