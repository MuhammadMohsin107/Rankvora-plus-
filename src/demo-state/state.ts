import {
  COLLECTION_KINDS,
  DEMO_STATE_VERSION,
  EVENT_KINDS,
  type CollectionOverlay,
  type DemoEvent,
  type DemoRow,
  type DemoStateV1,
  type DemoUi,
} from "./types";

export const MAX_EVENTS = 500;

const emptyOverlay = (): CollectionOverlay => ({ created: [], patched: {}, removed: [] });
const emptyUi = (): DemoUi => ({ sidebarCollapsed: false, lastWebsiteId: null, dismissedBanners: [] });

export function createEmptyState(): DemoStateV1 {
  return {
    v: DEMO_STATE_VERSION,
    seq: 0,
    websites: emptyOverlay(),
    prompts: emptyOverlay(),
    findings: emptyOverlay(),
    tasks: emptyOverlay(),
    schedules: emptyOverlay(),
    runs: emptyOverlay(),
    alerts: emptyOverlay(),
    comparisons: emptyOverlay(),
    reports: emptyOverlay(),
    members: emptyOverlay(),
    audits: emptyOverlay(),
    settings: {},
    events: [],
    ui: emptyUi(),
  };
}

/** Number of local changes (created + patched + removed rows, saved settings). Events and ui are not counted. */
export function countChanges(state: DemoStateV1): number {
  let n = Object.keys(state.settings).length;
  for (const kind of COLLECTION_KINDS) {
    const o = state[kind];
    n += o.created.length + o.removed.length + Object.keys(o.patched).length;
  }
  return n;
}

// ---- validation and migration ----------------------------------------------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isRow = (v: unknown): v is DemoRow => isObj(v) && typeof v.id === "string" && v.id.length > 0;

function readOverlay(raw: unknown): CollectionOverlay | null {
  if (raw === undefined) return emptyOverlay();
  if (!isObj(raw)) return null;
  const created = raw.created ?? [];
  const patched = raw.patched ?? {};
  const removed = raw.removed ?? [];
  if (!Array.isArray(created) || !created.every(isRow)) return null;
  if (!isObj(patched) || !Object.values(patched).every(isObj)) return null;
  if (!Array.isArray(removed) || !removed.every((x) => typeof x === "string")) return null;
  return { created, patched: patched as CollectionOverlay["patched"], removed };
}

const EVENT_KIND_SET: ReadonlySet<string> = new Set(EVENT_KINDS);

function readEvents(raw: unknown): DemoEvent[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const out: DemoEvent[] = [];
  for (const e of raw) {
    if (!isObj(e) || typeof e.id !== "string" || typeof e.at !== "string" || typeof e.label !== "string") return null;
    if (typeof e.kind !== "string" || !EVENT_KIND_SET.has(e.kind)) continue; // unknown kind from a newer build: skip, do not discard everything
    out.push({ id: e.id, at: e.at, kind: e.kind as DemoEvent["kind"], label: e.label, refs: isObj(e.refs) ? (e.refs as DemoEvent["refs"]) : {}, simulated: true });
  }
  return out.slice(-MAX_EVENTS);
}

function readUi(raw: unknown): DemoUi | null {
  if (raw === undefined) return emptyUi();
  if (!isObj(raw)) return null;
  const banners = raw.dismissedBanners ?? [];
  if (!Array.isArray(banners) || !banners.every((b) => typeof b === "string")) return null;
  return {
    sidebarCollapsed: raw.sidebarCollapsed === true,
    lastWebsiteId: typeof raw.lastWebsiteId === "string" ? raw.lastWebsiteId : null,
    dismissedBanners: banners,
  };
}

/**
 * Validate and normalise an unknown payload into the current state shape.
 * Returns null for anything that is not a v1 payload of the right shape (caller starts empty).
 * Missing collections are filled in, so adding a collection later is not a breaking change.
 * To move to v2: add a branch that converts a v1 payload, and bump DEMO_STATE_KEY.
 */
export function migrateState(raw: unknown): DemoStateV1 | null {
  if (!isObj(raw) || raw.v !== DEMO_STATE_VERSION) return null;
  if (typeof raw.seq !== "number" || !Number.isInteger(raw.seq) || raw.seq < 0) return null;
  const state = createEmptyState();
  state.seq = raw.seq;
  for (const kind of COLLECTION_KINDS) {
    const overlay = readOverlay(raw[kind]);
    if (!overlay) return null;
    state[kind] = overlay;
  }
  if (raw.settings !== undefined && !isObj(raw.settings)) return null;
  state.settings = (raw.settings as Json | undefined) ?? {};
  const events = readEvents(raw.events);
  const ui = readUi(raw.ui);
  if (!events || !ui) return null;
  state.events = events;
  state.ui = ui;
  return state;
}

/** Parse the stored string. Never throws. */
export function parseState(raw: string | null | undefined): DemoStateV1 | null {
  if (!raw) return null;
  try {
    return migrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}
