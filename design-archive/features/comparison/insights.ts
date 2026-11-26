/**
 * "What changed": up to three evidence-linked statements written from calculated results only.
 * Deterministic text, no language model. Each item can link to the rows that back it.
 */
import { percentText, pointsText } from "@/features/comparison/metric-format";
import { MIN_MATCHED_PAIRS } from "@/lib/stats";
import { pluralize } from "@/lib/format";
import type { ComparisonResult } from "@/types/comparison";

export type Insight = {
  id: string;
  tone: "success" | "danger" | "warning" | "neutral";
  text: string;
  /** Tab (and query) the statement is backed by, relative to the comparison. */
  to?: { tab: "prompts" | "quality" | "breakdowns"; query?: string };
  /** Ids for an evidence trace: the prompt and a response behind the statement. */
  evidence?: { promptId: string; responseId: string | null };
};

export function buildInsights(result: ComparisonResult): Insight[] {
  if (result.verdict === "not_comparable") return [];
  const out: Insight[] = [];
  const mention = result.headline.find((m) => m.id === "mention");

  if (result.matchedPairs < MIN_MATCHED_PAIRS) {
    out.push({ id: "sample", tone: "warning", text: `${pluralize(result.matchedPairs, "matched pair")}, below ${MIN_MATCHED_PAIRS}. Read the counts, not a trend.`, to: { tab: "quality" } });
  } else if (mention && !mention.na && mention.pointChange !== null) {
    const change = mention.pointChange;
    const verb = change > 0 ? "rose" : change < 0 ? "fell" : "did not change";
    out.push({
      id: "mention",
      tone: change > 0 ? "success" : change < 0 ? "danger" : "neutral",
      text: change === 0 ? `Mention rate did not change (${percentText(mention, "current")}).` : `Mention rate ${verb} ${pointsText(mention).replace(/^[+−]/, "")} (${percentText(mention, "baseline")} to ${percentText(mention, "current")}).`,
    });
  }

  const lost = result.matchedRows.filter((r) => r.change === "lost");
  const gained = result.matchedRows.filter((r) => r.change === "gained");
  if (lost.length + gained.length > 0) {
    const example = lost[0] ?? gained[0];
    out.push({
      id: "slots",
      tone: lost.length > gained.length ? "danger" : "success",
      text: `${pluralize(lost.length, "slot")} lost the brand mention, ${pluralize(gained.length, "slot")} gained it.`,
      to: { tab: "prompts", query: lost.length ? "change=lost" : "change=gained" },
      evidence: { promptId: example.promptId, responseId: example.current.latestResponseId },
    });
  }

  if (result.competitorAppeared.length > 0) {
    out.push({ id: "competitors", tone: "warning", text: `${result.competitorAppeared.slice(0, 2).join(", ")} newly named in answers.`, to: { tab: "breakdowns", query: "view=competitors" } });
  } else if (result.unmatched.length + result.excluded.length > 0) {
    out.push({ id: "left-out", tone: "neutral", text: `${pluralize(result.unmatched.length + result.excluded.length, "slot")} left out of the comparison.`, to: { tab: "prompts", query: "left=1" } });
  }
  return out.slice(0, 3);
}
