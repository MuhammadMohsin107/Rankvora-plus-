import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { simulatedToast } from "./copy";
import { applyOverlay } from "./merge";
import { eventsFor, isAlertUnread, unreadAlertCount, type AlertLike } from "./selectors";
import { createEmptyState, migrateState, parseState } from "./state";
import { createDemoStore, type StorageLike } from "./store";
import { DEMO_STATE_KEY, type CollectionOverlay } from "./types";

type Row = { id: string; name: string; status?: string };
const idOf = (r: Row) => r.id;
const base: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];
const overlay = (o: Partial<CollectionOverlay<Row>>): CollectionOverlay<Row> => ({ created: [], patched: {}, removed: [], ...o });

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  writes = 0;
  failWrites = false;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new DOMException("quota", "QuotaExceededError");
    this.writes += 1;
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("applyOverlay", () => {
  it("returns the base rows untouched for an empty overlay", () => {
    expect(applyOverlay(base, overlay({}), idOf)).toBe(base);
    expect(applyOverlay(base, undefined, idOf)).toBe(base);
  });

  it("appends created, merges patches, filters removed, in that order", () => {
    const out = applyOverlay(
      base,
      overlay({ created: [{ id: "n1", name: "New" }], patched: { a: { name: "Alpha 2" }, n1: { status: "x" } }, removed: ["b"] }),
      idOf,
    );
    expect(out).toEqual([
      { id: "a", name: "Alpha 2" },
      { id: "c", name: "Gamma" },
      { id: "n1", name: "New", status: "x" },
    ]);
  });

  it("does not mutate its inputs and ignores inherited property names as ids", () => {
    const o = overlay({ patched: { a: { name: "Z" } } });
    const copy = JSON.parse(JSON.stringify(base));
    applyOverlay(base, o, idOf);
    expect(base).toEqual(copy);
    const weird = applyOverlay([{ id: "constructor", name: "k" }], overlay({ removed: [] , patched: { a: { name: "z" } } }), idOf);
    expect(weird).toEqual([{ id: "constructor", name: "k" }]);
  });

  it("drops duplicate ids so a created row cannot double a base row", () => {
    const out = applyOverlay(base, overlay({ created: [{ id: "a", name: "Dup" }] }), idOf);
    expect(out.filter((r) => r.id === "a")).toHaveLength(1);
  });
});

describe("persistence, hydration and migration", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    vi.useFakeTimers();
    storage = new FakeStorage();
  });
  afterEach(() => vi.useRealTimers());
  const make = () => createDemoStore({ storage, target: null, now: () => "2026-11-19T10:00:00.000Z" });

  it("server snapshot is the empty overlay and stable", () => {
    const s = make();
    s.create("prompts", { name: "x" });
    expect(s.getServerSnapshot()).toBe(s.getServerSnapshot());
    expect(s.getServerSnapshot().prompts.created).toEqual([]);
  });

  it("debounces writes and persists under the versioned key", () => {
    const s = make();
    s.create("prompts", { name: "one" });
    s.update("prompts", "p", { name: "two" });
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(149);
    expect(storage.writes).toBe(0);
    vi.advanceTimersByTime(2);
    expect(storage.writes).toBe(1);
    expect(DEMO_STATE_KEY).toBe("rankvora-demo-state:v1");
    expect(parseState(storage.getItem(DEMO_STATE_KEY))?.prompts.created).toHaveLength(1);
  });

  it("hydrates a second store from what the first one wrote", () => {
    const a = make();
    const row = a.create("tasks", { title: "T" });
    a.flush();
    const b = make();
    expect(b.getSnapshot().tasks.created.map((r) => r.id)).toEqual([row.id]);
  });

  it("discards corrupt JSON, wrong shapes and unknown versions, and removes the bad key", () => {
    for (const raw of ["{not json", "[]", '"x"', JSON.stringify({ v: 2, seq: 0 }), JSON.stringify({ v: 1, seq: -1 }), JSON.stringify({ v: 1, seq: 0, tasks: { created: "nope" } }), JSON.stringify({ v: 1, seq: 0, tasks: { created: [{ noId: 1 }] } })]) {
      storage.data.set(DEMO_STATE_KEY, raw);
      const s = make();
      expect(s.getSnapshot()).toEqual(createEmptyState());
      expect(storage.data.has(DEMO_STATE_KEY)).toBe(false);
    }
  });

  it("migrate: fills collections added later and skips unknown event kinds", () => {
    const old = { v: 1, seq: 3, tasks: { created: [{ id: "demo-tasks-1" }], patched: {}, removed: [] }, events: [{ id: "e1", at: "t", kind: "future.kind", label: "?" }, { id: "e2", at: "t", kind: "task.created", label: "Task created", refs: { taskId: "demo-tasks-1" } }] };
    const migrated = migrateState(old);
    expect(migrated?.seq).toBe(3);
    expect(migrated?.audits).toEqual({ created: [], patched: {}, removed: [] });
    expect(migrated?.events.map((e) => e.id)).toEqual(["e2"]);
    expect(migrated?.ui.dismissedBanners).toEqual([]);
    expect(migrateState({ ...old, v: 0 })).toBeNull();
    expect(migrateState(null)).toBeNull();
  });

  it("keeps working in memory when storage writes throw (quota or private mode)", () => {
    const s = make();
    storage.failWrites = true;
    expect(() => {
      s.create("prompts", { name: "x" });
      vi.advanceTimersByTime(300);
    }).not.toThrow();
    expect(s.getSnapshot().prompts.created).toHaveLength(1);
  });

  it("works with no storage at all", () => {
    const s = createDemoStore({ storage: null, target: null });
    s.create("prompts", { name: "x" });
    vi.advanceTimersByTime(300);
    expect(s.getSnapshot().prompts.created).toHaveLength(1);
  });

  it("syncs from another tab through syncFromStorage and notifies subscribers", () => {
    const tabA = make();
    const tabB = make();
    const seen = vi.fn();
    tabB.subscribe(seen);
    expect(tabB.getSnapshot().prompts.created).toHaveLength(0);
    tabA.create("prompts", { name: "from A" });
    tabA.flush();
    tabB.syncFromStorage();
    expect(tabB.getSnapshot().prompts.created).toHaveLength(1);
    expect(seen).toHaveBeenCalled();
    storage.removeItem(DEMO_STATE_KEY);
    tabB.syncFromStorage();
    expect(tabB.getSnapshot().prompts.created).toHaveLength(0);
  });

  it("listens for storage events on the target while subscribed", () => {
    const handlers = new Map<string, (e: { key?: string | null }) => void>();
    const target = {
      addEventListener: (t: string, h: (e: { key?: string | null }) => void) => void handlers.set(t, h),
      removeEventListener: (t: string) => void handlers.delete(t),
    };
    const other = make();
    const s = createDemoStore({ storage, target });
    const off = s.subscribe(() => {});
    expect(s.getSnapshot().tasks.created).toHaveLength(0); // hydrated while storage is still empty
    other.create("tasks", { title: "x" });
    other.flush();
    handlers.get("storage")?.({ key: "unrelated" });
    expect(s.getSnapshot().tasks.created).toHaveLength(0);
    handlers.get("storage")?.({ key: DEMO_STATE_KEY });
    expect(s.getSnapshot().tasks.created).toHaveLength(1);
    off();
    expect(handlers.size).toBe(0);
  });
});

describe("mutations, ids and reset", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    vi.useFakeTimers();
    storage = new FakeStorage();
  });
  afterEach(() => vi.useRealTimers());
  const make = () => createDemoStore({ storage, target: null, now: () => "2026-11-19T10:00:00.000Z" });

  it("assigns monotonic demo-<kind>-<n> ids, stamps the simulated marker, never reuses an id", () => {
    const s = make();
    const a = s.create("prompts", { name: "a" });
    const b = s.create("tasks", { title: "b" });
    s.remove("prompts", a.id);
    const c = s.create("prompts", { name: "c" });
    expect([a.id, b.id, c.id]).toEqual(["demo-prompts-1", "demo-tasks-2", "demo-prompts-3"]);
    expect(a).toMatchObject({ simulated: true, origin: "local-demo" });
    expect(s.nextId("x")).toBe("demo-x-4");
    s.flush();
    expect(make().create("prompts", { name: "d" }).id).toBe("demo-prompts-5"); // counter survives reload
  });

  it("update patches base and created rows; remove hides base rows and deletes created rows", () => {
    const s = make();
    s.update("findings", "fnd-1", { status: "confirmed" });
    s.update("findings", "fnd-1", { note: "n" });
    expect(s.getSnapshot().findings.patched["fnd-1"]).toEqual({ status: "confirmed", note: "n" });
    s.remove("findings", "fnd-2");
    s.remove("findings", "fnd-2");
    expect(s.getSnapshot().findings.removed).toEqual(["fnd-2"]);
    const row = s.create("findings", { title: "t" });
    s.update("findings", row.id, { title: "t2" });
    s.remove("findings", row.id);
    const f = s.getSnapshot().findings;
    expect(f.created).toEqual([]);
    expect(f.patched[row.id]).toBeUndefined();
    expect(f.removed).toEqual(["fnd-2"]);
  });

  it("keeps snapshots immutable and referentially stable between changes", () => {
    const s = make();
    const before = s.getSnapshot();
    expect(s.getSnapshot()).toBe(before);
    s.create("prompts", { name: "x" });
    expect(s.getSnapshot()).not.toBe(before);
    expect(before.prompts.created).toEqual([]);
  });

  it("emits evidence events with refs, simulated flag and ordering, atomically with the mutation", () => {
    const s = make();
    const listener = vi.fn();
    s.subscribe(listener);
    const task = s.create("tasks", { title: "Fix" }, (row) => ({ kind: "task.created", label: "Task created", refs: { taskId: row.id, findingId: "fnd-1", websiteId: "runpro-pk" } }));
    expect(listener).toHaveBeenCalledTimes(1);
    s.update("tasks", task.id, { status: "approved" }, { kind: "task.approved", label: "Task approved", refs: { taskId: task.id, findingId: "fnd-1" } });
    s.emit({ kind: "run.started", label: "Run started", refs: { runId: "run-1" } });
    const events = s.getSnapshot().events;
    expect(events.map((e) => e.kind)).toEqual(["task.created", "task.approved", "run.started"]);
    expect(events.every((e) => e.simulated === true && e.at === "2026-11-19T10:00:00.000Z")).toBe(true);
    expect(new Set(events.map((e) => e.id)).size).toBe(3);
    expect(eventsFor(events, { findingId: "fnd-1" })).toHaveLength(2);
    expect(eventsFor(events, { taskId: task.id, kinds: ["task.approved"] })).toHaveLength(1);
    expect(eventsFor(events, { taskId: task.id, runId: "run-1", match: "any" })).toHaveLength(3);
    expect(eventsFor(events, { limit: 1 })[0].kind).toBe("run.started");
  });

  it("caps the event log", () => {
    const s = make();
    for (let i = 0; i < 520; i++) s.emit({ kind: "settings.saved", label: String(i) });
    const events = s.getSnapshot().events;
    expect(events).toHaveLength(500);
    expect(events[499].label).toBe("519");
  });

  it("settings: set, overwrite, clear", () => {
    const s = make();
    s.setSetting("org.general", { name: "Acme" });
    expect(s.getSnapshot().settings["org.general"]).toEqual({ name: "Acme" });
    s.clearSetting("org.general");
    expect(s.getSnapshot().settings).toEqual({});
  });

  it("ui memory persists", () => {
    const s = make();
    s.setUi({ sidebarCollapsed: true, lastWebsiteId: "runpro-pk" });
    s.flush();
    expect(make().getSnapshot().ui).toEqual({ sidebarCollapsed: true, lastWebsiteId: "runpro-pk", dismissedBanners: [] });
  });

  it("reset clears memory and storage, cancels pending writes, and restarts ids", () => {
    const s = make();
    const listener = vi.fn();
    s.subscribe(listener);
    s.create("prompts", { name: "x" });
    s.flush();
    expect(storage.data.has(DEMO_STATE_KEY)).toBe(true);
    s.create("prompts", { name: "y" }); // pending write
    s.reset();
    expect(storage.data.has(DEMO_STATE_KEY)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(storage.data.has(DEMO_STATE_KEY)).toBe(false);
    expect(s.getSnapshot()).toEqual(createEmptyState());
    expect(listener).toHaveBeenLastCalledWith();
    expect(s.create("prompts", { name: "z" }).id).toBe("demo-prompts-1");
  });
});

describe("alert unread definition", () => {
  const alerts: AlertLike[] = [
    { id: "al-1", storeId: "w1", read: false },
    { id: "al-2", storeId: "w1", read: true },
    { id: "al-3", storeId: "w2", read: false },
    { id: "al-4", storeId: "w1", status: "new" },
    { id: "al-5", storeId: "w1", status: "acknowledged" },
  ];
  it("uses status when present, read otherwise", () => {
    expect(alerts.map(isAlertUnread)).toEqual([true, false, true, true, false]);
  });
  it("counts after overlay, optionally per website; removed and muted are not unread", () => {
    const o = { created: [], patched: { "al-1": { read: true, status: "read" }, "al-3": { status: "muted" } }, removed: ["al-4"] };
    expect(unreadAlertCount(alerts, o)).toBe(0);
    expect(unreadAlertCount(alerts, undefined)).toBe(3);
    expect(unreadAlertCount(alerts, undefined, "w1")).toBe(2);
  });
});

describe("simulatedToast", () => {
  it("says simulated and never claims an external action", () => {
    expect(simulatedToast("task.approved")).toEqual({ title: "Task approved (simulated)", tone: "success" });
    expect(simulatedToast("CSV prepared").title).toBe("CSV prepared (simulated)");
    expect(simulatedToast("reset", "info").title).toBe("Demo data reset");
    expect(simulatedToast("constructor").title).toBe("constructor (simulated)");
  });
});
