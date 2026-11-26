import type { DemoEvent } from "@/demo-state";

/** Maps any record id named in an event (task, finding, run, prompt, report ...) to its website id. */
export function buildWebsiteLookup(events: readonly DemoEvent[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const { refs } of events) {
    if (!refs.websiteId) continue;
    for (const [key, value] of Object.entries(refs)) {
      if (key !== "websiteId" && typeof value === "string") map.set(value, refs.websiteId);
    }
  }
  return map;
}

/** Website a row belongs to: its own storeId / websiteId, else the one its creation event named. */
export function rowWebsite(row: { id: string }, lookup: ReadonlyMap<string, string>): string | null {
  const record = row as Record<string, unknown>;
  const own = typeof record.storeId === "string" ? record.storeId : typeof record.websiteId === "string" ? record.websiteId : null;
  return own ?? lookup.get(row.id) ?? null;
}

/** First non-empty string among the given keys of a row (locally created rows may name fields differently). */
export function rowText(row: object, ...keys: string[]): string {
  const record = row as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
