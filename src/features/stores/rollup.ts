import { pointChange } from "@/lib/stats";
import type { Rate, Store } from "@/types/core";

/**
 * Portfolio roll-up. Counts are pooled (sum of numerators over sum of denominators), never an average of
 * website percentages. A website only joins a metric when it has data for it, and a website without
 * tracking data is left out and shown as N/A, never counted as 0.
 */
export type Rollup = {
  mention: Rate;
  mentionPrevious: Rate;
  recommendation: Rate;
  recommendationPrevious: Rate;
  citation: Rate;
  citationPrevious: Rate;
  /** Websites with tracking data. */
  tracked: number;
  /** Websites in the roll-up scope (archived ones are out of scope). */
  total: number;
  /** Tracked websites that have citation-capable responses. */
  citationWebsites: number;
  markets: string[];
  untracked: Store[];
  /** Change in percentage points against the previous run of each website, pooled the same way. */
  change: { mention: number | null; recommendation: number | null; citation: number | null };
};

const ZERO: Rate = { n: 0, d: 0 };

function sum(stores: Store[], pick: (s: NonNullable<Store["summary"]>) => Rate): Rate {
  return stores.reduce<Rate>((acc, store) => {
    if (!store.summary) return acc;
    const rate = pick(store.summary);
    return { n: acc.n + rate.n, d: acc.d + rate.d };
  }, ZERO);
}

/** Pools the headline rates of every non-archived website. */
export function pooledRollup(websites: Store[]): Rollup {
  const scope = websites.filter((w) => w.status !== "archived");
  const tracked = scope.filter((w) => w.summary);
  const withCitations = tracked.filter((w) => (w.summary?.ownedCitation.d ?? 0) > 0);
  const mention = sum(tracked, (s) => s.mention);
  const mentionPrevious = sum(tracked, (s) => s.mentionPrevious);
  const recommendation = sum(tracked, (s) => s.recommendation);
  const recommendationPrevious = sum(tracked, (s) => s.recommendationPrevious);
  const citation = sum(withCitations, (s) => s.ownedCitation);
  const citationPrevious = sum(withCitations, (s) => s.ownedCitationPrevious);
  return {
    mention,
    mentionPrevious,
    recommendation,
    recommendationPrevious,
    citation,
    citationPrevious,
    tracked: tracked.length,
    total: scope.length,
    citationWebsites: withCitations.length,
    markets: [...new Set(tracked.map((w) => w.market))],
    untracked: scope.filter((w) => !w.summary),
    change: {
      mention: mention.d > 0 && mentionPrevious.d > 0 ? pointChange(mentionPrevious, mention) : null,
      recommendation: recommendation.d > 0 && recommendationPrevious.d > 0 ? pointChange(recommendationPrevious, recommendation) : null,
      citation: citation.d > 0 && citationPrevious.d > 0 ? pointChange(citationPrevious, citation) : null,
    },
  };
}

/** "Pooled across 2 websites" */
export function pooledLabel(rollup: Pick<Rollup, "tracked">): string {
  return `Pooled across ${rollup.tracked} ${rollup.tracked === 1 ? "website" : "websites"}`;
}

/** Why the numbers are pooled the way they are. One short sentence for a tooltip. */
export const POOLED_EXPLANATION =
  "Counts are added across websites, not an average of percentages. Websites differ in markets, channels and prompts, so each website card also shows its own rate. A website with no data is left out.";
