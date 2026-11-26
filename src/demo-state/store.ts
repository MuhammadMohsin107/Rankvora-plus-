import { MAX_EVENTS, createEmptyState, parseState } from "./state";
import {
  DEMO_STATE_KEY,
  type CollectionKind,
  type DemoEvent,
  type DemoEventInput,
  type DemoMarker,
  type DemoRow,
  type DemoStateV1,
  type DemoUi,
} from "./types";

/** Minimal Storage surface the store needs (localStorage satisfies it; tests pass a fake). */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Minimal window surface for cross-tab sync and flush-on-hide. */
export type EventTargetLike = {
  addEventListener(type: string, listener: (event: { key?: string | null }) => void): void;
  removeEventListener(type: string, listener: (event: { key?: string | null }) => void): void;
};

export type DemoStoreOptions = {
  /** Defaults to window.localStorage in the browser, none on the server. `null` disables persistence. */
  storage?: StorageLike | null;
  /** Defaults to window in the browser. */
  target?: EventTargetLike | null;
  key?: string;
  /** Clock for ids' timestamps and events. Only ever called from mutation functions. */
  now?: () => string;
  debounceMs?: number;
};

/** An event to emit together with a mutation (atomic: one notification, one write). */
export type EventArg<R> = DemoEventInput | ((result: R) => DemoEventInput);

export type DemoStore = {
  subscribe(listener: () => void): () => void;
  getSnapshot(): DemoStateV1;
  /** Always the empty overlay: SSR and the first client render equal the static demo data. */
  getServerSnapshot(): DemoStateV1;
  create(kind: CollectionKind, row: Record<string, unknown> & { id?: string }, event?: EventArg<DemoRow>): DemoRow;
  update(kind: CollectionKind, id: string, patch: Record<string, unknown>, event?: EventArg<string>): void;
  remove(kind: CollectionKind, id: string, event?: EventArg<string>): void;
  setSetting(key: string, value: unknown, event?: EventArg<string>): void;
  clearSetting(key: string): void;
  emit(input: DemoEventInput): DemoEvent;
  nextId(kind: string): string;
  setUi(patch: Partial<DemoUi>): void;
  reset(): void;
  /** Replace the whole state (used by server sync) and persist it to storage immediately. */
  adopt(next: DemoStateV1): void;
  /** Called after every reset(). Used by server sync to delete the remote copy. Returns an unsubscribe function. */
  onReset(listener: () => void): () => void;
  /** Write pending changes now. */
  flush(): void;
  /** Re-read storage (used by the cross-tab `storage` event). */
  syncFromStorage(): void;
  now(): string;
};

/** Shared empty snapshot. Treated as immutable; every mutation builds a new object. */
export const EMPTY_STATE: DemoStateV1 = createEmptyState();

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // blocked storage access throws in some browsers
  }
}

export function createDemoStore(options: DemoStoreOptions = {}): DemoStore {
  const key = options.key ?? DEMO_STATE_KEY;
  const debounceMs = options.debounceMs ?? 150;
  const clock = options.now ?? (() => new Date().toISOString());
  const listeners = new Set<() => void>();
  const resetListeners = new Set<() => void>();

  let state: DemoStateV1 = EMPTY_STATE;
  let hydrated = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let dirty = false;
  let storage: StorageLike | null | undefined = options.storage; // undefined = resolve lazily on the client
  let target: EventTargetLike | null | undefined = options.target;

  const getStorage = (): StorageLike | null => {
    if (storage === undefined) storage = browserStorage();
    return storage;
  };
  const getTarget = (): EventTargetLike | null => {
    if (target === undefined) target = typeof window === "undefined" ? null : window;
    return target;
  };

  function readStored(): DemoStateV1 | null {
    const s = getStorage();
    if (!s) return null;
    let raw: string | null = null;
    try {
      raw = s.getItem(key);
    } catch {
      return null;
    }
    const parsed = parseState(raw);
    if (!parsed && raw !== null) {
      try {
        s.removeItem(key); // corrupt or foreign payload: discard
      } catch {}
    }
    return parsed;
  }

  function ensureHydrated() {
    if (hydrated || !getStorage()) return;
    hydrated = true;
    state = readStored() ?? EMPTY_STATE;
  }

  function notify() {
    for (const l of [...listeners]) l();
  }

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!dirty) return;
    dirty = false;
    const s = getStorage();
    if (!s) return;
    try {
      s.setItem(key, JSON.stringify(state));
    } catch {
      // Quota exceeded or private mode: keep working in memory only.
    }
  }

  function scheduleWrite() {
    dirty = true;
    if (!getStorage()) return;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  function commit(next: DemoStateV1) {
    if (next === state) return;
    state = next;
    scheduleWrite();
    notify();
  }

  function withEvent(s: DemoStateV1, input: DemoEventInput): { state: DemoStateV1; event: DemoEvent } {
    const seq = s.seq + 1;
    const event: DemoEvent = {
      id: `demo-evt-${seq}`,
      at: input.at ?? clock(),
      kind: input.kind,
      label: input.label,
      refs: { ...input.refs },
      simulated: true,
    };
    return { state: { ...s, seq, events: [...s.events, event].slice(-MAX_EVENTS) }, event };
  }

  const resolveEvent = <R,>(arg: EventArg<R> | undefined, result: R): DemoEventInput | null =>
    arg === undefined ? null : typeof arg === "function" ? arg(result) : arg;

  const onStorage = (event: { key?: string | null }) => {
    if (event.key === undefined || event.key === null || event.key === key) store.syncFromStorage();
  };
  const onHide = () => flush();

  const store: DemoStore = {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) {
        const t = getTarget();
        t?.addEventListener("storage", onStorage);
        t?.addEventListener("pagehide", onHide);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          const t = getTarget();
          t?.removeEventListener("storage", onStorage);
          t?.removeEventListener("pagehide", onHide);
        }
      };
    },

    getSnapshot() {
      ensureHydrated();
      return state;
    },

    getServerSnapshot() {
      return EMPTY_STATE;
    },

    create(kind, row, event) {
      ensureHydrated();
      let seq = state.seq;
      const id = row.id ?? `demo-${kind}-${++seq}`;
      const marker: DemoMarker = { simulated: true, origin: "local-demo" };
      const created = { ...row, ...marker, id } as DemoRow;
      const overlay = state[kind];
      let next: DemoStateV1 = {
        ...state,
        seq,
        [kind]: { ...overlay, created: [...overlay.created.filter((r) => r.id !== id), created] },
      };
      const ev = resolveEvent(event, created);
      if (ev) next = withEvent(next, ev).state;
      commit(next);
      return created;
    },

    update(kind, id, patch, event) {
      ensureHydrated();
      const overlay = state[kind];
      const previous = Object.hasOwn(overlay.patched, id) ? overlay.patched[id] : undefined;
      let next: DemoStateV1 = {
        ...state,
        [kind]: { ...overlay, patched: { ...overlay.patched, [id]: { ...previous, ...patch } } },
      };
      const ev = resolveEvent(event, id);
      if (ev) next = withEvent(next, ev).state;
      commit(next);
    },

    remove(kind, id, event) {
      ensureHydrated();
      const overlay = state[kind];
      const wasCreated = overlay.created.some((r) => r.id === id);
      const patched = { ...overlay.patched };
      delete patched[id];
      let next: DemoStateV1 = {
        ...state,
        [kind]: {
          created: overlay.created.filter((r) => r.id !== id),
          patched,
          removed: wasCreated || overlay.removed.includes(id) ? overlay.removed : [...overlay.removed, id],
        },
      };
      const ev = resolveEvent(event, id);
      if (ev) next = withEvent(next, ev).state;
      commit(next);
    },

    setSetting(settingKey, value, event) {
      ensureHydrated();
      let next: DemoStateV1 = { ...state, settings: { ...state.settings, [settingKey]: value } };
      const ev = resolveEvent(event, settingKey);
      if (ev) next = withEvent(next, ev).state;
      commit(next);
    },

    clearSetting(settingKey) {
      ensureHydrated();
      if (!Object.hasOwn(state.settings, settingKey)) return;
      const settings = { ...state.settings };
      delete settings[settingKey];
      commit({ ...state, settings });
    },

    emit(input) {
      ensureHydrated();
      const { state: next, event } = withEvent(state, input);
      commit(next);
      return event;
    },

    nextId(kind) {
      ensureHydrated();
      const seq = state.seq + 1;
      commit({ ...state, seq });
      return `demo-${kind}-${seq}`;
    },

    setUi(patch) {
      ensureHydrated();
      commit({ ...state, ui: { ...state.ui, ...patch } });
    },

    reset() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = false;
      hydrated = true;
      const s = getStorage();
      if (s) {
        try {
          s.removeItem(key);
        } catch {}
      }
      state = EMPTY_STATE;
      notify();
      for (const l of [...resetListeners]) l();
    },

    adopt(next) {
      hydrated = true;
      state = next;
      dirty = true;
      flush();
      notify();
    },

    onReset(listener) {
      resetListeners.add(listener);
      return () => {
        resetListeners.delete(listener);
      };
    },

    flush,

    syncFromStorage() {
      if (!getStorage()) return;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      dirty = false;
      hydrated = true;
      const incoming = readStored() ?? EMPTY_STATE;
      state = incoming;
      notify();
    },

    now: clock,
  };

  return store;
}

/** The app-wide store. Safe to import on the server: it only touches localStorage in the browser. */
export const demoStore: DemoStore = createDemoStore();

/** Append an evidence event. Call from event handlers only. */
export function emit(input: DemoEventInput): DemoEvent {
  return demoStore.emit(input);
}

/** Clear every local demo change (storage key and memory). Exported for the profile menu and Settings. */
export function resetDemoData(): void {
  demoStore.reset();
}

/** Handler-side clock: ISO timestamp for "now". Never call during render. */
export function demoNow(): string {
  return demoStore.now();
}
