/** Fixes history: local demo events turned into history entries. Pure. */
import type { HistoryEvent, HistoryKind } from "@/types/fixes";

const SEPARATOR = " · ";

/** Event label for the demo-state log: "Title" or "Title · detail". */
export function eventLabel(title: string, detail?: string): string {
  return detail ? `${title}${SEPARATOR}${detail}` : title;
}

export function splitLabel(label: string): { title: string; detail?: string } {
  const at = label.indexOf(SEPARATOR);
  return at < 0 ? { title: label } : { title: label.slice(0, at), detail: label.slice(at + SEPARATOR.length) };
}

type EventLike = { id: string; at: string; kind: string; label: string };

export function historyKindOf(event: Pick<EventLike, "kind" | "label">): HistoryKind {
  switch (event.kind) {
    case "task.created":
      return "created";
    case "task.approved":
    case "task.rejected":
      return "approval";
    case "task.applied":
    case "task.published":
      return "execution";
    case "task.verified":
      return "verification";
    case "task.rolled_back":
      return "rollback";
    default: {
      const title = event.label.toLowerCase();
      if (title.startsWith("draft") || title.startsWith("patch") || title.startsWith("batch") || title.startsWith("redrafted") || title.startsWith("excluded") || title.startsWith("included")) return "draft";
      if (title.startsWith("approval")) return "approval";
      if (title.startsWith("remote") || title.startsWith("queued") || title.startsWith("staged")) return "execution";
      return "status";
    }
  }
}

export function toHistoryEvent(event: EventLike, actor: string): HistoryEvent {
  const { title, detail } = splitLabel(event.label);
  return { id: event.id, at: event.at, actor, kind: historyKindOf(event), title, detail };
}
