/** Groups matched slots by prompt for the Prompts tab. Pure: whole-number counts, pooled over the prompt's matched slots. */
import type { PairRow } from "@/types/comparison";

export type PromptChange = "gained" | "lost" | "unchanged";

export type PromptGroupRow<T extends PairRow = PairRow> = {
  promptId: string;
  text: string;
  slots: T[];
  /** Mentions out of successful responses, over the prompt's matched slots. */
  baseline: { n: number; d: number };
  current: { n: number; d: number };
  /** Percentage-point change of the pooled mention rate. */
  points: number | null;
  change: PromptChange;
  gainedSlots: number;
  lostSlots: number;
  /** Owned-citation counts over responses that returned citation data. */
  citation: { baseline: { n: number; d: number }; current: { n: number; d: number } };
};

export function groupByPrompt<T extends PairRow>(rows: T[]): PromptGroupRow<T>[] {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.promptId, [...(map.get(row.promptId) ?? []), row]);
  return [...map.entries()]
    .map(([promptId, slots]) => {
      const sum = (pick: (r: T) => { n: number; d: number }) => slots.reduce((acc, r) => ({ n: acc.n + pick(r).n, d: acc.d + pick(r).d }), { n: 0, d: 0 });
      const baseline = sum((r) => r.baseline);
      const current = sum((r) => r.current);
      const points = baseline.d > 0 && current.d > 0 ? (current.n / current.d - baseline.n / baseline.d) * 100 : null;
      return {
        promptId,
        text: slots[0].promptText,
        slots,
        baseline,
        current,
        points,
        change: points === null || Math.abs(points) < 1e-9 ? ("unchanged" as const) : points > 0 ? ("gained" as const) : ("lost" as const),
        gainedSlots: slots.filter((r) => r.change === "gained").length,
        lostSlots: slots.filter((r) => r.change === "lost").length,
        citation: {
          baseline: sum((r) => ({ n: r.baseline.cited, d: r.baseline.citationD })),
          current: sum((r) => ({ n: r.current.cited, d: r.current.citationD })),
        },
      };
    })
    .sort((a, b) => a.promptId.localeCompare(b.promptId));
}
