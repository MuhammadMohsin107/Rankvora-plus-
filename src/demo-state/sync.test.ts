import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createEmptyState } from "./state";
import { createDemoStore, EMPTY_STATE, type StorageLike } from "./store";
import { createDemoSync } from "./sync";
import { DEMO_STATE_KEY, type DemoStateV1 } from "./types";

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

type Call = { method: string; body: { state?: DemoStateV1; expectedRevision?: number } | null };

/** In-memory stand-in for /api/demo-state with the same contract (revision check, 409, delete). */
class FakeServer {
  revision = 0;
  state: DemoStateV1 | null = null;
  down = false; // network failure
  status: number | null = null; // force a status for every request
  calls: Call[] = [];

  fetch = async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(init.body as string) as Call["body"]) : null;
    this.calls.push({ method, body });
    if (this.down) throw new TypeError("Failed to fetch");
    if (this.status !== null) return Response.json({ error: "forced" }, { status: this.status });
    if (method === "GET") return Response.json({ revision: this.revision, state: this.state });
    if (method === "DELETE") {
      this.revision = 0;
      this.state = null;
      return Response.json({ revision: 0, state: null });
    }
    const expected = body?.expectedRevision;
    if (expected !== undefined && expected !== this.revision) {
      return Response.json({ error: "conflict", revision: this.revision, state: this.state }, { status: 409 });
    }
    this.revision += 1;
    this.state = body!.state!;
    return Response.json({ revision: this.revision });
  };

  count(method: string) {
    return this.calls.filter((c) => c.method === method).length;
  }
}

const NOW = "2026-11-20T10:00:00.000Z";
let storage: FakeStorage;
let server: FakeServer;

function setup(seedLocal?: (s: ReturnType<typeof createDemoStore>) => void) {
  const store = createDemoStore({ storage, target: null, now: () => NOW });
  seedLocal?.(store);
  store.flush();
  const sync = createDemoSync(store, { storage, fetch: ((u: RequestInfo | URL, i?: RequestInit) => server.fetch(u, i)) as typeof fetch, target: null, now: () => NOW, retryDelaysMs: [1000, 2000] });
  return { store, sync };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const stateWithSeq = (seq: number): DemoStateV1 => ({ ...createEmptyState(), seq });

beforeEach(() => {
  vi.useFakeTimers();
  storage = new FakeStorage();
  server = new FakeServer();
});
afterEach(() => vi.useRealTimers());

describe("initial reconcile", () => {
  it("empty server and empty local: one GET, no PUT, synced", async () => {
    const { sync } = setup();
    expect(sync.getSnapshot().status).toBe("local");
    const stop = sync.start();
    await settle();
    expect(server.calls.map((c) => c.method)).toEqual(["GET"]);
    expect(sync.getSnapshot().status).toBe("synced");
    expect(sync.getSnapshot().lastSyncedAt).toBe(NOW);
    stop();
  });

  it("empty server and local changes: pushes local with expectedRevision 0", async () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "mine" }));
    const stop = sync.start();
    await settle();
    expect(server.calls.map((c) => c.method)).toEqual(["GET", "PUT"]);
    expect(server.calls[1].body?.expectedRevision).toBe(0);
    expect(server.revision).toBe(1);
    expect(server.state?.prompts.created).toHaveLength(1);
    expect(sync.getSnapshot().status).toBe("synced");
    expect(store.getSnapshot().prompts.created).toHaveLength(1);
    stop();
  });

  it("server revision moved: adopts the server state and persists it to localStorage", async () => {
    server.revision = 7;
    server.state = { ...stateWithSeq(9), settings: { from: "server" } };
    const { sync, store } = setup((s) => s.create("prompts", { name: "stale local" }));
    const stop = sync.start();
    await settle();
    expect(server.count("PUT")).toBe(0);
    expect(store.getSnapshot().seq).toBe(9);
    expect(store.getSnapshot().prompts.created).toHaveLength(0);
    expect(JSON.parse(storage.getItem(DEMO_STATE_KEY)!).settings).toEqual({ from: "server" });
    expect(JSON.parse(storage.getItem(`${DEMO_STATE_KEY}:sync`)!)).toMatchObject({ revision: 7, dirty: false });
    stop();
  });

  it("same revision and unsaved local changes (left from an earlier visit): pushes them", async () => {
    server.revision = 3;
    server.state = stateWithSeq(1);
    storage.setItem(`${DEMO_STATE_KEY}:sync`, JSON.stringify({ revision: 3, dirty: true, pendingReset: false, lastSyncedAt: null }));
    const { sync } = setup((s) => s.create("tasks", { title: "offline edit" }));
    const stop = sync.start();
    await settle();
    expect(server.calls.map((c) => c.method)).toEqual(["GET", "PUT"]);
    expect(server.calls[1].body?.expectedRevision).toBe(3);
    expect(server.revision).toBe(4);
    stop();
  });

  it("same revision and nothing unsaved: no PUT", async () => {
    server.revision = 3;
    server.state = stateWithSeq(1);
    storage.setItem(`${DEMO_STATE_KEY}:sync`, JSON.stringify({ revision: 3, dirty: false, pendingReset: false, lastSyncedAt: null }));
    const { sync } = setup();
    const stop = sync.start();
    await settle();
    expect(server.calls.map((c) => c.method)).toEqual(["GET"]);
    stop();
  });
});

describe("pushing changes", () => {
  it("batches rapid changes into one PUT after 500 ms with the last seen revision", async () => {
    const { sync, store } = setup();
    const stop = sync.start();
    await settle();
    store.create("prompts", { name: "a" });
    store.create("prompts", { name: "b" });
    store.setUi({ sidebarCollapsed: true });
    expect(sync.getSnapshot().status).toBe("syncing");
    await vi.advanceTimersByTimeAsync(499);
    expect(server.count("PUT")).toBe(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(server.count("PUT")).toBe(1);
    expect(server.calls.at(-1)?.body?.expectedRevision).toBe(0);
    expect(server.state?.prompts.created).toHaveLength(2);
    expect(sync.getSnapshot().status).toBe("synced");

    store.create("prompts", { name: "c" });
    await vi.advanceTimersByTimeAsync(600);
    expect(server.calls.at(-1)?.body?.expectedRevision).toBe(1);
    expect(server.revision).toBe(2);
    stop();
  });

  it("a change made while a PUT is in flight triggers a second PUT", async () => {
    const { sync, store } = setup();
    const stop = sync.start();
    await settle();
    store.create("prompts", { name: "a" });
    const original = server.fetch;
    server.fetch = async (u, i) => {
      if (i?.method === "PUT" && server.count("PUT") === 0) store.create("prompts", { name: "during" });
      return original(u, i);
    };
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(600);
    expect(server.count("PUT")).toBe(2);
    expect(server.state?.prompts.created).toHaveLength(2);
    expect(sync.getSnapshot().status).toBe("synced");
    stop();
  });

  it("409: adopts the server state and keeps syncing afterwards", async () => {
    const { sync, store } = setup();
    const stop = sync.start();
    await settle();
    server.revision = 5; // someone else saved
    server.state = { ...stateWithSeq(50), settings: { winner: "server" } };
    store.create("prompts", { name: "loses" });
    await vi.advanceTimersByTimeAsync(600);
    expect(store.getSnapshot().seq).toBe(50);
    expect(store.getSnapshot().settings).toEqual({ winner: "server" });
    expect(sync.getSnapshot().status).toBe("synced");
    store.setSetting("k", 1);
    await vi.advanceTimersByTimeAsync(600);
    expect(server.calls.at(-1)?.body?.expectedRevision).toBe(5);
    expect(server.revision).toBe(6);
    stop();
  });

  it("409 with a wiped server recreates it from local exactly once", async () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "keep" }));
    server.revision = 2;
    server.state = stateWithSeq(1);
    storage.setItem(`${DEMO_STATE_KEY}:sync`, JSON.stringify({ revision: 2, dirty: true, pendingReset: false, lastSyncedAt: null }));
    const stop = sync.start();
    await settle();
    server.revision = 0;
    server.state = null as DemoStateV1 | null; // database wiped
    store.create("prompts", { name: "again" });
    await vi.advanceTimersByTimeAsync(600);
    expect((server.state as DemoStateV1 | null)?.prompts.created).toHaveLength(2);
    expect(server.revision).toBe(1);
    stop();
  });
});

describe("offline behaviour", () => {
  it("network failure: keeps local changes, goes offline, retries with backoff, then recovers", async () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "x" }));
    server.down = true;
    const stop = sync.start();
    await settle();
    expect(sync.getSnapshot().status).toBe("offline");
    expect(store.getSnapshot().prompts.created).toHaveLength(1);
    expect(JSON.parse(storage.getItem(DEMO_STATE_KEY)!).prompts.created).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000); // first retry fails again
    expect(sync.getSnapshot().status).toBe("offline");
    store.create("prompts", { name: "while offline" });
    server.down = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(sync.getSnapshot().status).toBe("synced");
    expect(server.state?.prompts.created).toHaveLength(2);
    stop();
  });

  it("503 (no database) is treated as offline, not as an error", async () => {
    server.status = 503;
    const { sync, store } = setup();
    const stop = sync.start();
    await settle();
    expect(sync.getSnapshot().status).toBe("offline");
    store.create("prompts", { name: "still works" });
    expect(store.getSnapshot().prompts.created).toHaveLength(1);
    stop();
  });

  it("a 4xx other than 409 stops retrying until the next change", async () => {
    const { sync, store } = setup();
    const stop = sync.start();
    await settle();
    server.status = 413;
    store.create("prompts", { name: "huge" });
    await vi.advanceTimersByTimeAsync(600);
    expect(sync.getSnapshot().status).toBe("offline");
    const puts = server.count("PUT");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(server.count("PUT")).toBe(puts);
    stop();
  });
});

describe("reset", () => {
  it("store.reset() sends DELETE and the server copy is gone", async () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "x" }));
    const stop = sync.start();
    await settle();
    expect(server.revision).toBe(1);
    store.reset();
    await settle();
    expect(server.count("DELETE")).toBe(1);
    expect(server.state).toBeNull();
    expect(store.getSnapshot()).toBe(EMPTY_STATE);
    expect(sync.getSnapshot().status).toBe("synced");
    store.create("prompts", { name: "after" });
    await vi.advanceTimersByTimeAsync(600);
    expect(server.calls.at(-1)?.body?.expectedRevision).toBe(0);
    stop();
  });

  it("a failed DELETE is retried before anything else and old server data is not resurrected", async () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "x" }));
    const stop = sync.start();
    await settle();
    server.down = true;
    store.reset();
    await settle();
    expect(sync.getSnapshot().status).toBe("offline");
    expect(server.revision).toBe(1); // server still has the old copy
    stop();

    // New page load: pendingReset is persisted, so DELETE goes first.
    server.down = false;
    const again = setup();
    const stop2 = again.sync.start();
    await settle();
    expect(server.calls.slice(-2).map((c) => c.method)).toEqual(["DELETE", "GET"]);
    expect(server.state).toBeNull();
    expect(again.store.getSnapshot().prompts.created).toHaveLength(0);
    stop2();
  });
});

describe("server rendering", () => {
  it("server snapshots are the static state: status local, store empty overlay", () => {
    const { sync, store } = setup((s) => s.create("prompts", { name: "x" }));
    expect(sync.getServerSnapshot()).toEqual({ status: "local", lastSyncedAt: null });
    expect(store.getServerSnapshot()).toBe(EMPTY_STATE);
  });

  it("works without any network layer present (no fetch at all)", async () => {
    const store = createDemoStore({ storage, target: null });
    const sync = createDemoSync(store, { storage, target: null, fetch: (() => Promise.reject(new TypeError("no network"))) as typeof fetch });
    const stop = sync.start();
    store.create("prompts", { name: "x" });
    await settle();
    expect(store.getSnapshot().prompts.created).toHaveLength(1);
    expect(sync.getSnapshot().status).toBe("offline");
    stop();
  });
});
