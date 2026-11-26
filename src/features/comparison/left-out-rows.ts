import type { ExcludedSlot, UnmatchedSlot } from "@/types/comparison";

export type LeftOutRow = {
  id: string;
  status: "Unmatched" | "Excluded";
  promptId: string;
  promptText: string;
  /** Prompt version and sample, e.g. "v2 · sample 1". Empty for a prompt that never ran. */
  slot: string;
  channel: string;
  reason: string;
  detail: string;
};

export type LeftOutContext = { promptText: Record<string, string>; channelLabels: Record<string, string> };

/** Unmatched and excluded slots as one list, filterable by status and reason. Nothing is merged into the headline. */
export function leftOutRows(unmatched: UnmatchedSlot[], excluded: ExcludedSlot[], ctx: LeftOutContext): LeftOutRow[] {
  const make = (status: LeftOutRow["status"], r: UnmatchedSlot | ExcludedSlot): LeftOutRow => ({
    id: `${status}-${r.key}-${r.reason}`,
    status,
    promptId: r.promptId,
    promptText: ctx.promptText[r.promptId] ?? r.promptId,
    slot: `v${r.promptVersion} · sample ${r.sample}`,
    channel: ctx.channelLabels[r.channelId] ?? r.channelId,
    reason: r.reason,
    detail: r.detail,
  });
  return [...unmatched.map((r) => make("Unmatched", r)), ...excluded.map((r) => make("Excluded", r))];
}
