/**
 * Data access for the Audit module. Reads demonstration data today
 * (src/demo/audit.ts + the shared registry and response generator); later these
 * functions call the real audit services. Screens only import from here.
 *
 * AI visibility rates are always computed from the response samples (numerator and
 * denominator), never copied. Failures are excluded from rates and counted in coverage.
 */
import {
  ALL_AUDIT_CONFIGS,
  ALL_WEBSITE_VARIANTS,
  APPROX_COST_PER_JOB_USD,
  APPROX_COST_PER_PAGE_USD,
  AUD_004_CURRENT_URL,
  EXTRA_AUDIT_SPECS,
  type ExtraAuditSpec,
  AUD_004_STAGES,
  AUD_004_WARNINGS,
  WEBSITE_BASES,
} from "@/demo/audit";
import type { RegistryAudit } from "@/demo/registry";
import { DEMO_NOW } from "@/lib/format";
import { buildAiLane, buildLimitations, buildUsage, checkRates } from "@/features/audit/lanes";
import { buildAuditRow, liveRow, planFor } from "@/features/audit/rows";
import { hasSnapshot } from "@/features/audit/simulation";
import { getStore, listCompetitors, listPromptGroups, listPromptsBase, listStoreChannels, storeIds } from "@/services/core";
import { evidenceIdsForFinding, listFindings, listRunResponses, registry } from "@/services/records";
import type { ResponseSample } from "@/types/shared-records";
import type {
  AiLane,
  AuditBasis,
  AuditConfig,
  AuditCoverage,
  AuditDetail,
  AuditFinding,
  AuditProgress,
  AuditRow,
  AuditSummary,
  AuditTaskLink,
  LaneSummary,
  PageIssue,
  WebsiteCheck,
  WebsiteLane,
  WizardData,
} from "@/types/audit";

/** Ids for generateStaticParams: every {storeId, auditId} pair of every store that has audits. */
export function auditParams(): { storeId: string; auditId: string }[] {
  return storeIds().flatMap(({ storeId }) => [
    ...registry.audits(storeId).map((audit) => ({ storeId, auditId: audit.id })),
    ...(EXTRA_AUDIT_SPECS[storeId] ?? []).map((spec) => ({ storeId, auditId: spec.id })),
  ]);
}

const comparableType = (type: RegistryAudit["type"]) => type === "initial" || type === "full";

function toSummary(storeId: string, a: RegistryAudit): AuditSummary {
  const report = registry.reports(storeId).find((r) => r.type === "audit" && r.sourceId === a.id) ?? null;
  return {
    id: a.id,
    storeId,
    title: a.title,
    type: a.type,
    lanes: a.lanes,
    status: a.status,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    durationSeconds: Math.round((Date.parse(a.completedAt ?? DEMO_NOW) - Date.parse(a.startedAt)) / 1000),
    snapshotId: a.snapshotId,
    createdBy: a.createdBy,
    plannedJobs: a.plannedJobs,
    succeededJobs: a.succeededJobs,
    failedJobs: a.failedJobs,
    findingsCreated: a.findingsCreated,
    mention: a.mention,
    recommendation: a.recommendation,
    pages: a.pages,
    provisional: a.status === "in_progress",
    reportId: report?.id ?? null,
    reportStatus: report?.status ?? null,
    reportVersion: report?.version ?? null,
  };
}

function baselineOf(storeId: string, a: RegistryAudit): RegistryAudit | null {
  if (!comparableType(a.type)) return null;
  return (
    registry
      .audits(storeId)
      .filter((x) => comparableType(x.type) && x.status !== "in_progress" && Date.parse(x.startedAt) < Date.parse(a.startedAt))
      .sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt))[0] ?? null
  );
}

/** Registry audits plus the extra demonstration audits, newest first. Rows of extra audits carry their frozen run. */
export async function listAuditRows(storeId: string): Promise<AuditRow[]> {
  const extras = await Promise.all((EXTRA_AUDIT_SPECS[storeId] ?? []).map((spec) => buildExtraRow(storeId, spec)));
  const rows: AuditRow[] = [...registry.audits(storeId).map((a) => toSummary(storeId, a)), ...extras];
  return rows.sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt));
}

export async function listAudits(storeId: string): Promise<AuditSummary[]> {
  return listAuditRows(storeId);
}

export async function getExtraAuditRow(storeId: string, auditId: string): Promise<AuditRow | null> {
  const spec = (EXTRA_AUDIT_SPECS[storeId] ?? []).find((s) => s.id === auditId);
  return spec ? buildExtraRow(storeId, spec) : null;
}

async function buildExtraRow(storeId: string, spec: ExtraAuditSpec): Promise<AuditRow> {
  const [prompts, channels] = await Promise.all([listPromptsBase(storeId), listStoreChannels(storeId)]);
  const basis = pickBasisAudit(storeId);
  const baseConfig = (basis && ALL_AUDIT_CONFIGS[basis.id]) || Object.values(ALL_AUDIT_CONFIGS)[0];
  const active = prompts.filter((p) => p.status === "active");
  const picked = spec.promptIds ? active.filter((p) => spec.promptIds?.includes(p.id)) : active;
  const channelIds = baseConfig.channelIds.filter((id) => channels.some((c) => c.id === id));
  const config: AuditConfig = {
    ...baseConfig,
    promptScope: spec.promptIds ? "ids" : "all_active",
    promptIds: picked.map((p) => p.id),
    prompts: picked.map((p) => ({ id: p.id, text: p.text, version: p.version })),
    channelIds,
    samples: spec.samples,
    pageTypes: ["home", "collection", "product", "guide", "page", "policy"],
    categories: ["technical", "content", "structured_data", "crawler_access", "performance"],
    trigger: spec.trigger,
    verifies: spec.verifies,
    scenario: spec.scenario,
  };
  const knownPages = registry.audits(storeId).find((a) => a.pages)?.pages?.d ?? config.maxUrls;
  const counts = {
    jobs: picked.length * channelIds.length * spec.samples,
    pages: spec.lanes.includes("website_readiness") ? Math.min(config.maxUrls, knownPages) : 0,
    checks: WEBSITE_BASES[storeId]?.checks.length ?? 0,
  };
  const startedMs = Date.parse(spec.startedAt);
  const draft = buildAuditRow({ storeId, type: spec.type, lanes: spec.lanes, config, counts, createdBy: spec.createdBy, basisAuditId: basis?.id ?? "", nowMs: startedMs, stamp: "" });
  const plan = planFor({ lanes: spec.lanes, config, counts }, `${storeId}|${spec.id}`);
  const cancelled = spec.cancelAt !== undefined;
  const status = cancelled ? "cancelled" : plan.outcome;
  const ended = cancelled ? Math.round(plan.endAtMs * (spec.cancelAt ?? 1)) : plan.endAtMs;
  const endedAt = new Date(startedMs + ended).toISOString();
  const row: AuditRow = {
    ...draft,
    id: spec.id,
    title: spec.title,
    status,
    plan,
    run: { startedAtMs: startedMs, pausedAtMs: null, pausedMs: 0, endedElapsedMs: ended },
    endedAt,
    completedAt: status === "cancelled" || status === "failed" || status === "blocked" ? null : endedAt,
    snapshotId: hasSnapshot(status) ? `snap-${spec.id}` : null,
    simulated: false,
    provisional: false,
  };
  return liveRow(row, startedMs + ended);
}

const isCompletedComparable = (a: RegistryAudit) => comparableType(a.type) && a.status !== "in_progress";

/** The completed full or initial audit that simulated audits take their answers and crawl facts from. */
function pickBasisAudit(storeId: string): RegistryAudit | null {
  const done = registry.audits(storeId).filter(isCompletedComparable).sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt));
  return done.find((a) => a.lanes.length === 2) ?? done[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Website lane
// ---------------------------------------------------------------------------

function buildChecks(storeId: string, auditId: string): WebsiteCheck[] {
  const variant = ALL_WEBSITE_VARIANTS[auditId];
  const base = WEBSITE_BASES[storeId];
  if (!variant || !base) return [];
  return base.checks.filter((c) => variant.checkIds === "all" || variant.checkIds.includes(c.id)).map((c) => {
    const o = variant.overrides[c.id];
    let next: WebsiteCheck = o
      ? {
          ...c,
          status: o.status ?? c.status,
          affected: o.affected !== undefined ? o.affected : c.affected,
          affectedPaths: o.affectedPaths ?? c.affectedPaths,
          findingId: o.findingId !== undefined ? o.findingId : c.findingId,
          evidence: { label: o.label ?? c.evidence.label, snippet: o.snippet ?? c.evidence.snippet },
        }
      : c;
    if (variant.evaluatedGroups && !variant.evaluatedGroups.includes(next.group) && next.status !== "not_applicable") {
      next = { ...next, status: "not_assessed", affected: null, affectedPaths: [], findingId: null, evidence: { label: "Pending", snippet: "Waiting for the evaluation stage." } };
    }
    return next;
  });
}

const NO_WEBSITE_COVERAGE: Pick<AuditCoverage, "pages" | "pagesDetail" | "checks"> = {
  pages: { n: 0, d: 0 },
  pagesDetail: { excluded: 0, blocked: 0, unvisited: 0 },
  checks: { n: 0, d: 0 },
};

function websiteCoverage(auditId: string, checks: WebsiteCheck[]): Pick<AuditCoverage, "pages" | "pagesDetail" | "checks"> {
  const v = ALL_WEBSITE_VARIANTS[auditId];
  if (!v) return NO_WEBSITE_COVERAGE;
  return {
    pages: { n: v.coverage.assessed, d: v.coverage.inScope },
    pagesDetail: { excluded: v.coverage.excluded, blocked: v.coverage.blocked, unvisited: v.coverage.unvisited },
    checks: checkRates(checks).checkCoverage,
  };
}

export async function getWebsiteLane(storeId: string, auditId: string): Promise<WebsiteLane | null> {
  const audit = registry.audits(storeId).find((a) => a.id === auditId);
  const variant = ALL_WEBSITE_VARIANTS[auditId];
  const base = WEBSITE_BASES[storeId];
  if (!audit || !variant || !base) return null;

  const checks = buildChecks(storeId, auditId);
  const rates = checkRates(checks);
  const started = Date.parse(audit.startedAt);

  const pages = base.pages.filter((p) => variant.pageIds === "all" || variant.pageIds.includes(p.id))
    .filter((p) => !p.publishedAt || Date.parse(p.publishedAt) <= started)
    .map((p, index) => ({ ...p, ...(variant.pageOverrides?.[p.id] ?? {}), crawledAt: new Date(started + (index + 1) * 20_000).toISOString() }));

  const pageIssues: Record<string, PageIssue[]> = {};
  for (const page of pages) {
    const issues: PageIssue[] = [];
    for (const check of checks) {
      if ((check.status === "fail" || check.status === "warning") && check.affectedPaths.includes(page.path)) {
        issues.push({ checkId: check.id, name: check.name, status: check.status, snippet: check.evidence.snippet, findingId: check.findingId });
      }
    }
    pageIssues[page.id] = issues;
  }

  const crawlers = base.crawlers.map((c) => ({ ...c, ...(variant.crawlerOverrides[c.id] ?? {}) }));

  return {
    provisional: audit.status === "in_progress",
    coverage: websiteCoverage(auditId, checks),
    pages,
    pagesTotalDetail: pages.length,
    pageIssues,
    checks,
    crawlers,
    technical: rates.technical,
    content: rates.content,
    checkCoverage: rates.checkCoverage,
    notice: variant.notice,
  };
}

// ---------------------------------------------------------------------------
// AI visibility lane
// ---------------------------------------------------------------------------

export async function getAiLane(storeId: string, auditId: string): Promise<AiLane | null> {
  const audit = registry.audits(storeId).find((a) => a.id === auditId);
  if (!audit) return null;

  const [responses, channels, prompts, groups, store, storeCompetitors] = await Promise.all([
    listRunResponses(storeId, auditId),
    listStoreChannels(storeId),
    listPromptsBase(storeId),
    listPromptGroups(storeId),
    getStore(storeId),
    listCompetitors(storeId),
  ]);
  const baselineAudit = baselineOf(storeId, audit);
  const baselineResponses = baselineAudit ? await listRunResponses(storeId, baselineAudit.id) : null;
  return buildAiLane({
    responses,
    planned: audit.plannedJobs,
    channels,
    prompts,
    groups,
    brandName: store?.brandName ?? "Brand",
    suggestedCompetitors: storeCompetitors.filter((c) => c.status === "suggested").map((c) => ({ id: c.id, name: c.name })),
    baselineResponses,
  });
}

// ---------------------------------------------------------------------------
// Audit detail
// ---------------------------------------------------------------------------

async function buildProgress(storeId: string, audit: RegistryAudit, responses: ResponseSample[]): Promise<AuditProgress> {
  const [prompts, channels] = await Promise.all([listPromptsBase(storeId), listStoreChannels(storeId)]);
  const active = prompts.filter((p) => p.status === "active");
  const samples = ALL_AUDIT_CONFIGS[audit.id]?.samples ?? 1;
  const completed = responses.length;
  // Slots are ordered prompt × channel × sample; the next slot is the one running now.
  const perPrompt = channels.length * samples;
  const promptIndex = Math.min(Math.floor(completed / perPrompt), active.length - 1);
  const rem = completed % perPrompt;
  const channel = channels[Math.min(Math.floor(rem / samples), channels.length - 1)];
  const failedResponses = responses.filter((r) => r.status === "failed");
  const succeeded = responses.length - failedResponses.length;
  return {
    stages: AUD_004_STAGES,
    overall: { n: completed + (audit.pages?.n ?? 0), d: audit.plannedJobs + (audit.pages?.d ?? 0) },
    elapsedSeconds: Math.round((Date.parse(DEMO_NOW) - Date.parse(audit.startedAt)) / 1000),
    jobs: { succeeded, failed: failedResponses.length, running: 1, queued: Math.max(0, audit.plannedJobs - completed - 1) },
    current: {
      provider: channel ? `${channel.providerLabel} · ${channel.model}` : "—",
      promptText: active[promptIndex]?.text ?? "",
      sample: (rem % samples) + 1,
      url: AUD_004_CURRENT_URL,
    },
    warnings: AUD_004_WARNINGS,
    failedResponses,
  };
}

export async function getAudit(storeId: string, auditId: string): Promise<AuditDetail | null> {
  const audit = registry.audits(storeId).find((a) => a.id === auditId);
  if (!audit) return null;

  const [responses, prompts, channels] = await Promise.all([listRunResponses(storeId, auditId), listPromptsBase(storeId), listStoreChannels(storeId)]);
  const baselineAudit = baselineOf(storeId, audit);
  const baselineResponses = baselineAudit ? await listRunResponses(storeId, baselineAudit.id) : [];

  const config: AuditConfig = { ...ALL_AUDIT_CONFIGS[audit.id] };
  const activeIds = prompts.filter((p) => p.status === "active").map((p) => p.id);
  if (config.promptScope === "all_active") config.promptIds = activeIds;

  const hasWebsite = audit.lanes.includes("website_readiness");
  const ok = responses.filter((r) => r.status === "succeeded");
  const checks = hasWebsite ? buildChecks(storeId, audit.id) : [];
  const web = hasWebsite ? websiteCoverage(audit.id, checks) : NO_WEBSITE_COVERAGE;
  const coverage: AuditCoverage = {
    prompts: { n: new Set(ok.map((r) => r.promptId)).size, d: config.promptIds.length },
    providers: { n: new Set(ok.map((r) => r.channelId)).size, d: config.channelIds.filter((id) => channels.some((c) => c.id === id)).length },
    responses: { n: audit.succeededJobs, d: audit.plannedJobs },
    ...web,
  };

  const running = audit.status === "in_progress";
  const limitations = buildLimitations({
    status: audit.status,
    type: audit.type,
    failedJobs: audit.failedJobs,
    plannedJobs: audit.plannedJobs,
    attempted: responses.length,
    hasWebsite,
    config,
    activePromptCount: activeIds.length,
    responses,
    checks,
    web,
    baseline: baselineAudit ? { title: baselineAudit.title, responses: baselineResponses } : null,
  });
  const usage = buildUsage(responses, hasWebsite ? (audit.pages?.n ?? 0) : 0, config.limits.budgetUsd);

  return {
    ...toSummary(storeId, audit),
    config,
    coverage,
    usage,
    limitations,
    progress: running ? await buildProgress(storeId, audit, responses) : null,
    baseline: baselineAudit ? { id: baselineAudit.id, title: baselineAudit.title } : null,
  };
}

/** Both lanes' headline numbers, computed separately. A lane the audit did not include is null. */
export async function getLaneSummary(storeId: string, auditId: string): Promise<LaneSummary | null> {
  const [audit, ai, web] = await Promise.all([getAudit(storeId, auditId), getAiLane(storeId, auditId), getWebsiteLane(storeId, auditId)]);
  if (!audit) return null;
  return {
    provisional: audit.provisional,
    ai:
      audit.lanes.includes("ai_visibility") && ai
        ? { mention: ai.mention, recommendation: ai.recommendation, ownedCitation: ai.ownedCitation, responses: audit.coverage.responses, prompts: audit.coverage.prompts }
        : null,
    website:
      audit.lanes.includes("website_readiness") && web
        ? { technical: web.technical, content: web.content, checks: web.checkCoverage, pages: web.coverage.pages, pagesDetail: web.coverage.pagesDetail }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/** Findings in the register at this audit's snapshot. Findings appear only after evaluation. */
export async function getAuditFindings(storeId: string, auditId: string): Promise<AuditFinding[]> {
  const audit = registry.audits(storeId).find((a) => a.id === auditId);
  if (!audit || audit.status === "in_progress") return [];
  const cutoff = Date.parse(audit.completedAt ?? DEMO_NOW);
  const findings = await listFindings(storeId);
  return findings
    .filter((f) => Date.parse(f.firstDetectedAt) <= cutoff)
    .map((f) => ({ ...f, isNew: f.auditId === auditId, evidenceIds: evidenceIdsForFinding(f) }));
}

export async function listAuditTasks(storeId: string, auditId: string): Promise<AuditTaskLink[]> {
  const findings = await getAuditFindings(storeId, auditId);
  const ids = new Set(findings.map((f) => f.id));
  return registry
    .tasks(storeId)
    .filter((t) => ids.has(t.findingId))
    .map((t) => ({ id: t.id, title: t.title, findingId: t.findingId, status: t.status }));
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

/** Used when a website has no earlier full audit to take defaults from. */
const FALLBACK_DEFAULTS: WizardData["defaults"] = { samples: 2, maxUrls: 150, maxDepth: 4, maxRequests: 200, concurrency: 4, budgetUsd: 8, excludedPaths: ["/cart", "/checkout", "/account"] };

export async function getWizardData(storeId: string): Promise<WizardData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [prompts, groups, channels, findings] = await Promise.all([listPromptsBase(storeId), listPromptGroups(storeId), listStoreChannels(storeId), listFindings(storeId)]);

  const audits = [...registry.audits(storeId)].sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt));
  const knownPages = audits.find((a) => a.pages)?.pages?.d ?? null;
  const latestFull = audits.find((a) => comparableType(a.type));
  const base = latestFull ? ALL_AUDIT_CONFIGS[latestFull.id] : undefined;
  const basis = pickBasisAudit(storeId);
  const answered = basis ? [...new Set((await listRunResponses(storeId, basis.id)).filter((r) => r.status === "succeeded").map((r) => r.promptId))] : [];
  const activeIds = prompts.filter((p) => p.status === "active").map((p) => p.id);

  return {
    store: { id: store.id, name: store.name, domain: store.domain, market: store.market, marketName: store.marketName, language: store.language },
    promptsBase: prompts,
    groups,
    answeredPromptIds: answered,
    channels: channels.map((c) => ({ id: c.id, providerLabel: c.providerLabel, apiLabel: c.apiLabel, model: c.model, searchMode: c.searchMode, supportsCitations: c.supportsCitations })),
    integrations: {
      searchConsole: store.integrations.searchConsole === "connected",
      cms: store.integrations.commerce === "connected",
      cmsNeedsAttention: store.integrations.commerce === "needs_attention",
    },
    knownPages,
    costPerJobUsd: APPROX_COST_PER_JOB_USD,
    costPerPageUsd: APPROX_COST_PER_PAGE_USD,
    defaults: base
      ? {
          samples: base.samples,
          maxUrls: base.maxUrls,
          maxDepth: base.maxDepth,
          maxRequests: base.limits.maxRequests,
          concurrency: base.limits.concurrency,
          budgetUsd: base.limits.budgetUsd,
          excludedPaths: base.excludedPaths,
        }
      : FALLBACK_DEFAULTS,
    findings: findings.map((f) => ({ id: f.id, title: f.title, lane: f.lane, affectedPromptIds: f.affectedPromptIds })),
    reruns: audits
      .filter((a) => ALL_AUDIT_CONFIGS[a.id])
      .map((a) => {
        const config = { ...ALL_AUDIT_CONFIGS[a.id] };
        if (config.promptScope === "all_active") config.promptIds = activeIds;
        return { id: a.id, title: a.title, type: a.type, lanes: a.lanes, config };
      }),
    pageTypes: [...new Set((WEBSITE_BASES[storeId]?.pages ?? []).map((p) => p.type))],
    checkCount: WEBSITE_BASES[storeId]?.checks.length ?? 0,
    basisAuditId: basis?.id ?? null,
  };
}

/**
 * What the browser needs to build a simulated audit from an existing one: the answers, crawled pages, checks
 * and findings of the basis audit (the latest completed full audit). Null when the website has no such audit.
 */
export async function getAuditBasis(storeId: string): Promise<AuditBasis | null> {
  const audit = pickBasisAudit(storeId);
  const store = await getStore(storeId);
  if (!audit || !store) return null;
  const [responses, prompts, groups, channels, competitors, findings, web] = await Promise.all([
    listRunResponses(storeId, audit.id),
    listPromptsBase(storeId),
    listPromptGroups(storeId),
    listStoreChannels(storeId),
    listCompetitors(storeId),
    listFindings(storeId),
    getWebsiteLane(storeId, audit.id),
  ]);
  const base = ALL_AUDIT_CONFIGS[audit.id];
  return {
    storeId,
    brandName: store.brandName,
    domain: store.domain,
    market: store.market,
    language: store.language,
    basisAudit: { id: audit.id, title: audit.title },
    basisConfig: base,
    responses,
    channels: channels.map((c) => ({ id: c.id, providerLabel: c.providerLabel, apiLabel: c.apiLabel, model: c.model, searchMode: c.searchMode, supportsCitations: c.supportsCitations })),
    prompts: prompts.map((p) => ({ id: p.id, text: p.text, version: p.version, groupId: p.groupId, status: p.status })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    suggestedCompetitors: competitors.filter((c) => c.status === "suggested").map((c) => ({ id: c.id, name: c.name })),
    pages: web?.pages ?? [],
    checks: web?.checks ?? [],
    crawlers: web?.crawlers ?? [],
    findings: findings.map((f) => ({ ...f, evidenceIds: evidenceIdsForFinding(f) })),
    tasks: registry.tasks(storeId).map((t) => ({ id: t.id, title: t.title, findingId: t.findingId, status: t.status })),
  };
}
