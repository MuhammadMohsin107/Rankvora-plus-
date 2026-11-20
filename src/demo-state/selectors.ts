import { applyOverlay } from "./merge";
import type { CollectionOverlay, DemoEvent, DemoEventKind, DemoEventRefs } from "./types";

export type EventFilter = DemoEventRefs & {
  kinds?: readonly DemoEventKind[];
  /** "all" (default): every given ref must match. "any": at least one. */
  match?: "all" | "any";
  /** Keep only the most recent n events. */
  limit?: number;
};

const REF_KEYS = [
  "findingId",
  "taskId",
  "runId",
  "alertId",
  "comparisonId",
  "promptId",
  "websiteId",
  "scheduleId",
  "auditId",
  "reportId",
] as const satisfies readonly (keyof DemoEventRefs)[];

/** Events (oldest first) matching the given refs, for example `eventsFor(events, { taskId })`. */
export function eventsFor(events: readonly DemoEvent[], filter: EventFilter = {}): DemoEvent[] {
  const wanted = REF_KEYS.filter((k) => filter[k] !== undefined);
  const mode = filter.match ?? "all";
  let out = events.filter((e) => {
    if (filter.kinds && !filter.kinds.includes(e.kind)) return false;
    if (wanted.length === 0) return true;
    const test = (k: (typeof REF_KEYS)[number]) => e.refs[k] === filter[k];
    return mode === "all" ? wanted.every(test) : wanted.some(test);
  });
  if (filter.limit !== undefined) out = out.slice(-filter.limit);
  return out;
}

/** The part of an alert row the unread rule needs. Headline rows have `read`; monitoring rows have `status`. */
export type AlertLike = { id: string; storeId?: string; read?: boolean; status?: string };

/**
 * THE unread definition, shared by the bell, the Monitoring tab badge, the sidebar badge and the dashboard.
 * When a row has a status, it is unread only while that status is "new".
 * Otherwise it is unread while `read` is false. Muted, resolved, acknowledged and dismissed rows are never unread.
 */
export function isAlertUnread(alert: Pick<AlertLike, "read" | "status">): boolean {
  if (alert.status !== undefined) return alert.status === "new";
  return alert.read === false;
}

/** Unread alert count after applying the local overlay. Pass `websiteId` to count one website. */
export function unreadAlertCount<T extends AlertLike>(
  baseAlerts: readonly T[],
  overlay: CollectionOverlay<T> | undefined,
  websiteId?: string,
  idOf: (alert: T) => string = (a) => a.id,
): number {
  let n = 0;
  for (const a of applyOverlay(baseAlerts, overlay, idOf)) {
    if (websiteId !== undefined && a.storeId !== undefined && a.storeId !== websiteId) continue;
    if (isAlertUnread(a)) n += 1;
  }
  return n;
}
