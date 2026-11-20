/**
 * A comparison is fully described by its definition (type, two sources, scope, aggregation).
 * The definition is encoded into the comparison id ("cmp-u-..."), so a comparison created in the
 * wizard can be recomputed from its id alone by the same engine, on the server or in the browser,
 * and creating the same definition twice gives the same id (idempotent). Pure, no clocks.
 */
import { formatShortDate } from "@/lib/format";
import type { AggregationPolicy, Comparability, ComparisonDefinition, ComparisonFilters, ComparisonStatusValue, ComparisonType, SnapshotRef } from "@/types/comparison";

export const LOCAL_ID_PREFIX = "cmp-u-";

const TYPE_CODE: Record<ComparisonType, string> = { snapshot_vs_snapshot: "ss", period_vs_period: "pp", initial_vs_latest: "il", before_after_fixes: "ba", platform: "pl" };
const CODE_TYPE = Object.fromEntries(Object.entries(TYPE_CODE).map(([type, code]) => [code, type])) as Record<string, ComparisonType>;

const FILTER_KEYS = ["groupId", "topic", "promptId", "channelId", "channelIds", "market", "language", "competitorId", "domain"] as const;

/** Drops empty values and fixes key order so equal scopes encode equally. */
export function normalizeFilters(filters: ComparisonFilters): ComparisonFilters {
  const out: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (Array.isArray(value) ? value.length > 0 : Boolean(value)) out[key] = Array.isArray(value) ? [...value].sort() : value;
  }
  return out as ComparisonFilters;
}

export function filterCount(filters: ComparisonFilters): number {
  return Object.keys(normalizeFilters(filters)).length;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function encodeDefinition(def: ComparisonDefinition): string {
  const filters = normalizeFilters(def.filters);
  const compact: Record<string, unknown> = { t: TYPE_CODE[def.type], b: def.baseline, c: def.current };
  if (Object.keys(filters).length > 0) compact.f = filters;
  if (def.aggregation === "pooled") compact.a = "p";
  if (def.taskId) compact.k = def.taskId;
  return `${LOCAL_ID_PREFIX}${toBase64Url(JSON.stringify(compact))}`;
}

export const isLocalComparisonId = (id: string) => id.startsWith(LOCAL_ID_PREFIX);

/** Null when the id is not an encoded definition or is malformed. */
export function decodeDefinition(id: string): ComparisonDefinition | null {
  if (!isLocalComparisonId(id)) return null;
  const json = fromBase64Url(id.slice(LOCAL_ID_PREFIX.length));
  if (!json) return null;
  try {
    const raw = JSON.parse(json) as { t?: unknown; b?: unknown; c?: unknown; f?: unknown; a?: unknown; k?: unknown };
    const type = typeof raw.t === "string" ? CODE_TYPE[raw.t] : undefined;
    if (!type || typeof raw.b !== "string" || typeof raw.c !== "string") return null;
    const filters = raw.f && typeof raw.f === "object" && !Array.isArray(raw.f) ? normalizeFilters(raw.f as ComparisonFilters) : {};
    const aggregation: AggregationPolicy = raw.a === "p" ? "pooled" : "matched_slot_macro";
    return { type, baseline: raw.b, current: raw.c, filters, aggregation, ...(typeof raw.k === "string" ? { taskId: raw.k } : {}) };
  } catch {
    return null;
  }
}

/** Short side label: "Initial audit · 12 Aug", or "1 Oct – 31 Oct" for a window. */
export function sideTitle(reference: string, snapshots: SnapshotRef[]): string {
  const snap = snapshots.find((s) => s.snapshotId === reference || s.sourceId === reference);
  if (snap) return `${snap.title} · ${formatShortDate(snap.date)}`;
  const window = reference.match(/^(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})$/);
  return window ? `${formatShortDate(window[1])} – ${formatShortDate(window[2])}` : reference;
}

export const TYPE_NAME: Record<ComparisonType, string> = {
  snapshot_vs_snapshot: "Snapshot vs snapshot",
  period_vs_period: "Period vs period",
  initial_vs_latest: "Initial vs latest",
  before_after_fixes: "Before vs after fixes",
  platform: "Platform",
};

export function buildTitle(def: ComparisonDefinition, snapshots: SnapshotRef[]): string {
  const scoped = filterCount(def.filters) > 0 ? " (scoped)" : "";
  return `${TYPE_NAME[def.type]}: ${sideTitle(def.baseline, snapshots)} → ${sideTitle(def.current, snapshots)}${scoped}`;
}

/** Lifecycle status for a finished comparison, derived from the verdict. */
export function statusForVerdict(verdict: Comparability): ComparisonStatusValue {
  switch (verdict) {
    case "comparable":
      return "completed";
    case "comparable_with_warnings":
      return "completed_with_warnings";
    case "partially_comparable":
      return "partially_comparable";
    case "not_comparable":
      return "not_comparable";
    case "insufficient_data":
      return "insufficient_data";
  }
}

/** The snapshot for a query value that may be a snapshot id ("snap-mon-007") or a source id ("run-007", "aud-002"). */
export function findSnapshot(snapshots: SnapshotRef[], value: string | null | undefined): SnapshotRef | undefined {
  return value ? snapshots.find((s) => s.snapshotId === value || s.sourceId === value) : undefined;
}

/** Last snapshot at or before a date, and first snapshot after it: the two sides of a before-after comparison. */
export function snapshotsAround(snapshots: SnapshotRef[], at: string): { before: SnapshotRef | null; after: SnapshotRef | null } {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : 1));
  const before = [...sorted].filter((s) => s.date <= at).pop() ?? null;
  const after = sorted.find((s) => s.date > at) ?? null;
  return { before, after };
}
