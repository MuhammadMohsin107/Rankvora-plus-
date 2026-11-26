/**
 * Builds the results of a simulated audit from an existing audit's data (the "basis"), restricted to the
 * audit's own scope and to how far its run has got. Pure: no React, no clock reads. Every value that comes
 * from the basis is relabelled as simulated in the limitations, never presented as a new real measurement.
 */
import type { Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";
import type {
  AiLane,
  AuditBasis,
  AuditConfig,
  AuditCoverage,
  AuditDetail,
  AuditFinding,
  AuditRow,
  AuditStatus,
  AuditSummary,
  CrawledPage,
  LaneSummary,
  PageIssue,
  WebsiteCheck,
  WebsiteLane,
} from "@/types/audit";

import { CRITERIA_CATEGORIES } from "./labels";
import { buildAiLane, buildLimitations, buildUsage, checkRates } from "./lanes";
import { liveRow } from "./rows";
import { elapsedOf, isFailedJob, isNoAnswerJob, isTerminal, progressAt, QUEUE_MS, slotAt, VALIDATE_MS, type RunProgress } from "./simulation";

export type DerivedAudit = {
  row: AuditRow;
  detail: AuditDetail;
  progress: RunProgress;
  ai: AiLane | null;
  web: WebsiteLane | null;
  findings: AuditFinding[];
  summary: LaneSummary;
  /** Current request and page while the run is active. */
  current: { providerLabel: string; promptText: string; sample: number; url: string } | null;
};

const PAGE_TYPE_ALIAS: Record<string, string> = { Home: "home", Collections: "collection", Products: "product", Guides: "guide", Pages: "page", "Pages and policies": "page" };
const pageTypeIds = (config: AuditConfig): string[] => config.pageTypes.map((t) => PAGE_TYPE_ALIAS[t] ?? t);

function failedSample(src: ResponseSample | null, base: Omit<ResponseSample, "status" | "outcome" | "answerText" | "brandSpans" | "brandMentioned" | "recommendation" | "sentiment" | "confidence" | "evidenceQuote" | "position" | "competitors" | "citations" | "citationSupport" | "usage" | "completedAt" | "searchExecuted" | "failure">, reason: string): ResponseSample {
  return {
    ...base,
    searchExecuted: false,
    status: "failed",
    failure: { class: src ? "provider_error" : "refusal", message: reason, attempts: 3 },
    outcome: "failed",
    answerText: "",
    brandSpans: [],
    brandMentioned: "uncertain",
    recommendation: "none",
    sentiment: "unknown",
    confidence: 0,
    evidenceQuote: null,
    position: null,
    competitors: [],
    citations: [],
    citationSupport: "none_returned",
    usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
    completedAt: null,
  };
}

/** Responses of the requests sent so far, in slot order. Slots map onto the basis answers for the same prompt and provider. */
export function buildResponses(basis: AuditBasis, row: AuditRow, progress: RunProgress): ResponseSample[] {
  const { config, plan, run } = row;
  if (!config || !plan || !run) return [];
  const prompts = config.prompts ?? [];
  const channels = config.channelIds.map((id) => basis.channels.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const out: ResponseSample[] = [];
  for (let i = 0; i < progress.jobs.sent; i += 1) {
    const slot = slotAt(i, prompts.length, channels.length, config.samples);
    if (!slot) break;
    const prompt = prompts[slot.prompt];
    const channel = channels[slot.channel];
    const matches = basis.responses.filter((r) => r.promptId === prompt.id && r.channelId === channel.id && r.status === "succeeded");
    const src = matches.length > 0 ? matches[(slot.sample - 1) % matches.length] : null;
    const n = String(i + 1).padStart(2, "0");
    const at = run.startedAtMs + VALIDATE_MS + QUEUE_MS + i * 450;
    const common = {
      id: `resp-${row.id}-${n}`,
      storeId: row.storeId,
      runKind: "audit" as const,
      runId: row.id,
      promptId: prompt.id,
      promptVersion: prompt.version,
      promptText: prompt.text,
      channelId: channel.id,
      providerLabel: channel.providerLabel,
      model: channel.model,
      searchMode: (config.searchModes?.[channel.id] as ResponseSample["searchMode"] | undefined) ?? channel.searchMode,
      market: config.market,
      language: config.language,
      sample: slot.sample,
      providerRequestId: `req_${row.id.replace(/[^a-z0-9]/gi, "")}_${n}`,
      rawPayloadRef: `raw/${row.id}/${n}.json.enc`,
      requestedAt: new Date(at).toISOString(),
      analysisVersion: config.analysisVersion,
    };
    if (isNoAnswerJob(plan, i)) {
      out.push(failedSample(null, common, "Simulated: the demonstration data has no answer for this prompt and provider"));
    } else if (isFailedJob(plan, i)) {
      out.push(failedSample(src, common, "Simulated: the provider request failed after 3 attempts"));
    } else if (!src) {
      out.push(failedSample(null, common, "Simulated: the demonstration data has no answer for this prompt and provider"));
    } else {
      out.push({ ...src, ...common, searchExecuted: common.searchMode === "model_only" ? false : src.searchExecuted, completedAt: new Date(at + 380).toISOString() });
    }
  }
  return out;
}

const OUTSIDE = "The pages this check affects are outside this audit's crawl scope.";

/** Checks restricted to the chosen categories and integrations, with honest states for what was not evaluated. */
function scopedChecks(basis: AuditBasis, config: AuditConfig, inScopePaths: Set<string>, evaluated: number, evaluatingDone: boolean, endedEarly: boolean): WebsiteCheck[] {
  const categories = config.categories ?? CRITERIA_CATEGORIES.map((c) => c.id);
  const groups = new Set(CRITERIA_CATEGORIES.filter((c) => categories.includes(c.id)).flatMap((c) => c.groups));
  const noProducts = !pageTypeIds(config).includes("product");
  const picked = basis.checks.filter((c) => groups.has(c.group));
  const out: WebsiteCheck[] = [];
  picked.forEach((c, index) => {
    const base = { ...c, affectedPaths: c.affectedPaths.filter((p) => inScopePaths.has(p)) };
    let next: WebsiteCheck = base;
    if (/Search Console/i.test(c.name) && !config.integrations.searchConsole) {
      next = { ...base, status: "not_assessed", affected: null, findingId: null, evidence: { label: "Scope", snippet: "Search Console was off for this audit. Indexing coverage was not assessed." } };
    } else if (!config.integrations.pageSpeed && /Largest Contentful Paint|Field performance/i.test(c.name)) {
      next = { ...base, status: "not_assessed", affected: null, affectedPaths: [], findingId: null, evidence: { label: "Scope", snippet: "PageSpeed was off for this audit. Performance was not assessed." } };
    } else if (noProducts && /Product/.test(c.name) && c.status !== "not_applicable") {
      next = { ...base, status: "not_applicable", affected: null, affectedPaths: [], findingId: null, evidence: { label: "Scope", snippet: "No product or service pages are in scope, so this check does not apply." } };
    } else if ((c.status === "fail" || c.status === "warning") && c.affectedPaths.length > 0 && base.affectedPaths.length === 0) {
      next = { ...base, status: "not_assessed", affected: null, findingId: null, evidence: { label: "Scope", snippet: OUTSIDE } };
    } else if (base.affectedPaths.length !== c.affectedPaths.length && c.affected !== null) {
      next = { ...base, affected: base.affectedPaths.length };
    }
    if (evaluatingDone || index < evaluated) out.push(next);
    else if (!endedEarly) out.push({ ...next, status: "not_assessed", affected: null, affectedPaths: [], findingId: null, evidence: { label: "Pending", snippet: "Waiting for the evaluation stage." } });
  });
  return out;
}

function baseSummary(live: AuditRow): AuditSummary {
  return {
    id: live.id,
    storeId: live.storeId,
    title: live.title,
    type: live.type,
    lanes: live.lanes,
    status: live.status,
    startedAt: live.startedAt,
    completedAt: live.completedAt,
    durationSeconds: live.durationSeconds,
    snapshotId: live.snapshotId,
    createdBy: live.createdBy,
    plannedJobs: live.plannedJobs,
    succeededJobs: live.succeededJobs,
    failedJobs: live.failedJobs,
    findingsCreated: live.findingsCreated,
    mention: live.mention,
    recommendation: live.recommendation,
    pages: live.pages,
    provisional: live.provisional,
    reportId: null,
    reportStatus: live.reportStatus,
    reportVersion: live.reportVersion,
  };
}

const NO_RATE: Rate = { n: 0, d: 0 };

export function deriveAudit(basis: AuditBasis, row: AuditRow, nowMs: number): DerivedAudit | null {
  const { config, plan } = row;
  if (!config || !plan) return null;
  const live = liveRow(row, nowMs);
  const elapsed = row.run ? elapsedOf(row.run, nowMs) : 0;
  const progress = progressAt(plan, row.status === "draft" ? 0 : elapsed);
  const status: AuditStatus = live.status;
  const finished = isTerminal(status);
  const hasAi = live.lanes.includes("ai_visibility");
  const hasWeb = live.lanes.includes("website_readiness");

  // AI lane
  const responses = hasAi ? buildResponses(basis, row, progress) : [];
  const promptsMeta = [...basis.prompts, ...(config.prompts ?? []).filter((p) => !basis.prompts.some((b) => b.id === p.id)).map((p) => ({ ...p, groupId: null, status: "active" }))];
  const ai = hasAi
    ? buildAiLane({ responses, planned: plan.jobs, channels: basis.channels, prompts: promptsMeta, groups: basis.groups, brandName: basis.brandName, suggestedCompetitors: basis.suggestedCompetitors, baselineResponses: null })
    : null;

  // Website lane
  const types = new Set(pageTypeIds(config));
  const excluded = config.excludedPaths.map((p) => p.trim()).filter(Boolean);
  const eligible = basis.pages.filter((p) => types.has(p.type) && !excluded.some((x) => p.path === x || p.path.startsWith(x.endsWith("/") ? x : `${x}/`)));
  const inScope = eligible.slice(0, Math.max(0, Math.min(config.maxUrls || eligible.length, eligible.length)));
  const share = plan.pages > 0 ? Math.min(1, progress.pages.crawled / plan.pages) : 0;
  const crawledList = inScope.slice(0, Math.round(inScope.length * share));
  const startedMs = row.run?.startedAtMs ?? nowMs;
  const pages: CrawledPage[] = crawledList.map((p, i) => ({ ...p, crawledAt: new Date(startedMs + VALIDATE_MS + QUEUE_MS + (i + 1) * 220).toISOString() }));
  const evalStage = progress.stages.find((s) => s.id === "evaluation");
  const evaluated = evalStage?.done ?? 0;
  const evalDone = Boolean(evalStage && evalStage.done >= evalStage.total);
  let web: WebsiteLane | null = null;
  if (hasWeb) {
    const checks = scopedChecks(basis, config, new Set(inScope.map((p) => p.path)), evaluated, evalDone, status === "cancelled" || status === "failed" || status === "blocked");
    const rates = checkRates(checks);
    const pageIssues: Record<string, PageIssue[]> = {};
    for (const page of pages) {
      pageIssues[page.id] = checks
        .filter((c) => (c.status === "fail" || c.status === "warning") && c.affectedPaths.includes(page.path))
        .map((c) => ({ checkId: c.id, name: c.name, status: c.status, snippet: c.evidence.snippet, findingId: c.findingId }));
    }
    const planned = plan.pages;
    const unvisited = finished ? Math.max(0, planned - progress.pages.crawled) : 0;
    web = {
      provisional: !finished,
      coverage: { pages: { n: progress.pages.crawled, d: planned }, pagesDetail: { excluded: Math.max(0, basis.pages.length - eligible.length), blocked: 0, unvisited }, checks: rates.checkCoverage },
      pages,
      pagesTotalDetail: pages.length,
      pageIssues,
      checks,
      crawlers: (config.categories ?? ["crawler_access"]).includes("crawler_access") ? basis.crawlers : [],
      technical: rates.technical,
      content: rates.content,
      checkCoverage: rates.checkCoverage,
      notice: finished ? null : "Crawl in progress. Checks run after the crawl finishes.",
    };
  }

  // Findings appear after evaluation, never for a run that was cancelled, blocked or failed.
  const promptIds = new Set((config.prompts ?? []).map((p) => p.id));
  const paths = new Set(pages.map((p) => p.path));
  const findings: AuditFinding[] =
    status === "completed" || status === "completed_with_warnings" || status === "partially_completed"
      ? basis.findings
          .filter((f) => (f.lane === "ai_visibility" ? hasAi && (f.affectedPromptIds.length === 0 || f.affectedPromptIds.some((id) => promptIds.has(id))) : hasWeb && (f.affectedUrls.length === 0 || f.affectedUrls.some((u) => paths.has(u.replace(/^https?:\/\/[^/]+/, "") || "/")))))
          .map((f) => ({ ...f, isNew: false }))
      : [];

  const webCoverage = web ? { pages: web.coverage.pages, pagesDetail: web.coverage.pagesDetail } : { pages: NO_RATE, pagesDetail: { excluded: 0, blocked: 0, unvisited: 0 } };
  const coverage: AuditCoverage = {
    prompts: { n: new Set(responses.filter((r) => r.status === "succeeded").map((r) => r.promptId)).size, d: hasAi ? (config.prompts ?? []).length : 0 },
    providers: { n: new Set(responses.filter((r) => r.status === "succeeded").map((r) => r.channelId)).size, d: hasAi ? config.channelIds.length : 0 },
    responses: { n: progress.jobs.succeeded, d: plan.jobs },
    pages: webCoverage.pages,
    pagesDetail: webCoverage.pagesDetail,
    checks: web ? web.checkCoverage : NO_RATE,
  };

  const attempted = responses.length;
  const simNote: AuditDetail["limitations"] = [
    { id: "simulated", tone: "info", text: `Simulated audit. Answers and crawl facts are reused from ${basis.basisAudit.title} (demonstration data), limited to this audit's scope. Nothing was sent to a provider or crawled.` },
  ];
  if (hasAi && (config.market !== basis.market || config.language !== basis.language)) {
    simNote.push({ id: "market", tone: "warning", text: `Market or language differs from the demonstration basis (${basis.market} · ${basis.language.toUpperCase()}). Answers are relabelled and are not market-specific results.` });
  }
  const noAnswer = responses.filter((_, i) => isNoAnswerJob(plan, i)).length;
  if (noAnswer > 0) {
    simNote.push({ id: "no-answer", tone: "warning", text: `${noAnswer} ${noAnswer === 1 ? "request has" : "requests have"} no demonstration answer for the prompt and provider. They show as failed requests, not as the brand being absent.` });
  }
  for (const w of progress.warnings.filter((x) => !/failed after retries/.test(x))) simNote.push({ id: `w-${w.slice(0, 12)}`, tone: "warning", text: w });
  if (status === "blocked") simNote.push({ id: "blocked", tone: "warning", text: "Blocked during validation. No request was sent and no page was crawled." });
  if (status === "failed") simNote.push({ id: "failed-run", tone: "warning", text: "The run stopped because most provider requests failed. The responses that did return are kept; no snapshot was created." });
  const limitations = buildLimitations({
    status,
    type: live.type,
    failedJobs: progress.jobs.failed,
    plannedJobs: plan.jobs,
    attempted,
    hasWebsite: hasWeb,
    config,
    activePromptCount: basis.prompts.filter((p) => p.status === "active").length,
    responses,
    checks: web?.checks ?? [],
    web: webCoverage,
    baseline: null,
    extra: simNote,
  });

  const summary = baseSummary({ ...live, findingsCreated: findings.length, mention: ai && ai.mention.d > 0 && finished ? ai.mention : null, recommendation: ai && ai.recommendation.d > 0 && finished ? ai.recommendation : null });
  const detail: AuditDetail = {
    ...summary,
    config,
    coverage,
    usage: buildUsage(responses, progress.pages.crawled, config.limits.budgetUsd),
    limitations,
    progress: null,
    baseline: null,
  };
  const laneSummary: LaneSummary = {
    provisional: !finished,
    ai: ai ? { mention: ai.mention, recommendation: ai.recommendation, ownedCitation: ai.ownedCitation, responses: coverage.responses, prompts: coverage.prompts } : null,
    website: web ? { technical: web.technical, content: web.content, checks: web.checkCoverage, pages: web.coverage.pages, pagesDetail: web.coverage.pagesDetail } : null,
  };

  // What is being worked on right now.
  let current: DerivedAudit["current"] = null;
  if (progress.phase === "running") {
    const prompts = config.prompts ?? [];
    const channels = config.channelIds.map((id) => basis.channels.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c));
    const slot = hasAi && progress.jobs.running > 0 ? slotAt(progress.jobs.sent, prompts.length, channels.length, config.samples) : null;
    const url = hasWeb && progress.pages.crawled < plan.pages && inScope.length > 0 ? inScope[Math.min(inScope.length - 1, Math.round(inScope.length * share))]?.url : undefined;
    current = { providerLabel: slot ? channels[slot.channel].providerLabel : "", promptText: slot ? prompts[slot.prompt].text : "", sample: slot?.sample ?? 0, url: url ?? "" };
  }

  return { row: live, detail, progress, ai, web, findings, summary: laneSummary, current };
}
