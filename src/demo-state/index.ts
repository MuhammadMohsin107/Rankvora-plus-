/**
 * Local demo-state layer. No backend: changes are stored in this browser (localStorage key
 * `rankvora-demo-state:v1`) and layered over the static demo data. Server pages keep reading the
 * static data; client components read the merged rows through these hooks. Never store secrets.
 *
 * Collections: websites, prompts, findings, tasks, schedules, runs, alerts, comparisons, reports,
 * members, audits (see COLLECTION_KINDS). Rows must be JSON, have a string `id`, use ISO date strings.
 *
 * Hooks (client components only)
 *   useDemoCollection<T>(kind, baseRows, idOf?)  -> { rows, create(row, event?), update(id, patch, event?),
 *                                                      remove(id, event?), isDemoCreated(id) }
 *   useDemoSettings<T>(key, base)                -> { value, save, patch, clear, isSaved }
 *   useDemoEvents(filter?)                       -> DemoEvent[] (oldest first; filter = refs + kinds)
 *   useDemoAlerts(baseAlerts, websiteId?)        -> { rows, unreadCount, markRead, markUnread, markAllRead,
 *                                                      acknowledge, mute, resolve, dismiss }
 *   useUnreadAlertCount(baseAlerts, websiteId?)  -> number (same definition everywhere: isAlertUnread)
 *   useDemoUi()                                  -> { ui, toggleSidebar, setLastWebsite, dismissBanner, ... }
 *   useDemoReset()                               -> () => void (clears everything, toasts "Demo data reset")
 *   useDemoMeta()                                -> { hasChanges, changeCount, eventCount }
 *
 * Plain functions (call from event handlers only, never during render)
 *   emit(event), resetDemoData(), demoNow(), eventsFor(events, filter), unreadAlertCount(...),
 *   simulatedToast(kind | label) -> { title: "Task approved (simulated)", tone }
 *
 * Rules
 *   - Mutations run in handlers. Ids are `demo-<kind>-<n>` from a persisted counter; every created
 *     row carries `simulated: true` and `origin: "local-demo"`; every event carries `simulated: true`.
 *   - Pass an event as the last argument of create/update/remove so the change and its evidence
 *     event are one atomic update: `update(id, { status: "approved" }, { kind: "task.approved",
 *     label: "Task approved", refs: { taskId: id, findingId, websiteId } })`.
 *   - First render (SSR and hydration) always equals the static data; local changes appear right after.
 *   - Toasts must say what changed locally: `push(simulatedToast("task.approved"))`.
 */
export * from "./types";
export { applyOverlay, overlayChangeCount } from "./merge";
export { createEmptyState, countChanges, migrateState, parseState, MAX_EVENTS } from "./state";
export {
  createDemoStore,
  demoStore,
  demoNow,
  emit,
  resetDemoData,
  EMPTY_STATE,
  type DemoStore,
  type DemoStoreOptions,
  type EventArg,
  type StorageLike,
} from "./store";
export { eventsFor, isAlertUnread, unreadAlertCount, type AlertLike, type EventFilter } from "./selectors";
export { simulatedToast, type SimulatedKind, type SimulatedToast, type SimulatedTone } from "./copy";
export {
  DemoStateProvider,
  useDemoAlerts,
  useDemoCollection,
  useDemoEvents,
  useDemoMeta,
  useDemoReset,
  useDemoSettings,
  useDemoUi,
  useUnreadAlertCount,
  type DemoAlerts,
  type DemoCollection,
  type DemoDraft,
  type DemoMeta,
  type DemoSetting,
  type DemoUiApi,
} from "./provider";
