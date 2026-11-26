"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";

import { simulatedToast } from "./copy";
import { applyOverlay } from "./merge";
import { eventsFor, isAlertUnread, unreadAlertCount, type AlertLike, type EventFilter } from "./selectors";
import { countChanges } from "./state";
import { demoStore, type DemoStore, type EventArg } from "./store";
import type { CollectionKind, CollectionOverlay, DemoEvent, DemoMarker, DemoRow, DemoStateV1, DemoUi } from "./types";

type Ctx = { store: DemoStore; onReset?: () => void };
const DemoContext = createContext<Ctx>({ store: demoStore });

/** Mount once in the root layout, inside ToastProvider. Hooks also work without it (they fall back to the app store). */
export function DemoStateProvider({ children, store = demoStore }: { children: ReactNode; store?: DemoStore }) {
  const toast = useToast();
  const push = toast.push;
  const onReset = useCallback(() => push(simulatedToast("reset", "info")), [push]);
  const value = useMemo<Ctx>(() => ({ store, onReset }), [store, onReset]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

function useStore(): DemoStore {
  return useContext(DemoContext).store;
}

function useSnapshot(store: DemoStore): DemoStateV1 {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}

const defaultIdOf = (row: { id: string }) => row.id;

/** What create() accepts: the row without `id` (an id is assigned unless you pass one). */
export type DemoDraft<T> = Omit<T, "id"> & { id?: string };

export type DemoCollection<T> = {
  /** Static rows merged with local changes. Equals `baseRows` until something changes. */
  rows: T[];
  /** Adds a row (stamped simulated + origin "local-demo"). Optional event is emitted in the same update. */
  create(row: DemoDraft<T>, event?: EventArg<T & DemoMarker>): T & DemoMarker;
  /** Merges fields into a base or created row. Optional event is emitted in the same update. */
  update(id: string, patch: Partial<T>, event?: EventArg<string>): void;
  /** Hides a base row, or deletes a created one. */
  remove(id: string, event?: EventArg<string>): void;
  isDemoCreated(id: string): boolean;
};

/**
 * Overlay one collection on static rows. Rows must be JSON-serialisable and have a string `id`.
 * Pass a module-level `idOf` (or omit it to use `row.id`) so the merge result stays memoised.
 */
export function useDemoCollection<T extends { id: string }>(
  kind: CollectionKind,
  baseRows: readonly T[],
  idOf: (row: T) => string = defaultIdOf,
): DemoCollection<T> {
  const store = useStore();
  const overlay = useSnapshot(store)[kind] as unknown as CollectionOverlay<T>;
  const rows = useMemo(() => applyOverlay(baseRows, overlay, idOf), [baseRows, overlay, idOf]);
  const isDemoCreated = useCallback((id: string) => overlay.created.some((r) => r.id === id), [overlay]);
  const create = useCallback(
    (row: DemoDraft<T>, event?: EventArg<T & DemoMarker>) =>
      store.create(kind, row as Record<string, unknown>, event as EventArg<DemoRow> | undefined) as unknown as T & DemoMarker,
    [store, kind],
  );
  const update = useCallback(
    (id: string, patch: Partial<T>, event?: EventArg<string>) => store.update(kind, id, patch as Record<string, unknown>, event),
    [store, kind],
  );
  const remove = useCallback((id: string, event?: EventArg<string>) => store.remove(kind, id, event), [store, kind]);
  return { rows, create, update, remove, isDemoCreated };
}

export type DemoSetting<T> = {
  /** Saved value (objects are shallow-merged over `base`) or `base`. */
  value: T;
  save(value: T, event?: EventArg<string>): void;
  patch(partial: Partial<T>, event?: EventArg<string>): void;
  /** Forget the saved value and fall back to `base`. */
  clear(): void;
  isSaved: boolean;
};

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** One saved settings value by key (for example "org.notifications", "website.runpro-pk.profile"). Keep `base` stable. */
export function useDemoSettings<T>(key: string, base: T): DemoSetting<T> {
  const store = useStore();
  const settings = useSnapshot(store).settings;
  const saved = Object.hasOwn(settings, key) ? (settings[key] as T) : undefined;
  const isSaved = saved !== undefined;
  const value = useMemo<T>(() => (isSaved && isPlain(base) && isPlain(saved) ? ({ ...base, ...saved } as T) : isSaved ? (saved as T) : base), [base, saved, isSaved]);
  const save = useCallback((next: T, event?: EventArg<string>) => store.setSetting(key, next, event), [store, key]);
  const patch = useCallback(
    (partial: Partial<T>, event?: EventArg<string>) => {
      const current = store.getSnapshot().settings[key];
      store.setSetting(key, { ...(isPlain(current) ? current : {}), ...partial }, event);
    },
    [store, key],
  );
  const clear = useCallback(() => store.clearSetting(key), [store, key]);
  return { value, save, patch, clear, isSaved };
}

/** Evidence events, oldest first, optionally filtered, for example `useDemoEvents({ taskId })`. */
export function useDemoEvents(filter?: EventFilter): DemoEvent[] {
  const events = useSnapshot(useStore()).events;
  const filterKey = filter ? JSON.stringify(filter) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey is the serialised filter
  return useMemo(() => (filter ? eventsFor(events, filter) : events), [events, filterKey]);
}

export type DemoUiApi = {
  ui: DemoUi;
  setUi(patch: Partial<DemoUi>): void;
  toggleSidebar(): void;
  setLastWebsite(id: string | null): void;
  dismissBanner(id: string): void;
  isBannerDismissed(id: string): boolean;
};

/** Small UI memory: sidebar collapse, last website, dismissed banners. */
export function useDemoUi(): DemoUiApi {
  const store = useStore();
  const ui = useSnapshot(store).ui;
  const setUi = useCallback((patch: Partial<DemoUi>) => store.setUi(patch), [store]);
  const toggleSidebar = useCallback(() => store.setUi({ sidebarCollapsed: !store.getSnapshot().ui.sidebarCollapsed }), [store]);
  const setLastWebsite = useCallback((id: string | null) => store.setUi({ lastWebsiteId: id }), [store]);
  const dismissBanner = useCallback(
    (id: string) => {
      const list = store.getSnapshot().ui.dismissedBanners;
      if (!list.includes(id)) store.setUi({ dismissedBanners: [...list, id] });
    },
    [store],
  );
  const isBannerDismissed = useCallback((id: string) => ui.dismissedBanners.includes(id), [ui]);
  return { ui, setUi, toggleSidebar, setLastWebsite, dismissBanner, isBannerDismissed };
}

/** Returns a handler that clears all local demo changes and shows a toast. */
export function useDemoReset(): () => void {
  const { store, onReset } = useContext(DemoContext);
  return useCallback(() => {
    store.reset();
    onReset?.();
  }, [store, onReset]);
}

export type DemoMeta = { hasChanges: boolean; changeCount: number; eventCount: number };

/** Whether anything differs from the static demo data (drives "Reset demo data" visibility). */
export function useDemoMeta(): DemoMeta {
  const state = useSnapshot(useStore());
  return useMemo(() => {
    const changeCount = countChanges(state);
    return { hasChanges: changeCount > 0 || state.events.length > 0, changeCount, eventCount: state.events.length };
  }, [state]);
}

export type DemoAlerts<T extends AlertLike> = {
  rows: T[];
  /** Shared definition of unread (see isAlertUnread). */
  unreadCount: number;
  markRead(id: string): void;
  markUnread(id: string): void;
  markAllRead(): void;
  acknowledge(id: string): void;
  mute(id: string): void;
  resolve(id: string): void;
  /** Hides the alert everywhere. */
  dismiss(id: string): void;
};

/**
 * Alert state for the bell, Monitoring Alerts tab, sidebar badge and dashboard.
 * Key rows by the headline id (al-001, ...). All consumers must call this with the same ids.
 */
export function useDemoAlerts<T extends AlertLike>(baseAlerts: readonly T[], websiteId?: string): DemoAlerts<T> {
  const { rows, update, remove } = useDemoCollection<T>("alerts", baseAlerts);
  const unreadCount = useMemo(
    () => rows.filter((a) => (websiteId === undefined || a.storeId === undefined || a.storeId === websiteId) && isAlertUnread(a)).length,
    [rows, websiteId],
  );
  const ref = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id);
      return { alertId: id, websiteId: row?.storeId ?? websiteId };
    },
    [rows, websiteId],
  );
  const patch = useCallback((id: string, p: { read: boolean; status: string }) => update(id, p as unknown as Partial<T>), [update]);
  const withEvent = useCallback(
    (id: string, p: { read: boolean; status: string }, kind: "alert.read" | "alert.acknowledged" | "alert.muted" | "alert.resolved", label: string) =>
      update(id, p as unknown as Partial<T>, { kind, label, refs: ref(id) }),
    [update, ref],
  );
  return {
    rows,
    unreadCount,
    markRead: (id) => withEvent(id, { read: true, status: "read" }, "alert.read", "Alert marked read"),
    markUnread: (id) => patch(id, { read: false, status: "new" }),
    markAllRead: () => {
      for (const a of rows) if (isAlertUnread(a)) patch(a.id, { read: true, status: "read" });
    },
    acknowledge: (id) => withEvent(id, { read: true, status: "acknowledged" }, "alert.acknowledged", "Alert acknowledged"),
    mute: (id) => withEvent(id, { read: true, status: "muted" }, "alert.muted", "Alert muted"),
    resolve: (id) => withEvent(id, { read: true, status: "resolved" }, "alert.resolved", "Alert resolved"),
    dismiss: (id) => remove(id, { kind: "alert.dismissed", label: "Alert dismissed", refs: ref(id) }),
  };
}

/** Unread alert count only (for components that just show a badge). */
export function useUnreadAlertCount<T extends AlertLike>(baseAlerts: readonly T[], websiteId?: string): number {
  const overlay = useSnapshot(useStore()).alerts as unknown as CollectionOverlay<T>;
  return useMemo(() => unreadAlertCount(baseAlerts, overlay, websiteId), [baseAlerts, overlay, websiteId]);
}
