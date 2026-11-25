import type { Store } from "@/types/core";

/**
 * Websites created in the browser get ids from the demo-state layer: `demo-websites-<n>`.
 * The server cannot know them, so `/stores/[storeId]` hands those ids to a client view that
 * looks them up in demo-state (see features/stores/local-website.tsx).
 */
export const LOCAL_WEBSITE_PREFIX = "demo-";

export function isLocalWebsiteId(id: string): boolean {
  return id.startsWith(LOCAL_WEBSITE_PREFIX);
}

/** A seeded website wins over a locally created one with the same id (ids never collide in practice). */
export function resolveWebsite(id: string, seeded: readonly Store[], local: readonly Store[]): Store | null {
  return seeded.find((w) => w.id === id) ?? local.find((w) => w.id === id) ?? null;
}

export type WebsiteAction = { label: string; href: string; reason: string };

/** The ONE next step for a website, shown on its card and in the list. */
export function nextWebsiteAction(store: Store, counts: { unreadAlerts?: number; pendingTasks?: number } = {}): WebsiteAction {
  const base = `/stores/${store.id}`;
  if (store.status === "archived") return { label: "Restore", href: `${base}/settings`, reason: "Archived" };
  if (store.status === "paused") return { label: "Resume", href: `${base}/settings`, reason: "Paused" };
  if (!store.summary) {
    const reason = store.channelIds.length === 0 ? "Choose AI channels" : "Run a first audit";
    return { label: store.channelIds.length === 0 ? "Finish setup" : "Start audit", href: store.channelIds.length === 0 ? `${base}/settings` : `${base}/audits/new`, reason };
  }
  const alerts = counts.unreadAlerts ?? store.summary.openAlerts;
  const tasks = counts.pendingTasks ?? store.summary.pendingTasks;
  if (alerts > 0) return { label: "Review alerts", href: `${base}/monitoring/alerts`, reason: `${alerts} unread ${alerts === 1 ? "alert" : "alerts"}` };
  if (tasks > 0) return { label: "Review fixes", href: `${base}/fixes/tasks`, reason: `${tasks} open ${tasks === 1 ? "task" : "tasks"}` };
  return { label: "Open dashboard", href: base, reason: "Nothing needs attention" };
}

/** Short setup line for websites without tracking data. Never a rate. */
export function untrackedReason(store: Pick<Store, "channelIds" | "status">): string {
  if (store.channelIds.length === 0) return "No AI channel selected";
  return "No runs yet";
}
