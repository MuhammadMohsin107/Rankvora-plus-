import { buildWebsiteLookup } from "@/components/shell/row-website";
import type { DemoEvent, DemoEventKind } from "@/demo-state";
import type { ActivityItem } from "@/types/core";

type Look = Pick<ActivityItem, "icon" | "tone">;

const BY_PREFIX: [string, Look][] = [
  ["task.", { icon: "fixes", tone: "info" }],
  ["finding.", { icon: "fixes", tone: "info" }],
  ["run.", { icon: "monitoring", tone: "accent" }],
  ["schedule.", { icon: "monitoring", tone: "neutral" }],
  ["alert.", { icon: "bell", tone: "neutral" }],
  ["comparison.", { icon: "compare", tone: "accent" }],
  ["audit.", { icon: "audit", tone: "accent" }],
  ["report.", { icon: "reports", tone: "neutral" }],
  ["prompt.", { icon: "prompts", tone: "neutral" }],
  ["website.", { icon: "globe", tone: "success" }],
  ["settings.", { icon: "settings", tone: "neutral" }],
];

export function lookFor(kind: DemoEventKind | string): Look {
  return BY_PREFIX.find(([prefix]) => kind.startsWith(prefix))?.[1] ?? { icon: "check-circle", tone: "neutral" };
}

/** Events that would only add noise to a timeline. */
const QUIET = new Set<string>(["alert.read"]);

/**
 * One timeline from authored activity plus the events recorded in this browser, newest first.
 * Events name their website directly or through any record id they carry; events with no website are skipped.
 */
export function mergeActivity(authored: readonly ActivityItem[], events: readonly DemoEvent[], options: { websiteId?: string; limit?: number } = {}): ActivityItem[] {
  const lookup = buildWebsiteLookup(events);
  const local: ActivityItem[] = [];
  for (const event of events) {
    if (QUIET.has(event.kind)) continue;
    const websiteId = event.refs.websiteId ?? Object.values(event.refs).map((v) => (typeof v === "string" ? lookup.get(v) : undefined)).find(Boolean);
    if (!websiteId) continue;
    local.push({ id: event.id, title: event.label, detail: "Simulated · this browser", at: event.at, websiteId, simulated: true, ...lookFor(event.kind) });
  }
  const all = [...authored, ...local].filter((item) => !options.websiteId || item.websiteId === options.websiteId);
  all.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  return options.limit ? all.slice(0, options.limit) : all;
}
