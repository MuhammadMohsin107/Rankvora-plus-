import type { CollectionOverlay } from "./types";

/**
 * Pure merge of static rows with a local overlay.
 * Order: base rows then created rows; field patches applied by id; removed ids filtered out.
 * Never mutates its inputs. Returns `base` itself (same reference) when the overlay is empty.
 */
export function applyOverlay<T>(
  base: readonly T[],
  overlay: CollectionOverlay<T> | undefined,
  idOf: (row: T) => string,
): T[] {
  if (!overlay || (overlay.created.length === 0 && overlay.removed.length === 0 && isEmpty(overlay.patched))) {
    return base as T[];
  }
  const removed = new Set(overlay.removed);
  const out: T[] = [];
  const seen = new Set<string>();
  for (const row of [...base, ...overlay.created]) {
    const id = idOf(row);
    if (removed.has(id) || seen.has(id)) continue;
    seen.add(id);
    const patch = Object.hasOwn(overlay.patched, id) ? overlay.patched[id] : undefined;
    out.push(patch ? { ...row, ...patch } : row);
  }
  return out;
}

function isEmpty(record: object): boolean {
  for (const key in record) if (Object.hasOwn(record, key)) return false;
  return true;
}

/** True when the overlay changes anything. */
export function overlayChangeCount(overlay: CollectionOverlay<unknown>): number {
  return overlay.created.length + overlay.removed.length + Object.keys(overlay.patched).length;
}
