/**
 * Resolving a "reference" (snapshot id or date window) into one side of a
 * comparison. Pure: used by the server loader and by the wizard's live preview.
 */
import { sideKind } from "@/features/comparison/engine";
import { formatDate } from "@/lib/format";
import type { SideInfo, SlotCore, SnapshotRef } from "@/types/comparison";

export function parseWindow(reference: string): { from: string; to: string } | null {
  const match = reference.match(/^(\d{4}-\d{2}-\d{2})\s*[–-]\s*(\d{4}-\d{2}-\d{2})$/);
  return match ? { from: match[1], to: match[2] } : null;
}

export const windowReference = (from: string, to: string) => `${from} – ${to}`;

export type ResolvedSide<T extends SlotCore> = { info: SideInfo; rows: T[]; runCount: number };

export function resolveSide<T extends SlotCore>(reference: string, snapshots: SnapshotRef[], rowsBySource: Record<string, T[]>, brand: string): ResolvedSide<T> | null {
  const snap = snapshots.find((s) => s.snapshotId === reference);
  if (snap) {
    return {
      rows: rowsBySource[snap.sourceId] ?? [],
      runCount: 1,
      info: { label: `${snap.title} · ${formatDate(snap.date)}`, reference, kind: snap.kind, runIds: [snap.sourceId], from: snap.date, to: snap.date, brand },
    };
  }
  const window = parseWindow(reference);
  if (window) {
    const from = `${window.from}T00:00:00Z`;
    const to = `${window.to}T23:59:59Z`;
    const runs = snapshots.filter((s) => s.kind === "monitoring" && s.date >= from && s.date <= to);
    const runIds = runs.map((r) => r.sourceId);
    return {
      rows: runs.flatMap((r) => rowsBySource[r.sourceId] ?? []),
      runCount: runs.length,
      info: { label: `${formatDate(from)} – ${formatDate(to)}`, reference, kind: runIds.length ? sideKind(runIds) : "monitoring", runIds, from, to, brand },
    };
  }
  return null;
}
