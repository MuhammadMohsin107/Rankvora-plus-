import { migrateState } from "./state";
import { DEMO_STATE_KEY, type DemoStateV1 } from "./types";
import { EMPTY_STATE, demoStore, type DemoStore, type StorageLike } from "./store";

/**
 * Server sync for the demo state (Cloudflare D1 through /api/demo-state).
 *
 * localStorage stays the instant local copy; this layer mirrors it to the server in the background.
 *   - After hydrating, GET once. Server revision wins when it moved (adopt it). If it did not move and
 *     there are unsaved local changes, push them. An empty server gets the local state (if any).
 *   - Changes are pushed debounced (500 ms) with the revision the client last saw (optimistic check).
 *   - 409: adopt the server copy and carry on. Network/5xx failures: keep working from localStorage,
 *     status "offline", retry with backoff and when the browser comes back online.
 *   - resetDemoData() (store.reset) also sends DELETE; a failed DELETE is retried before anything else.
 * Framework-free (no React, no Next). Everything runs one network call at a time.
 */

export type SyncStatus = "local" | "syncing" | "synced" | "offline";
export type SyncSnapshot = { status: SyncStatus; lastSyncedAt: string | null };

type EventsTarget = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
};

export type DemoSyncOptions = {
  fetch?: typeof fetch;
  url?: string;
  /** Where the sync bookkeeping (revision, dirty flag) lives. Defaults to localStorage in the browser. */
  storage?: StorageLike | null;
  metaKey?: string;
  debounceMs?: number;
  /** Retry delays after a failure, last one repeats. */
  retryDelaysMs?: number[];
  now?: () => string;
  /** Source of `online` / `pagehide` events. Defaults to window. */
  target?: EventsTarget | null;
};

export type DemoSync = {
  /** Begin syncing (browser only, call from an effect). Returns a stop function. */
  start(): () => void;
  getSnapshot(): SyncSnapshot;
  getServerSnapshot(): SyncSnapshot;
  subscribe(listener: () => void): () => void;
  /** Push pending local changes now and resolve when the network work queue is idle. */
  flush(): Promise<void>;
};

export const SYNC_URL = "/api/demo-state";
const LOCAL: SyncSnapshot = { status: "local", lastSyncedAt: null };
const DEFAULT_RETRY_MS = [5_000, 15_000, 60_000, 300_000];

type Meta = { revision: number; dirty: boolean; pendingReset: boolean; lastSyncedAt: string | null };
type Reply =
  | { kind: "ok"; status: number; body: Record<string, unknown> | null }
  | { kind: "offline" } // network failure or 5xx: retry later
  | { kind: "fatal"; status: number }; // 4xx other than 409: retrying the same request cannot help

function readMeta(storage: StorageLike | null, key: string): Meta {
  const empty: Meta = { revision: 0, dirty: false, pendingReset: false, lastSyncedAt: null };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(key);
    if (!raw) return empty;
    const m = JSON.parse(raw) as Partial<Meta>;
    return {
      revision: Number.isInteger(m.revision) && (m.revision as number) >= 0 ? (m.revision as number) : 0,
      dirty: m.dirty === true,
      pendingReset: m.pendingReset === true,
      lastSyncedAt: typeof m.lastSyncedAt === "string" ? m.lastSyncedAt : null,
    };
  } catch {
    return empty;
  }
}

export function createDemoSync(store: DemoStore, options: DemoSyncOptions = {}): DemoSync {
  const url = options.url ?? SYNC_URL;
  const metaKey = options.metaKey ?? `${DEMO_STATE_KEY}:sync`;
  const debounceMs = options.debounceMs ?? 500;
  const retryDelays = options.retryDelaysMs?.length ? options.retryDelaysMs : DEFAULT_RETRY_MS;
  const clock = options.now ?? (() => new Date().toISOString());
  const doFetch: typeof fetch = (input, init) => (options.fetch ?? globalThis.fetch)(input, init);

  const listeners = new Set<() => void>();
  let snapshot: SyncSnapshot = LOCAL;

  let generation = 0; // bumped on start/stop so stale async work can tell it was cancelled
  let running = false;
  let initialDone = false;
  let revision = 0;
  let pendingReset = false;
  let lastSynced: DemoStateV1 | null = null; // the state object known to equal the server copy
  let lastSyncedAt: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryIndex = 0;
  let chain: Promise<void> = Promise.resolve();
  let storage: StorageLike | null | undefined = options.storage;

  const getStorage = (): StorageLike | null => {
    if (storage === undefined) {
      try {
        storage = typeof window === "undefined" ? null : window.localStorage;
      } catch {
        storage = null;
      }
    }
    return storage;
  };

  const isDirty = () => store.getSnapshot() !== lastSynced;

  function setSnapshot(status: SyncStatus) {
    if (snapshot.status === status && snapshot.lastSyncedAt === lastSyncedAt) return;
    snapshot = { status, lastSyncedAt };
    for (const l of [...listeners]) l();
  }

  function persistMeta() {
    const s = getStorage();
    if (!s) return;
    const meta: Meta = { revision, dirty: isDirty(), pendingReset, lastSyncedAt };
    try {
      s.setItem(metaKey, JSON.stringify(meta));
    } catch {}
  }

  function clearTimers() {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    if (retryTimer !== null) clearTimeout(retryTimer);
    debounceTimer = null;
    retryTimer = null;
  }

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    const gen = generation;
    chain = chain
      .then(() => (gen === generation && running ? task() : undefined))
      .catch(() => {});
    return chain;
  };

  function markSynced() {
    lastSyncedAt = clock();
    retryIndex = 0;
    persistMeta();
    setSnapshot("synced");
  }

  function goOffline() {
    persistMeta();
    setSnapshot("offline");
    if (retryTimer !== null) clearTimeout(retryTimer);
    const delay = retryDelays[Math.min(retryIndex, retryDelays.length - 1)];
    retryIndex += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void enqueue(reconcile);
    }, delay);
  }

  async function request(method: "GET" | "PUT" | "DELETE", body?: unknown, keepalive = false): Promise<Reply> {
    let res: Response;
    try {
      res = await doFetch(url, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        keepalive,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      return { kind: "offline" };
    }
    if (res.status >= 500 || res.status === 429) return { kind: "offline" };
    if (!res.ok && res.status !== 409) return { kind: "fatal", status: res.status };
    let parsed: Record<string, unknown> | null = null;
    try {
      const j: unknown = await res.json();
      parsed = typeof j === "object" && j !== null ? (j as Record<string, unknown>) : null;
    } catch {}
    return { kind: "ok", status: res.status, body: parsed };
  }

  /** Server body -> { revision, state }. Invalid payloads are treated as unusable (null). */
  function readServer(body: Record<string, unknown> | null): { revision: number; state: DemoStateV1 | null } | null {
    if (!body || typeof body.revision !== "number" || !Number.isInteger(body.revision) || body.revision < 0) return null;
    if (body.state === null || body.state === undefined) return { revision: body.revision, state: null };
    const state = migrateState(body.state);
    return state ? { revision: body.revision, state } : null;
  }

  function adopt(serverRevision: number, state: DemoStateV1) {
    revision = serverRevision;
    lastSynced = state; // set first: the store notification below must not look like a local change
    store.adopt(state);
    markSynced();
  }

  async function sendDelete(): Promise<boolean> {
    const reply = await request("DELETE");
    if (reply.kind !== "ok") {
      if (reply.kind === "offline") goOffline();
      else setSnapshot("offline");
      return false;
    }
    pendingReset = false;
    revision = 0;
    return true;
  }

  /** Send the current local state with the revision we last saw. */
  async function push(keepalive = false, retriedAsNew = false): Promise<void> {
    if (pendingReset && !(await sendDelete())) return;
    if (!isDirty()) {
      markSynced();
      return;
    }
    const sent = store.getSnapshot();
    setSnapshot("syncing");
    const reply = await request("PUT", { state: sent, expectedRevision: revision }, keepalive);
    if (reply.kind === "offline") return goOffline();
    if (reply.kind === "fatal") return setSnapshot("offline"); // e.g. 400/403/413: retry on the next change
    if (reply.status === 409) {
      const server = readServer(reply.body);
      if (!server) return goOffline();
      if (server.state) return adopt(server.revision, server.state);
      // The server copy is gone (database wiped): recreate it from local, once.
      if (retriedAsNew) return goOffline();
      revision = 0;
      return push(keepalive, true);
    }
    const saved = reply.body && typeof reply.body.revision === "number" ? reply.body.revision : null;
    if (saved === null) return goOffline();
    revision = saved;
    lastSynced = sent;
    if (isDirty()) {
      persistMeta();
      scheduleStart(debounceMs); // changed while the request was in flight
      return;
    }
    markSynced();
  }

  /** GET the server copy and decide: adopt it, push local, or nothing. */
  async function reconcile(): Promise<void> {
    setSnapshot("syncing");
    if (pendingReset && !(await sendDelete())) return;
    const reply = await request("GET");
    if (reply.kind === "offline") return goOffline();
    if (reply.kind === "fatal") return setSnapshot("offline");
    const server = readServer(reply.body);
    if (!server) return goOffline();
    if (pendingReset) return; // a reset happened while the GET was in flight: do not resurrect old data
    const local = store.getSnapshot();
    initialDone = true;
    if (server.state === null) {
      revision = 0;
      if (local !== EMPTY_STATE) {
        lastSynced = null;
        return push();
      }
      lastSynced = local;
      return markSynced();
    }
    if (server.revision !== revision) return adopt(server.revision, server.state); // server revision wins
    if (isDirty()) return push();
    markSynced();
  }

  function scheduleStart(ms: number) {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void enqueue(() => push());
    }, ms);
  }

  function onStoreChange() {
    if (!running || !isDirty()) return;
    persistMeta();
    if (!initialDone) return; // the first reconcile decides what to push
    if (snapshot.status !== "offline") setSnapshot("syncing");
    scheduleStart(debounceMs);
  }

  function onReset() {
    if (!running) return;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = null;
    pendingReset = true;
    revision = 0;
    lastSynced = store.getSnapshot();
    persistMeta();
    setSnapshot("syncing");
    void enqueue(async () => {
      if (await sendDelete()) {
        initialDone = true;
        markSynced();
      }
    });
  }

  function onBackOnline() {
    if (!running || snapshot.status !== "offline") return;
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
    void enqueue(reconcile);
  }

  function onHide() {
    if (!running || !initialDone) return;
    store.flush();
    if (debounceTimer !== null && isDirty()) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
      void enqueue(() => push(true));
    }
  }

  return {
    start() {
      if (running) return () => {};
      running = true;
      generation += 1;
      const myGeneration = generation;
      initialDone = false;
      retryIndex = 0;
      const meta = readMeta(getStorage(), metaKey);
      revision = meta.revision;
      pendingReset = meta.pendingReset;
      lastSyncedAt = meta.lastSyncedAt;
      const local = store.getSnapshot();
      lastSynced = meta.dirty ? null : local;

      const unsubscribe = store.subscribe(onStoreChange);
      const unsubscribeReset = store.onReset(onReset);
      const target: EventsTarget | null = options.target !== undefined ? options.target : typeof window === "undefined" ? null : window;
      target?.addEventListener("online", onBackOnline);
      target?.addEventListener("pagehide", onHide);
      const hiddenListener = () => {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") onHide();
      };
      const doc: EventsTarget | null = options.target !== undefined || typeof document === "undefined" ? null : document;
      doc?.addEventListener("visibilitychange", hiddenListener);

      setSnapshot("syncing");
      void enqueue(reconcile);

      return () => {
        if (generation !== myGeneration) return;
        running = false;
        generation += 1;
        clearTimers();
        unsubscribe();
        unsubscribeReset();
        target?.removeEventListener("online", onBackOnline);
        target?.removeEventListener("pagehide", onHide);
        doc?.removeEventListener("visibilitychange", hiddenListener);
        snapshot = { status: "local", lastSyncedAt };
        for (const l of [...listeners]) l();
      };
    },

    getSnapshot: () => snapshot,
    getServerSnapshot: () => LOCAL,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    flush() {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = null;
      if (running && initialDone && (isDirty() || pendingReset)) void enqueue(() => push());
      return chain;
    },
  };
}

/** The app-wide sync, bound to the app-wide store. Started by DemoStateProvider in the browser. */
export const demoSync: DemoSync = createDemoSync(demoStore);
