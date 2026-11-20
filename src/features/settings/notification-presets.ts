import type { NotificationChannel, NotificationEvent, NotificationEventId, NotificationMatrix } from "@/types/settings";

export type PresetId = "important" | "everything" | "digest";

/** Events that need attention when they happen: losses and data-quality problems. */
export const IMPORTANT_EVENTS: NotificationEventId[] = ["lost_mention", "recommendation_lost", "lost_owned_citation", "sentiment_shift", "provider_error_spike", "run_incomplete"];

export const PRESET_LABEL: Record<PresetId, string> = { important: "Important only", everything: "Everything", digest: "Digest only" };

/** Matrix for a preset. Webhook is never added by a preset: it needs an address first. */
export function presetMatrix(preset: PresetId, events: NotificationEvent[]): NotificationMatrix {
  const channelsFor = (id: NotificationEventId): NotificationChannel[] => {
    if (preset === "everything") return ["in_app", "email"];
    if (preset === "important") return IMPORTANT_EVENTS.includes(id) ? ["in_app", "email"] : [];
    return [];
  };
  return Object.fromEntries(events.map((e) => [e.id, channelsFor(e.id)])) as NotificationMatrix;
}

const sameChannels = (a: NotificationChannel[], b: NotificationChannel[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** The preset whose matrix equals the current one, or "custom". */
export function detectPreset(matrix: NotificationMatrix, events: NotificationEvent[]): PresetId | "custom" {
  for (const preset of ["important", "everything", "digest"] as PresetId[]) {
    const wanted = presetMatrix(preset, events);
    if (events.every((e) => sameChannels(matrix[e.id] ?? [], wanted[e.id]))) return preset;
  }
  return "custom";
}

/** Count of events that deliver anywhere. */
export function activeEventCount(matrix: NotificationMatrix): number {
  return Object.values(matrix).filter((channels) => channels.length > 0).length;
}
