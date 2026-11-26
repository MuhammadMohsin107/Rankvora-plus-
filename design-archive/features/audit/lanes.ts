/**
 * Pure builders for the two audit lanes (AI visibility, website readiness), shared by the server service
 * (seeded audits) and the browser (simulated audits). No React, no demo data.
 * AI rates are computed from response samples with numerator and denominator; failures are excluded from
 * rates and counted in coverage.
 */
import { STATUS } from "@/lib/status";
import { channelLabel } from "@/lib/labels";
import type { Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";
import type {
  AiLane,
  AuditConfig,
  AuditCoverage,
  AuditDetail,
  AuditStatus,
  AuditType,
  AuditUsage,
  BreakdownRow,
  CheckStatus,
  CitationDomainRow,
  CompetitorRow,
  MetricKey,
  WebsiteCheck,
  WizardChannel,
} from "@/types/audit";

export const isDeterminate = (status: CheckStatus) => status === "pass" || status === "fail" || status === "warning";

export function aiRates(responses: ResponseSample[]): Record<MetricKey, Rate> {
  const ok = responses.filter((r) => r.status === "succeeded");
  const capable = ok.filter((r) => r.citationSupport !== "not_supported");
  return {
    mention: { n: ok.filter((r) => r.brandMentioned === "yes").length, d: ok.length },
    recommendation: { n: ok.filter((r) => r.recommendation === "recommended").length, d: ok.length },
    citation: { n: capable.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: capable.length },
  };
}

export function checkRates(checks: WebsiteCheck[]) {
  const applicable = checks.filter((c) => c.status !== "not_applicable");
  const technical = applicable.filter((c) => c.kind === "technical" && isDeterminate(c.status));
  const content = applicable.filter((c) => c.kind === "content" && isDeterminate(c.status));
  return {
    technical: { n: technical.filter((c) => c.status === "pass").length, d: technical.length },
    content: { n: content.filter((c) => c.status === "pass").length, d: content.length },
    checkCoverage: { n: applicable.filter((c) => isDeterminate(c.status)).length, d: applicable.length },
  };
}

export type AiLaneInput = {
  responses: ResponseSample[];
  planned: number;
  channels: Pick<WizardChannel, "id" | "providerLabel" | "apiLabel" | "model" | "searchMode">[];
  prompts: { id: string; groupId: string | null }[];
  groups: { id: string; name: string }[];
  brandName: string;
  suggestedCompetitors: { id: string; name: string }[];
  /** Responses of the previous comparable audit, or null when there is none. */
  baselineResponses: ResponseSample[] | null;
};

export function buildAiLane(input: AiLaneInput): AiLane {
  const { responses, channels, prompts, groups, baselineResponses } = input;
  const succeeded = responses.filter((r) => r.status === "succeeded");
  const current = aiRates(responses);
  const previous = baselineResponses ? aiRates(baselineResponses) : null;

  const row = (id: string, label: string, sub: string, rs: ResponseSample[], baseline: ResponseSample[]): BreakdownRow => {
    const base = baselineResponses ? aiRates(baseline) : null;
    return {
      id,
      label,
      sub,
      current: aiRates(rs),
      baseline: base ? base : { mention: null, recommendation: null, citation: null },
      failed: rs.filter((r) => r.status === "failed").length,
    };
  };
  const base = baselineResponses ?? [];

  const byProvider = channels
    .filter((ch) => responses.some((r) => r.channelId === ch.id))
    .map((ch) => row(ch.id, ch.providerLabel, channelLabel(ch), responses.filter((r) => r.channelId === ch.id), base.filter((r) => r.channelId === ch.id)));

  const groupOf = (promptId: string) => prompts.find((p) => p.id === promptId)?.groupId ?? null;
  const byGroup = [...groups, { id: "__none", name: "Ungrouped" }]
    .map((g) => {
      const inGroup = (r: ResponseSample) => (groupOf(r.promptId) ?? "__none") === g.id;
      const rs = responses.filter(inGroup);
      return { g, rs, promptCount: new Set(rs.map((r) => r.promptId)).size, base: base.filter(inGroup) };
    })
    .filter((x) => x.rs.length > 0)
    .map(({ g, rs, promptCount, base: b }) => row(g.id, g.name, `${promptCount} ${promptCount === 1 ? "prompt" : "prompts"}`, rs, b));

  const competitorNames = new Map<string, string>();
  for (const r of succeeded) for (const c of r.competitors) competitorNames.set(c.id, c.name);
  const competitors: CompetitorRow[] = [
    { id: "brand", name: input.brandName, mentioned: current.mention, isBrand: true },
    ...[...competitorNames.entries()].map(([id, name]) => ({
      id,
      name,
      mentioned: { n: succeeded.filter((r) => r.competitors.some((c) => c.id === id && c.mentioned)).length, d: succeeded.length },
      isBrand: false,
    })),
    // Suggested (unconfirmed) competitors are listed only when they actually appear in the answers.
    ...input.suggestedCompetitors
      .map((c) => ({ id: c.id, name: c.name, mentioned: { n: succeeded.filter((r) => r.answerText.includes(c.name)).length, d: succeeded.length }, isBrand: false, suggested: true }))
      .filter((r) => r.mentioned.n > 0),
  ];

  const citationsBySource = { owned: 0, competitor: 0, third_party: 0 };
  const domains = new Map<string, CitationDomainRow>();
  for (const r of succeeded) {
    for (const c of r.citations) {
      citationsBySource[c.source] += 1;
      const key = `${c.domain}|${c.source}`;
      const existing = domains.get(key);
      if (existing) existing.count += 1;
      else domains.set(key, { domain: c.domain, source: c.source, count: 1 });
    }
  }
  const topDomains = [...domains.values()].sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain)).slice(0, 6);

  const promptSeen = new Map<string, { id: string; text: string; version: number }>();
  for (const r of responses) if (!promptSeen.has(r.promptId)) promptSeen.set(r.promptId, { id: r.promptId, text: r.promptText, version: r.promptVersion });

  return {
    responses,
    succeeded: succeeded.length,
    failed: responses.length - succeeded.length,
    planned: input.planned,
    mention: current.mention,
    recommendation: current.recommendation,
    ownedCitation: current.citation,
    baselinePrevious: previous ? { mention: previous.mention, recommendation: previous.recommendation, ownedCitation: previous.citation } : null,
    byProvider,
    byGroup,
    competitors,
    citationsBySource,
    noCitationReturned: succeeded.filter((r) => r.citationSupport === "none_returned").length,
    citationNotSupported: succeeded.filter((r) => r.citationSupport === "not_supported").length,
    topDomains,
    prompts: [...promptSeen.values()],
    providers: channels.filter((c) => responses.some((r) => r.channelId === c.id)).map((c) => ({ id: c.id, label: c.providerLabel })),
  };
}

// ---------------------------------------------------------------------------
// Limitations and usage
// ---------------------------------------------------------------------------

export const APPROX_COST_PER_JOB_USD = 0.06;
export const APPROX_COST_PER_PAGE_USD = 0.0004;

export type LimitationInput = {
  status: AuditStatus;
  type: AuditType;
  failedJobs: number;
  plannedJobs: number;
  attempted: number;
  hasWebsite: boolean;
  config: AuditConfig;
  activePromptCount: number;
  responses: ResponseSample[];
  checks: WebsiteCheck[];
  web: Pick<AuditCoverage, "pages" | "pagesDetail">;
  baseline: { title: string; responses: ResponseSample[] } | null;
  /** Free-form notes appended before the standing caveats (simulation notes). */
  extra?: AuditDetail["limitations"];
};

export function buildLimitations(input: LimitationInput): AuditDetail["limitations"] {
  const { status, config, checks, web, responses } = input;
  const out: AuditDetail["limitations"] = [];
  const running = status === "in_progress" || status === "validating" || status === "queued";
  const ok = responses.filter((r) => r.status === "succeeded");
  if (running) out.push({ id: "provisional", tone: "warning", text: "Results are provisional until the audit completes." });
  if (status === "partially_completed") {
    out.push({ id: "partial", tone: "warning", text: "Partially completed: the audit ended before every planned request returned a usable answer. Read the rates as directional." });
  }
  if (status === "cancelled") {
    out.push({ id: "cancelled", tone: "warning", text: "Cancelled before it finished. Results cover the work completed up to that point and no snapshot was created." });
  }
  if (input.failedJobs > 0) {
    out.push({
      id: "failed",
      tone: "warning",
      text: `${input.failedJobs} of ${running || status === "cancelled" ? input.attempted : input.plannedJobs} requests failed after retries. They are excluded from rates and counted in coverage, never as "not mentioned".`,
    });
  }
  if (input.hasWebsite && !running && status !== "cancelled" && (web.pagesDetail.blocked > 0 || web.pagesDetail.unvisited > 0)) {
    out.push({ id: "pages", tone: "warning", text: `${web.pages.d - web.pages.n} of ${web.pages.d} in-scope pages were not assessed (${web.pagesDetail.blocked} blocked, ${web.pagesDetail.unvisited} not visited).` });
  }
  for (const c of checks.filter((x) => x.status === "blocked" || x.status === "error")) {
    out.push({ id: `chk-${c.id}`, tone: "warning", text: `${c.name}: ${STATUS.check[c.status as "blocked" | "error"].label.toLowerCase()}. ${c.evidence.snippet}` });
  }
  const open = checks.filter((c) => c.status === "inconclusive" || c.status === "not_assessed");
  if (!running && open.length > 0) {
    out.push({ id: "open", tone: "info", text: `${open.length} ${open.length === 1 ? "check was" : "checks were"} inconclusive or not assessed, so they count against check coverage.` });
  }
  const noCite = ok.filter((r) => r.citationSupport === "none_returned").length;
  if (noCite > 0) out.push({ id: "nocite", tone: "info", text: `${noCite} successful ${noCite === 1 ? "response" : "responses"} returned no citation. They stay in the owned-citation denominator.` });
  if (input.baseline) {
    const versions = new Map(input.baseline.responses.map((r) => [r.promptId, r.promptVersion]));
    const changed = [...new Set(ok.filter((r) => versions.has(r.promptId) && versions.get(r.promptId) !== r.promptVersion).map((r) => r.promptId))];
    if (changed.length > 0) out.push({ id: "versions", tone: "info", text: `Prompt version changed since ${input.baseline.title} (${changed.join(", ")}). Treat the comparison as partial.` });
  }
  if (input.type === "verification") out.push({ id: "scope", tone: "info", text: `Verification scope: ${config.promptIds.length} prompts, ${config.samples} ${config.samples === 1 ? "sample" : "samples"} each. Rates are directional and not comparable with a full audit.` });
  if (input.type === "focused") {
    out.push({
      id: "scope",
      tone: "info",
      text: `Focused scope: ${config.promptIds.length} of ${input.activePromptCount} active prompts${input.hasWebsite ? "" : ", AI visibility only"}. Rates are directional and not comparable with a full audit.`,
    });
  }
  out.push(...(input.extra ?? []));
  out.push({ id: "api", tone: "neutral", text: "AI results are API answer samples. They can differ from what a consumer app shows." });
  if (input.hasWebsite) out.push({ id: "lab", tone: "neutral", text: "Performance numbers are lab measurements. Field data covers few or no URLs." });
  return out;
}

export function buildUsage(responses: ResponseSample[], pagesCrawled: number, budgetUsd: number): AuditUsage {
  const attempted = responses.length;
  const ok = responses.filter((r) => r.status === "succeeded").length;
  return {
    requests: { attempted, succeeded: ok, failed: attempted - ok },
    searchCalls: responses.reduce((sum, r) => sum + r.usage.searchCalls, 0),
    inputTokens: responses.reduce((sum, r) => sum + r.usage.inputTokens, 0),
    outputTokens: responses.reduce((sum, r) => sum + r.usage.outputTokens, 0),
    pagesCrawled,
    estimatedCostUsd: Math.round((attempted * APPROX_COST_PER_JOB_USD + pagesCrawled * APPROX_COST_PER_PAGE_USD) * 100) / 100,
    budgetUsd,
  };
}
