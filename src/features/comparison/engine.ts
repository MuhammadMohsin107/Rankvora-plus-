/**
 * Deterministic comparison engine. Pure functions only: no data imports, no
 * clocks, no randomness. It runs on the server (comparison pages) and in the
 * browser (the wizard's live compatibility preview) with identical results.
 *
 * Method (methodology 1.0)
 *  1. Slots are matched on a strict key: prompt id + prompt version + channel
 *     + sample + market + language + search mode.
 *  2. A slot only joins the matched cohort when it has at least one successful
 *     response on both sides. Failed requests are excluded and reported; they
 *     are never counted as "brand absent". A pair whose model differs is
 *     excluded as well (no silent merging across models).
 *  3. Every metric is computed on the matched cohort only, with numerator and
 *     denominator on both sides.
 *  4. Comparability is derived from hard checks, soft warnings and the matched
 *     coverage; headline trends need at least 20 matched pairs.
 */
import { pluralize } from "@/lib/format";
import { MIN_MATCHED_PAIRS, pointChange, relativeChange, sampleStatus, wilsonInterval } from "@/lib/stats";
import type { Rate } from "@/types/core";
import type {
  AggregationPolicy,
  ChannelSegment,
  Check,
  Comparability,
  ComparisonFilters,
  ComparisonResult,
  DomainRow,
  ExcludedSlot,
  MetricResult,
  PairRow,
  PairSummary,
  PromptSegment,
  SentimentCounts,
  SideInfo,
  SideQuality,
  SlotCore,
  SlotLabel,
  SlotRow,
  TrendPoint,
  UnmatchedSlot,
  UrlRow,
} from "@/types/comparison";

export const METHODOLOGY_VERSION = "1.0";
export const COVERAGE_COMPARABLE = 0.75;
export const COVERAGE_WITH_WARNINGS = 0.6;

// ---------------------------------------------------------------------------
// Keys and filters
// ---------------------------------------------------------------------------

export function slotKey(r: Pick<SlotCore, "promptId" | "promptVersion" | "channelId" | "sample" | "market" | "language" | "searchMode">): string {
  return [r.promptId, `v${r.promptVersion}`, r.channelId, `s${r.sample}`, r.market, r.language, r.searchMode].join("|");
}

const looseKey = (r: Pick<SlotCore, "promptId" | "channelId" | "sample">) => `${r.promptId}|${r.channelId}|s${r.sample}`;

export function applyFilters<T extends SlotCore>(rows: T[], filters: ComparisonFilters): T[] {
  return rows.filter(
    (r) =>
      (!filters.groupId || r.groupId === filters.groupId) &&
      (!filters.promptId || r.promptId === filters.promptId) &&
      (!filters.channelId || r.channelId === filters.channelId) &&
      (!filters.market || r.market === filters.market) &&
      (!filters.language || r.language === filters.language),
  );
}

function groupByKey<T extends SlotCore>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = slotKey(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

const compareLabels = (a: SlotLabel, b: SlotLabel) =>
  a.promptId.localeCompare(b.promptId) || a.promptVersion - b.promptVersion || a.channelId.localeCompare(b.channelId) || a.sample - b.sample;

const labelOf = (key: string, r: SlotCore): SlotLabel => ({ key, promptId: r.promptId, promptVersion: r.promptVersion, channelId: r.channelId, sample: r.sample });

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export type MatchedPair<T extends SlotCore> = SlotLabel & { baseline: T[]; current: T[] };

export type Matching<T extends SlotCore> = {
  pairs: MatchedPair<T>[];
  unmatched: UnmatchedSlot[];
  excluded: ExcludedSlot[];
  baselineSlots: number;
  currentSlots: number;
};

export function matchSlots<T extends SlotCore>(baseRows: T[], currentRows: T[]): Matching<T> {
  const base = groupByKey(baseRows);
  const current = groupByKey(currentRows);
  const baseLoose = new Map<string, T[]>();
  const currentLoose = new Map<string, T[]>();
  for (const row of baseRows) baseLoose.set(looseKey(row), [...(baseLoose.get(looseKey(row)) ?? []), row]);
  for (const row of currentRows) currentLoose.set(looseKey(row), [...(currentLoose.get(looseKey(row)) ?? []), row]);

  const keys = [...new Set([...base.keys(), ...current.keys()])];
  const pairs: MatchedPair<T>[] = [];
  const unmatched: UnmatchedSlot[] = [];
  const excluded: ExcludedSlot[] = [];

  for (const key of keys) {
    const b = base.get(key);
    const c = current.get(key);
    const sample = (b ?? c)![0];
    const label = labelOf(key, sample);

    if (b && c) {
      const okB = b.filter((r) => r.ok);
      const okC = c.filter((r) => r.ok);
      if (okB.length > 0 && okC.length > 0) {
        const modelsB = new Set(okB.map((r) => r.model));
        const modelsC = new Set(okC.map((r) => r.model));
        const same = modelsB.size === modelsC.size && [...modelsB].every((m) => modelsC.has(m));
        if (same) pairs.push({ ...label, baseline: b, current: c });
        else excluded.push({ ...label, reason: "model_changed", detail: `Model changed: ${[...modelsB].join(", ")} → ${[...modelsC].join(", ")}` });
      } else if (okB.length === 0 && okC.length === 0) {
        excluded.push({ ...label, reason: "failed_both", detail: "Request failed on both sides. Not counted as brand absent." });
      } else if (okB.length === 0) {
        excluded.push({ ...label, reason: "failed_baseline", detail: "Request failed on baseline. Not counted as brand absent." });
      } else {
        excluded.push({ ...label, reason: "failed_current", detail: "Request failed on current. Not counted as brand absent." });
      }
      continue;
    }

    const presentOn = b ? "baseline" : "current";
    const otherLoose = (presentOn === "baseline" ? currentLoose : baseLoose).get(looseKey(sample)) ?? [];
    const otherName = presentOn === "baseline" ? "current" : "baseline";
    const versionDiff = otherLoose.filter((r) => r.promptVersion !== sample.promptVersion);
    if (versionDiff.length > 0) {
      const versions = [...new Set(versionDiff.map((r) => r.promptVersion))].sort((x, y) => x - y).map((v) => `v${v}`).join(", ");
      unmatched.push({ ...label, presentOn, reason: "version_changed", detail: `Prompt version changed: v${sample.promptVersion} on ${presentOn}, ${versions} on ${otherName}` });
    } else if (otherLoose.some((r) => r.searchMode !== sample.searchMode)) {
      unmatched.push({ ...label, presentOn, reason: "search_mode_changed", detail: `Search mode differs on ${otherName}` });
    } else if (otherLoose.some((r) => r.market !== sample.market || r.language !== sample.language)) {
      unmatched.push({ ...label, presentOn, reason: "locale_differs", detail: `Market or language differs on ${otherName}` });
    } else {
      unmatched.push({ ...label, presentOn, reason: "not_run", detail: `Not run on ${otherName}` });
    }
  }

  pairs.sort(compareLabels);
  unmatched.sort(compareLabels);
  excluded.sort(compareLabels);
  return { pairs, unmatched, excluded, baselineSlots: base.size, currentSlots: current.size };
}

// ---------------------------------------------------------------------------
// Comparability
// ---------------------------------------------------------------------------

export function sideKind(runIds: string[]): SideInfo["kind"] {
  const audit = runIds.some((id) => id.startsWith("aud-"));
  const monitoring = runIds.some((id) => id.startsWith("run-"));
  return audit && monitoring ? "mixed" : audit ? "audit" : "monitoring";
}

const KIND_LABEL = { audit: "audit", monitoring: "monitoring", mixed: "mixed" } as const;

export type Assessment = { verdict: Comparability; checks: Check[]; coverage: Rate };

export function assessComparability(baseline: SideInfo, current: SideInfo, baseRows: SlotCore[], currentRows: SlotCore[], matching: Matching<SlotCore>): Assessment {
  const checks: Check[] = [];
  const coverage: Rate = { n: matching.pairs.length, d: Math.max(matching.baselineSlots, matching.currentSlots) };

  const storesB = new Set(baseRows.map((r) => r.storeId));
  const storesC = new Set(currentRows.map((r) => r.storeId));
  const sameStore = storesB.size <= 1 && storesC.size <= 1 && [...storesB].every((s) => storesC.has(s));
  checks.push({ id: "same-store", kind: "hard", state: sameStore ? "pass" : "fail", label: "Same store", detail: sameStore ? "Both sides belong to this store." : "Sides come from different stores. Portfolio comparison lives on the Portfolio page." });

  const sameBrand = baseline.brand === current.brand;
  checks.push({ id: "same-brand", kind: "hard", state: sameBrand ? "pass" : "fail", label: "Same brand", detail: sameBrand ? `Both sides track ${baseline.brand}.` : `${baseline.brand} vs ${current.brand}.` });

  const versionsB = new Set(baseRows.map((r) => r.analysisVersion));
  const versionsC = new Set(currentRows.map((r) => r.analysisVersion));
  const sameMetric = versionsB.size === versionsC.size && [...versionsB].every((v) => versionsC.has(v));
  checks.push({
    id: "same-metric-version",
    kind: "hard",
    state: sameMetric ? "pass" : "fail",
    label: "Same metric definitions",
    detail: sameMetric ? `Analysis version ${[...versionsB].join(", ") || "—"} on both sides.` : `Analysis version ${[...versionsB].join(", ")} vs ${[...versionsC].join(", ")}.`,
  });

  const shared = baseline.runIds.filter((id) => current.runIds.includes(id));
  checks.push({
    id: "independent-sources",
    kind: "hard",
    state: shared.length === 0 ? "pass" : "fail",
    label: "Different sources",
    detail: shared.length === 0 ? "Baseline and current use different runs." : `Both sides include ${shared.join(", ")}. Pick non-overlapping sources.`,
  });

  const okB = baseRows.filter((r) => r.ok).length;
  const okC = currentRows.filter((r) => r.ok).length;
  const hasData = okB > 0 && okC > 0;
  checks.push({
    id: "has-data",
    kind: "hard",
    state: hasData ? "pass" : "fail",
    label: "Successful responses on both sides",
    detail: hasData ? `${okB} baseline and ${okC} current successful responses.` : `${okB} baseline and ${okC} current successful responses in scope.`,
  });

  // Soft warnings
  const versionChanged = matching.unmatched.filter((u) => u.reason === "version_changed");
  const versionPrompts = new Set(versionChanged.map((u) => u.promptId));
  checks.push({
    id: "prompt-versions",
    kind: "soft",
    state: versionChanged.length ? "warn" : "pass",
    severity: "minor",
    label: "Prompt versions",
    detail: versionChanged.length ? `${pluralize(versionChanged.length, "slot")} across ${pluralize(versionPrompts.size, "prompt")} ran a different prompt version and are unmatched.` : "Every compared slot used the same prompt version.",
  });

  const failedExcluded = matching.excluded.filter((e) => e.reason.startsWith("failed"));
  checks.push({
    id: "failed-requests",
    kind: "soft",
    state: failedExcluded.length ? "warn" : "pass",
    severity: "minor",
    label: "Failed requests",
    detail: failedExcluded.length ? `${pluralize(failedExcluded.length, "slot")} failed on at least one side and ${failedExcluded.length === 1 ? "is" : "are"} excluded, not counted as absent.` : "No matched slot failed on either side.",
  });

  const modelChanged = matching.excluded.filter((e) => e.reason === "model_changed");
  checks.push({
    id: "model-change",
    kind: "soft",
    state: modelChanged.length ? "warn" : "pass",
    severity: "major",
    label: "Model",
    detail: modelChanged.length ? `${pluralize(modelChanged.length, "matched slot")} used a different model. Excluded and never merged.` : "The model is unchanged in every matched slot.",
  });

  const modeChanged = matching.unmatched.filter((u) => u.reason === "search_mode_changed");
  checks.push({
    id: "search-mode",
    kind: "soft",
    state: modeChanged.length ? "warn" : "pass",
    severity: "major",
    label: "Search mode",
    detail: modeChanged.length ? `${pluralize(modeChanged.length, "slot")} used a different search mode and cannot be matched.` : "Search mode is unchanged.",
  });

  const localeDiff = matching.unmatched.filter((u) => u.reason === "locale_differs");
  checks.push({
    id: "locale",
    kind: "soft",
    state: localeDiff.length ? "warn" : "pass",
    severity: "major",
    label: "Market and language",
    detail: localeDiff.length ? `${pluralize(localeDiff.length, "slot")} differ in market or language and cannot be matched.` : "Market and language are unchanged.",
  });

  const kindDiff = baseline.kind !== current.kind;
  checks.push({
    id: "run-type",
    kind: "soft",
    state: kindDiff ? "warn" : "pass",
    severity: "major",
    label: "Run type",
    detail: kindDiff ? `Baseline is ${KIND_LABEL[baseline.kind]}, current is ${KIND_LABEL[current.kind]}: sampling and schedule differ.` : `Both sides are ${KIND_LABEL[baseline.kind]} runs.`,
  });

  const notRun = matching.unmatched.filter((u) => u.reason === "not_run");
  checks.push({
    id: "not-run",
    kind: "soft",
    state: notRun.length ? "warn" : "pass",
    severity: "minor",
    label: "Slots on one side only",
    detail: notRun.length ? `${pluralize(notRun.length, "slot")} not run on the other side.` : "Both sides ran the same slots.",
  });

  const reversed = baseline.from > current.from;
  checks.push({
    id: "order",
    kind: "soft",
    state: reversed ? "warn" : "pass",
    severity: "minor",
    label: "Order",
    detail: reversed ? "The current side is older than the baseline." : "Current is later than baseline.",
  });

  const enough = matching.pairs.length >= MIN_MATCHED_PAIRS;
  checks.push({
    id: "sample-size",
    kind: "soft",
    state: enough ? "pass" : "fail",
    severity: "major",
    label: "Sample size",
    detail: enough ? `${matching.pairs.length} matched pairs (policy: at least ${MIN_MATCHED_PAIRS} for a headline trend).` : `${matching.pairs.length} matched pairs. A headline trend needs at least ${MIN_MATCHED_PAIRS}.`,
  });

  const hardFail = checks.some((c) => c.kind === "hard" && c.state === "fail");
  const major = checks.some((c) => c.kind === "soft" && c.severity === "major" && c.state === "warn");
  const ratio = coverage.d > 0 ? coverage.n / coverage.d : 0;

  let verdict: Comparability;
  if (hardFail) verdict = "not_comparable";
  else if (!enough) verdict = "insufficient_data";
  else if (major) verdict = "partially_comparable";
  else if (ratio >= COVERAGE_COMPARABLE) verdict = "comparable";
  else if (ratio >= COVERAGE_WITH_WARNINGS) verdict = "comparable_with_warnings";
  else verdict = "partially_comparable";

  return { verdict, checks, coverage };
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const round2 = (v: number) => Math.round(v * 100) / 100;
const okOf = (rows: SlotRow[]) => rows.filter((r) => r.ok);

type SlotRate = (rows: SlotRow[]) => Rate | null;
type MetricSpec = { id: string; label: string; unit: string; info?: string; goodWhen?: "up" | "down"; slot: SlotRate; /** Ratio of sums: slot ratios have variable denominators, so it is always pooled. */ pooledOnly?: boolean };

const mentionSpec: MetricSpec = {
  id: "mention",
  label: "Brand mention rate",
  unit: "responses",
  info: "Responses that mention the brand ÷ successful responses in the matched cohort.",
  slot: (rows) => ({ n: rows.filter((r) => r.mentioned).length, d: rows.length }),
};

const recommendationSpec: MetricSpec = {
  id: "recommendation",
  label: "Recommendation rate",
  unit: "responses",
  info: "Responses that recommend the brand ÷ successful responses in the matched cohort.",
  slot: (rows) => ({ n: rows.filter((r) => r.recommended).length, d: rows.length }),
};

const conditionalSpec: MetricSpec = {
  id: "recommendation-conditional",
  label: "Recommended when mentioned",
  unit: "mentions",
  info: "Recommended ÷ responses that mention the brand. N/A when no matched slot mentions the brand on both sides.",
  slot: (rows) => {
    const mentioned = rows.filter((r) => r.mentioned);
    return mentioned.length ? { n: mentioned.filter((r) => r.recommended).length, d: mentioned.length } : null;
  },
};

function citationSpec(domain?: string): MetricSpec {
  return {
    id: "citation",
    label: domain ? `Citation rate: ${domain}` : "Owned-domain citation rate",
    unit: "responses with citation data",
    info: "Responses citing the target domain ÷ responses that returned citation data. Providers without citation support are N/A, never 0%.",
    slot: (rows) => {
      const withData = rows.filter((r) => r.citationSupport === "returned");
      if (withData.length === 0) return null;
      const hit = (r: SlotRow) => (domain ? r.domains.includes(domain) : r.ownedCited);
      return { n: withData.filter(hit).length, d: withData.length };
    },
  };
}

const positiveSpec: MetricSpec = {
  id: "positive-sentiment",
  label: "Positive sentiment share",
  unit: "mentions",
  info: "Positive-sentiment responses ÷ responses that mention the brand.",
  slot: (rows) => {
    const mentioned = rows.filter((r) => r.mentioned);
    return mentioned.length ? { n: mentioned.filter((r) => r.sentiment === "positive").length, d: mentioned.length } : null;
  },
};

const shareOfVoiceSpec: MetricSpec = {
  id: "share-of-voice",
  label: "Share of voice (tracked)",
  unit: "tracked mentions",
  info: "Brand mentions ÷ (brand mentions + tracked competitor mentions). Counts only tracked competitors. Always pooled over the matched cohort.",
  pooledOnly: true,
  slot: (rows) => {
    const brand = rows.filter((r) => r.mentioned).length;
    const total = brand + rows.reduce((sum, r) => sum + r.competitors.length, 0);
    return total > 0 ? { n: brand, d: total } : null;
  },
};

const competitorSpec = (id: string, name: string): MetricSpec => ({
  id: `competitor-${id}`,
  label: name,
  unit: "responses",
  info: `Responses naming ${name} ÷ successful responses in the matched cohort.`,
  goodWhen: "down",
  slot: (rows) => ({ n: rows.filter((r) => r.competitors.includes(name)).length, d: rows.length }),
});

function computeMetric(spec: MetricSpec, pairs: MatchedPair<SlotRow>[], aggregation: AggregationPolicy): MetricResult {
  const mode: AggregationPolicy = spec.pooledOnly ? "pooled" : aggregation;
  const eligible: { b: Rate; c: Rate }[] = [];
  for (const pair of pairs) {
    const b = spec.slot(okOf(pair.baseline));
    const c = spec.slot(okOf(pair.current));
    if (b && c && b.d > 0 && c.d > 0) eligible.push({ b, c });
  }
  const goodWhen = spec.goodWhen ?? "up";
  const base = { id: spec.id, label: spec.label, unit: spec.unit, info: spec.info, goodWhen };

  if (eligible.length === 0) {
    return {
      ...base,
      baseline: null,
      current: null,
      pooledBaseline: null,
      pooledCurrent: null,
      cohort: 0,
      pointChange: null,
      relativeChange: null,
      zeroBaseline: false,
      countChange: null,
      denominatorChange: null,
      baselineCi: null,
      currentCi: null,
      sample: "insufficient",
      na: "No matched slot has data on both sides",
    };
  }

  const sum = (pick: (e: { b: Rate; c: Rate }) => Rate): Rate => eligible.reduce<Rate>((acc, e) => ({ n: acc.n + pick(e).n, d: acc.d + pick(e).d }), { n: 0, d: 0 });
  const macro = (pick: (e: { b: Rate; c: Rate }) => Rate): Rate => ({ n: round2(eligible.reduce((acc, e) => acc + pick(e).n / pick(e).d, 0)), d: eligible.length });

  const pooledBaseline = sum((e) => e.b);
  const pooledCurrent = sum((e) => e.c);
  const baseline = mode === "pooled" ? pooledBaseline : macro((e) => e.b);
  const current = mode === "pooled" ? pooledCurrent : macro((e) => e.c);

  return {
    ...base,
    baseline,
    current,
    pooledBaseline,
    pooledCurrent,
    cohort: eligible.length,
    pointChange: pointChange(baseline, current),
    relativeChange: relativeChange(baseline, current),
    zeroBaseline: baseline.n === 0 && current.n > 0,
    countChange: pooledCurrent.n - pooledBaseline.n,
    denominatorChange: pooledCurrent.d - pooledBaseline.d,
    baselineCi: wilsonInterval(baseline.n, baseline.d),
    currentCi: wilsonInterval(current.n, current.d),
    sample: sampleStatus(eligible.length),
  };
}

// ---------------------------------------------------------------------------
// Full comparison
// ---------------------------------------------------------------------------

export type EngineContext = {
  channelLabels: Record<string, string>;
  promptText: Record<string, string>;
  competitors: { id: string; name: string }[];
  ownedDomains: string[];
  competitorDomains: string[];
};

function summarise(rows: SlotRow[]): PairSummary {
  const ok = okOf(rows);
  const latest = [...ok].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  return {
    n: ok.filter((r) => r.mentioned).length,
    d: ok.length,
    recommended: ok.filter((r) => r.recommended).length,
    failed: rows.length - ok.length,
    outcome: ok.length === 1 ? ok[0].outcome : null,
    latestResponseId: latest?.responseId ?? null,
  };
}

const change = (b: number, c: number): "gained" | "lost" | "unchanged" => (c > b ? "gained" : c < b ? "lost" : "unchanged");

function sentimentCounts(rows: SlotRow[]): SentimentCounts {
  const counts: SentimentCounts = { positive: 0, neutral: 0, negative: 0, mixed: 0, unknown: 0, total: 0 };
  for (const r of rows) {
    if (!r.ok || !r.mentioned) continue;
    counts[r.sentiment] += 1;
    counts.total += 1;
  }
  return counts;
}

function qualityOf(label: string, rows: SlotRow[]): SideQuality {
  const failed = rows.filter((r) => !r.ok);
  const classes = new Map<string, number>();
  for (const r of failed) classes.set(r.failureClass ?? "unknown", (classes.get(r.failureClass ?? "unknown") ?? 0) + 1);
  return {
    label,
    attempted: { n: rows.length, d: rows.length },
    success: { n: rows.length - failed.length, d: rows.length },
    failedByClass: [...classes.entries()].map(([cls, count]) => ({ cls, count })).sort((a, b) => b.count - a.count || a.cls.localeCompare(b.cls)),
  };
}

export function compareSides(
  baseline: SideInfo,
  current: SideInfo,
  baseAll: SlotRow[],
  currentAll: SlotRow[],
  filters: ComparisonFilters,
  aggregation: AggregationPolicy,
  ctx: EngineContext,
): ComparisonResult {
  const baseRows = applyFilters(baseAll, filters);
  const currentRows = applyFilters(currentAll, filters);
  const matching = matchSlots(baseRows, currentRows);
  const assessment = assessComparability(baseline, current, baseRows, currentRows, matching);
  const pairs = matching.pairs;

  const headline = [
    computeMetric(mentionSpec, pairs, aggregation),
    computeMetric(recommendationSpec, pairs, aggregation),
    computeMetric(conditionalSpec, pairs, aggregation),
    computeMetric(citationSpec(filters.domain), pairs, aggregation),
    computeMetric(positiveSpec, pairs, aggregation),
    computeMetric(shareOfVoiceSpec, pairs, aggregation),
  ];

  const competitorList = ctx.competitors.filter((c) => !filters.competitorId || c.id === filters.competitorId);
  const competitors = competitorList.map((c) => computeMetric(competitorSpec(c.id, c.name), pairs, aggregation));
  const appeared: string[] = [];
  const gone: string[] = [];
  competitors.forEach((m) => {
    if (!m.pooledBaseline || !m.pooledCurrent) return;
    if (m.pooledBaseline.n === 0 && m.pooledCurrent.n > 0) appeared.push(m.label);
    if (m.pooledBaseline.n > 0 && m.pooledCurrent.n === 0) gone.push(m.label);
  });

  const channelIds = [...new Set(pairs.map((p) => p.channelId))].sort();
  const channels: ChannelSegment[] = channelIds.map((channelId) => {
    const subset = pairs.filter((p) => p.channelId === channelId);
    const citation = computeMetric(citationSpec(filters.domain), subset, aggregation);
    if (citation.na) {
      const allRows = subset.flatMap((p) => [...p.baseline, ...p.current]).filter((r) => r.ok);
      citation.na = allRows.length > 0 && allRows.every((r) => r.citationSupport === "not_supported") ? "Not supported by this provider" : "No citation data returned";
    }
    const modelsOf = (side: "baseline" | "current") => [...new Set(subset.flatMap((p) => p[side]).map((r) => r.model))].sort();
    return {
      channelId,
      label: ctx.channelLabels[channelId] ?? channelId,
      matchedPairs: subset.length,
      mention: computeMetric(mentionSpec, subset, aggregation),
      recommendation: computeMetric(recommendationSpec, subset, aggregation),
      citation,
      baselineModels: modelsOf("baseline"),
      currentModels: modelsOf("current"),
      modelChanged: matching.excluded.some((e) => e.reason === "model_changed" && e.channelId === channelId),
    };
  });

  const promptIds = [...new Set(pairs.map((p) => p.promptId))].sort();
  const prompts: PromptSegment[] = promptIds.map((promptId) => {
    const subset = pairs.filter((p) => p.promptId === promptId);
    return {
      promptId,
      text: ctx.promptText[promptId] ?? promptId,
      versions: [...new Set(subset.map((p) => p.promptVersion))].sort((a, b) => a - b),
      matchedPairs: subset.length,
      mention: computeMetric(mentionSpec, subset, aggregation),
    };
  });

  const unionPrompts = new Set([...baseRows, ...currentRows].map((r) => r.promptId));

  const matchedRows: PairRow[] = pairs.map((pair) => {
    const b = summarise(pair.baseline);
    const c = summarise(pair.current);
    return {
      key: pair.key,
      promptId: pair.promptId,
      promptVersion: pair.promptVersion,
      channelId: pair.channelId,
      sample: pair.sample,
      promptText: ctx.promptText[pair.promptId] ?? pair.promptId,
      channelLabel: ctx.channelLabels[pair.channelId] ?? pair.channelId,
      baseline: b,
      current: c,
      change: change(b.n / b.d, c.n / c.d),
      recommendationChange: change(b.recommended / b.d, c.recommended / c.d),
    };
  });

  // Sentiment (matched cohort, responses that mention the brand)
  const matchedBase = pairs.flatMap((p) => p.baseline);
  const matchedCurrent = pairs.flatMap((p) => p.current);
  const latestMentioned = (rows: SlotRow[]) => [...rows.filter((r) => r.ok)].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))[0];
  const excerpts = pairs
    .map((pair) => {
      const b = latestMentioned(pair.baseline);
      const c = latestMentioned(pair.current);
      return { pair, b, c };
    })
    .filter(({ b, c }) => b && c && (b.mentioned || c.mentioned) && (b.sentiment !== c.sentiment || b.mentioned !== c.mentioned))
    .slice(0, 6)
    .map(({ pair, b, c }) => ({
      key: pair.key,
      promptText: ctx.promptText[pair.promptId] ?? pair.promptId,
      channelLabel: ctx.channelLabels[pair.channelId] ?? pair.channelId,
      baselineQuote: b.mentioned ? b.quote : null,
      currentQuote: c.mentioned ? c.quote : null,
      baselineSentiment: b.mentioned ? b.sentiment : "not mentioned",
      currentSentiment: c.mentioned ? c.sentiment : "not mentioned",
    }));

  // Cited domains (matched cohort, responses that returned citation data)
  const domainSet = new Map<string, DomainRow["source"]>();
  const classify = (domain: string): DomainRow["source"] => (ctx.ownedDomains.includes(domain) ? "owned" : ctx.competitorDomains.includes(domain) ? "competitor" : "third_party");
  const countDomains = (rows: SlotRow[]) => {
    const withData = rows.filter((r) => r.ok && r.citationSupport === "returned");
    const map = new Map<string, number>();
    for (const r of withData) {
      for (const d of new Set(r.domains)) {
        map.set(d, (map.get(d) ?? 0) + 1);
        domainSet.set(d, classify(d));
      }
    }
    return { map, total: withData.length };
  };
  const cb = countDomains(matchedBase);
  const cc = countDomains(matchedCurrent);
  const domains: DomainRow[] = [...domainSet.entries()]
    .map(([domain, source]) => ({ domain, source, baseline: { n: cb.map.get(domain) ?? 0, d: cb.total }, current: { n: cc.map.get(domain) ?? 0, d: cc.total } }))
    .sort((a, b) => b.baseline.n + b.current.n - (a.baseline.n + a.current.n) || a.domain.localeCompare(b.domain));

  // Cited URLs (same basis as domains)
  const urlMeta = new Map<string, { title: string; domain: string }>();
  const countUrls = (rows: SlotRow[]) => {
    const map = new Map<string, number>();
    for (const r of rows.filter((x) => x.ok && x.citationSupport === "returned")) {
      for (const u of new Map(r.urls.map((x) => [x.url, x])).values()) {
        map.set(u.url, (map.get(u.url) ?? 0) + 1);
        urlMeta.set(u.url, { title: u.title, domain: u.domain });
      }
    }
    return map;
  };
  const ub = countUrls(matchedBase);
  const uc = countUrls(matchedCurrent);
  const urls: UrlRow[] = [...urlMeta.entries()]
    .map(([url, meta]) => ({ url, ...meta, baseline: { n: ub.get(url) ?? 0, d: cb.total }, current: { n: uc.get(url) ?? 0, d: cc.total } }))
    .sort((a, b) => b.baseline.n + b.current.n - (a.baseline.n + a.current.n) || a.url.localeCompare(b.url));

  // Trend: per run, matched keys only
  const matchedKeys = new Set(pairs.map((p) => p.key));
  const trend: TrendPoint[] = [];
  const pushTrend = (rows: SlotRow[], side: "baseline" | "current") => {
    const byRun = new Map<string, SlotRow[]>();
    for (const r of rows) if (r.ok && matchedKeys.has(slotKey(r))) byRun.set(r.runId, [...(byRun.get(r.runId) ?? []), r]);
    for (const [runId, list] of byRun) {
      const at = list.map((r) => r.requestedAt).sort()[0];
      trend.push({ runId, side, at, mention: { n: list.filter((r) => r.mentioned).length, d: list.length }, recommendation: { n: list.filter((r) => r.recommended).length, d: list.length } });
    }
  };
  pushTrend(baseRows, "baseline");
  pushTrend(currentRows, "current");
  trend.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const okBase = okOf(baseRows);
  const okCurrent = okOf(currentRows);
  const qualityBase = qualityOf(baseline.label, baseRows);
  const qualityCurrent = qualityOf(current.label, currentRows);

  const successMetric = (): MetricResult => {
    const b = qualityBase.success;
    const c = qualityCurrent.success;
    return {
      id: "success-rate",
      label: "Response success rate",
      unit: "requests",
      info: "Operational metric over every request in scope (not only the matched cohort). Failed requests are never counted as brand absent.",
      baseline: b,
      current: c,
      pooledBaseline: b,
      pooledCurrent: c,
      cohort: Math.min(b.d, c.d),
      pointChange: pointChange(b, c),
      relativeChange: relativeChange(b, c),
      zeroBaseline: false,
      countChange: c.n - b.n,
      denominatorChange: c.d - b.d,
      baselineCi: wilsonInterval(b.n, b.d),
      currentCi: wilsonInterval(c.n, c.d),
      sample: sampleStatus(Math.min(b.d, c.d)),
      goodWhen: "up",
    };
  };

  return {
    verdict: assessment.verdict,
    aggregation,
    matchedPairs: pairs.length,
    baselineSlots: matching.baselineSlots,
    currentSlots: matching.currentSlots,
    coverage: assessment.coverage,
    checks: assessment.checks,
    headline,
    competitors,
    channels,
    prompts,
    promptCoverage: { n: promptIds.length, d: unionPrompts.size },
    successRate: successMetric(),
    matchedRows,
    unmatched: matching.unmatched,
    excluded: matching.excluded,
    quality: { baseline: qualityBase, current: qualityCurrent },
    sentiment: { baseline: sentimentCounts(matchedBase), current: sentimentCounts(matchedCurrent), excerpts },
    domains,
    urls,
    competitorAppeared: appeared,
    competitorGone: gone,
    trend,
    wholeSource: {
      baseline: { n: okBase.filter((r) => r.mentioned).length, d: okBase.length },
      current: { n: okCurrent.filter((r) => r.mentioned).length, d: okCurrent.length },
    },
    runs: { baseline: baseline.runIds, current: current.runIds },
  };
}

// ---------------------------------------------------------------------------
// Preview (wizard): matching and checks only, on slim rows
// ---------------------------------------------------------------------------

export type Preview = {
  matching: Matching<SlotCore>;
  assessment: Assessment;
  mention: { baseline: Rate; current: Rate };
  baselineRows: number;
  currentRows: number;
};

export function previewComparison(baseline: SideInfo, current: SideInfo, baseAll: SlotCore[], currentAll: SlotCore[], filters: ComparisonFilters): Preview {
  const baseRows = applyFilters(baseAll, filters);
  const currentRows = applyFilters(currentAll, filters);
  const matching = matchSlots(baseRows, currentRows);
  const assessment = assessComparability(baseline, current, baseRows, currentRows, matching);
  const pooled = (side: "baseline" | "current"): Rate => {
    const rows = matching.pairs.flatMap((p) => p[side]).filter((r) => r.ok);
    return { n: rows.filter((r) => r.mentioned).length, d: rows.length };
  };
  return { matching, assessment, mention: { baseline: pooled("baseline"), current: pooled("current") }, baselineRows: baseRows.length, currentRows: currentRows.length };
}

/** Human labels for exclusion / unmatched reasons. */
export const REASON_LABEL: Record<string, string> = {
  failed_baseline: "Failed on baseline",
  failed_current: "Failed on current",
  failed_both: "Failed on both sides",
  model_changed: "Model changed",
  version_changed: "Prompt version changed",
  search_mode_changed: "Search mode changed",
  locale_differs: "Market or language differs",
  not_run: "Not run on one side",
};
