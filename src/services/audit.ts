/**
 * Data access for the Audit module. Reads demonstration data today
 * (src/demo/audit.ts + the shared registry and response generator); later these
 * functions call the real audit services. Screens only import from here.
 *
 * AI visibility rates are always computed from the response samples (numerator and
 * denominator), never copied. Failures are excluded from rates and counted in coverage.
 */
import {
  APPROX_COST_PER_JOB_USD,
  APPROX_COST_PER_PAGE_USD,
  AUDIT_CONFIGS,
  AUD_004_CURRENT_URL,
  AUD_004_STAGES,
  AUD_004_WARNINGS,
  BASE_CHECKS,
  BASE_CRAWLERS,
  BASE_PAGES,
  WEBSITE_VARIANTS,
} from "@/demo/audit";
import type { RegistryAudit } from "@/demo/registry";
import { DEMO_NOW } from "@/lib/format";
import { INTENT_LABEL, SCOPE_LABEL, channelLabel } from "@/lib/labels";
import { STATUS } from "@/lib/status";
import { getStore, listPromptGroups, listPromptsBase, listStoreChannels } from "@/services/core";
import { listFindings, listRunResponses, registry } from "@/services/records";
import type { Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";
import type {
  AiLane,
  AuditConfig,
  AuditCoverage,
  AuditDetail,
  AuditFinding,
  AuditProgress,
  AuditSummary,
  AuditTaskLink,
  BreakdownRow,
  CheckStatus,
  CitationDomainRow,
  CompetitorRow,
  LaneSummary,
  MetricKey,
  PageIssue,
  WebsiteCheck,
  WebsiteLane,
  WizardData,
} from "@/types/audit";

/** Demo data exists for this store only; the others have no audits. */
const AUDIT_STORE = "runpro-pk";

/** Ids for generateStaticParams: every {storeId, auditId} pair. */
export function auditParams(): { storeId: string; auditId: string }[] {
  return registry.audits().map((audit) => ({ storeId: AUDIT_STORE, auditId: audit.id }));
}

const comparableType = (type: RegistryAudit["type"]) => type === "initial" || type === "full";

function toSummary(a: RegistryAudit): AuditSummary {
  const report = registry.reports().find((r) => r.type === "audit" && r.sourceId === a.id) ?? null;
  return {
    id: a.id,
    storeId: AUDIT_STORE,
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

function baselineOf(a: RegistryAudit): RegistryAudit | null {
  if (!comparableType(a.type)) return null;
  return (
    registry
      .audits()
      .filter((x) => comparableType(x.type) && x.status !== "in_progress" && Date.parse(x.startedAt) < Date.parse(a.startedAt))
      .sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt))[0] ?? null
  );
}

export async function listAudits(storeId: string): Promise<AuditSummary[]> {
  if (storeId !== AUDIT_STORE) return [];
  return [...registry.audits()].sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt)).map(toSummary);
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

const isDeterminate = (status: CheckStatus) => status === "pass" || status === "fail" || status === "warning";

function aiRates(responses: ResponseSample[]): Record<MetricKey, Rate> {
  const ok = responses.filter((r) => r.status === "succeeded");
  const capable = ok.filter((r) => r.citationSupport !== "not_supported");
  return {
    mention: { n: ok.filter((r) => r.brandMentioned === "yes").length, d: ok.length },
    recommendation: { n: ok.filter((r) => r.recommendation === "recommended").length, d: ok.length },
    citation: { n: capable.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: capable.length },
  };
}

function checkRates(checks: WebsiteCheck[]) {
  const applicable = checks.filter((c) => c.status !== "not_applicable");
  const technical = applicable.filter((c) => c.kind === "technical" && isDeterminate(c.status));
  const content = applicable.filter((c) => c.kind === "content" && isDeterminate(c.status));
  return {
    technical: { n: technical.filter((c) => c.status === "pass").length, d: technical.length },
    content: { n: content.filter((c) => c.status === "pass").length, d: content.length },
    checkCoverage: { n: applicable.filter((c) => isDeterminate(c.status)).length, d: applicable.length },
  };
}

// ---------------------------------------------------------------------------
// Website lane
// ---------------------------------------------------------------------------

function buildChecks(auditId: string): WebsiteCheck[] {
  const variant = WEBSITE_VARIANTS[auditId];
  if (!variant) return [];
  return BASE_CHECKS.filter((c) => variant.checkIds === "all" || variant.checkIds.includes(c.id)).map((c) => {
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

function websiteCoverage(auditId: string, checks: WebsiteCheck[]): Pick<AuditCoverage, "pages" | "pagesDetail" | "checks"> {
  const v = WEBSITE_VARIANTS[auditId];
  return {
    pages: { n: v.coverage.assessed, d: v.coverage.inScope },
    pagesDetail: { excluded: v.coverage.excluded, blocked: v.coverage.blocked, unvisited: v.coverage.unvisited },
    checks: checkRates(checks).checkCoverage,
  };
}

export async function getWebsiteLane(storeId: string, auditId: string): Promise<WebsiteLane | null> {
  const audit = registry.audits().find((a) => a.id === auditId);
  const variant = WEBSITE_VARIANTS[auditId];
  if (storeId !== AUDIT_STORE || !audit || !variant) return null;

  const checks = buildChecks(auditId);
  const rates = checkRates(checks);
  const started = Date.parse(audit.startedAt);

  const pages = BASE_PAGES.filter((p) => variant.pageIds === "all" || variant.pageIds.includes(p.id))
    .filter((p) => !p.publishedAt || Date.parse(p.publishedAt) <= started)
    .map((p, index) => ({ ...p, crawledAt: new Date(started + (index + 1) * 20_000).toISOString() }));

  const pageIssues: Record<string, PageIssue[]> = {};
  for (const page of pages) {
    const issues: PageIssue[] = [];
    for (const check of checks) {
      if ((check.status === "fail" || check.status === "warning") && check.affectedPaths.includes(page.path)) {
        issues.push({ checkId: check.id, name: check.name, status: check.status, snippet: check.evidence.snippet });
      }
    }
    pageIssues[page.id] = issues;
  }

  const crawlers = BASE_CRAWLERS.map((c) => ({ ...c, ...(variant.crawlerOverrides[c.id] ?? {}) }));

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
  const audit = registry.audits().find((a) => a.id === auditId);
  if (storeId !== AUDIT_STORE || !audit) return null;

  const [responses, channels, prompts, groups, store] = await Promise.all([
    listRunResponses(storeId, auditId),
    listStoreChannels(storeId),
    listPromptsBase(storeId),
    listPromptGroups(storeId),
    getStore(storeId),
  ]);
  const baselineAudit = baselineOf(audit);
  const baselineResponses = baselineAudit ? await listRunResponses(storeId, baselineAudit.id) : [];

  const succeeded = responses.filter((r) => r.status === "succeeded");
  const failed = responses.length - succeeded.length;
  const current = aiRates(responses);
  const previous = baselineAudit ? aiRates(baselineResponses) : null;

  const row = (id: string, label: string, sub: string, rs: ResponseSample[], baseline: ResponseSample[]): BreakdownRow => {
    const cur = aiRates(rs);
    const base = baselineAudit ? aiRates(baseline) : null;
    return {
      id,
      label,
      sub,
      current: cur,
      baseline: base ? base : { mention: null, recommendation: null, citation: null },
      failed: rs.filter((r) => r.status === "failed").length,
    };
  };

  const byProvider = channels.map((ch) =>
    row(ch.id, ch.providerLabel, channelLabel(ch), responses.filter((r) => r.channelId === ch.id), baselineResponses.filter((r) => r.channelId === ch.id)),
  );

  const groupOf = (promptId: string) => prompts.find((p) => p.id === promptId)?.groupId ?? null;
  const byGroup = [...groups, { id: "__none", storeId, name: "Ungrouped" }]
    .map((g) => {
      const inGroup = (r: ResponseSample) => (groupOf(r.promptId) ?? "__none") === g.id;
      const rs = responses.filter(inGroup);
      const promptCount = new Set(rs.map((r) => r.promptId)).size;
      return { g, rs, promptCount };
    })
    .filter((x) => x.rs.length > 0)
    .map(({ g, rs, promptCount }) =>
      row(g.id, g.name, `${promptCount} ${promptCount === 1 ? "prompt" : "prompts"}`, rs, baselineResponses.filter((r) => (groupOf(r.promptId) ?? "__none") === g.id)),
    );

  const competitorNames = new Map<string, string>();
  for (const r of succeeded) for (const c of r.competitors) competitorNames.set(c.id, c.name);
  const competitors: CompetitorRow[] = [
    { id: "brand", name: store?.brandName ?? "Brand", mentioned: current.mention, isBrand: true },
    ...[...competitorNames.entries()].map(([id, name]) => ({
      id,
      name,
      mentioned: { n: succeeded.filter((r) => r.competitors.some((c) => c.id === id && c.mentioned)).length, d: succeeded.length },
      isBrand: false,
    })),
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
    failed,
    planned: audit.plannedJobs,
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
    providers: channels.map((c) => ({ id: c.id, label: c.providerLabel })),
  };
}

// ---------------------------------------------------------------------------
// Audit detail
// ---------------------------------------------------------------------------

async function buildProgress(storeId: string, audit: RegistryAudit, responses: ResponseSample[]): Promise<AuditProgress> {
  const [prompts, channels] = await Promise.all([listPromptsBase(storeId), listStoreChannels(storeId)]);
  const active = prompts.filter((p) => p.status === "active");
  const samples = AUDIT_CONFIGS[audit.id].samples;
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
  const audit = registry.audits().find((a) => a.id === auditId);
  if (storeId !== AUDIT_STORE || !audit) return null;

  const [responses, prompts, channels] = await Promise.all([listRunResponses(storeId, auditId), listPromptsBase(storeId), listStoreChannels(storeId)]);
  const baselineAudit = baselineOf(audit);
  const baselineResponses = baselineAudit ? await listRunResponses(storeId, baselineAudit.id) : [];

  const config: AuditConfig = { ...AUDIT_CONFIGS[audit.id] };
  const activeIds = prompts.filter((p) => p.status === "active").map((p) => p.id);
  if (config.promptScope === "all_active") config.promptIds = activeIds;

  const ok = responses.filter((r) => r.status === "succeeded");
  const checks = buildChecks(audit.id);
  const web = websiteCoverage(audit.id, checks);
  const coverage: AuditCoverage = {
    prompts: { n: new Set(ok.map((r) => r.promptId)).size, d: config.promptIds.length },
    providers: { n: new Set(ok.map((r) => r.channelId)).size, d: config.channelIds.filter((id) => channels.some((c) => c.id === id)).length },
    responses: { n: audit.succeededJobs, d: audit.plannedJobs },
    ...web,
  };

  const limitations: AuditDetail["limitations"] = [];
  const running = audit.status === "in_progress";
  if (running) limitations.push({ id: "provisional", tone: "warning", text: "Results are provisional until the audit completes." });
  if (audit.failedJobs > 0) {
    limitations.push({
      id: "failed",
      tone: "warning",
      text: `${audit.failedJobs} of ${running ? responses.length : audit.plannedJobs} requests failed after retries. They are excluded from rates and counted in coverage, never as "not mentioned".`,
    });
  }
  if (!running && (web.pagesDetail.blocked > 0 || web.pagesDetail.unvisited > 0)) {
    limitations.push({
      id: "pages",
      tone: "warning",
      text: `${web.pages.d - web.pages.n} of ${web.pages.d} in-scope pages were not assessed (${web.pagesDetail.blocked} blocked, ${web.pagesDetail.unvisited} not visited).`,
    });
  }
  for (const c of checks.filter((x) => x.status === "blocked" || x.status === "error")) {
    limitations.push({ id: `chk-${c.id}`, tone: "warning", text: `${c.name}: ${STATUS.check[c.status as "blocked" | "error"].label.toLowerCase()}. ${c.evidence.snippet}` });
  }
  const open = checks.filter((c) => c.status === "inconclusive" || c.status === "not_assessed");
  if (!running && open.length > 0) {
    limitations.push({ id: "open", tone: "info", text: `${open.length} ${open.length === 1 ? "check was" : "checks were"} inconclusive or not assessed, so they count against check coverage.` });
  }
  const noCite = ok.filter((r) => r.citationSupport === "none_returned").length;
  if (noCite > 0) limitations.push({ id: "nocite", tone: "info", text: `${noCite} successful ${noCite === 1 ? "response" : "responses"} returned no citation. They stay in the owned-citation denominator.` });
  if (baselineAudit) {
    const versions = new Map(baselineResponses.map((r) => [r.promptId, r.promptVersion]));
    const changed = [...new Set(ok.filter((r) => versions.has(r.promptId) && versions.get(r.promptId) !== r.promptVersion).map((r) => r.promptId))];
    if (changed.length > 0) {
      limitations.push({ id: "versions", tone: "info", text: `Prompt version changed since ${baselineAudit.title} (${changed.join(", ")}). Treat the comparison as partial.` });
    }
  }
  if (audit.type === "verification") limitations.push({ id: "scope", tone: "info", text: "Verification scope: 2 prompts, 1 sample each. Rates are directional and not comparable with a full audit." });
  limitations.push({ id: "api", tone: "neutral", text: "AI results are API answer samples. They can differ from what a consumer app shows." });
  limitations.push({ id: "lab", tone: "neutral", text: "Performance numbers are lab measurements. Field data is available for one URL only." });

  return {
    ...toSummary(audit),
    config,
    coverage,
    limitations,
    progress: running ? await buildProgress(storeId, audit, responses) : null,
    baseline: baselineAudit ? { id: baselineAudit.id, title: baselineAudit.title } : null,
  };
}

/** Both lanes' headline numbers, computed separately. */
export async function getLaneSummary(storeId: string, auditId: string): Promise<LaneSummary | null> {
  const [audit, ai, web] = await Promise.all([getAudit(storeId, auditId), getAiLane(storeId, auditId), getWebsiteLane(storeId, auditId)]);
  if (!audit || !ai || !web) return null;
  return {
    provisional: audit.provisional,
    ai: audit.lanes.includes("ai_visibility")
      ? { mention: ai.mention, recommendation: ai.recommendation, ownedCitation: ai.ownedCitation, responses: audit.coverage.responses, prompts: audit.coverage.prompts }
      : null,
    website: audit.lanes.includes("website_readiness")
      ? { technical: web.technical, content: web.content, checks: web.checkCoverage, pages: web.coverage.pages, pagesDetail: web.coverage.pagesDetail }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/** Findings in the register at this audit's snapshot. Findings appear only after evaluation. */
export async function getAuditFindings(storeId: string, auditId: string): Promise<AuditFinding[]> {
  const audit = registry.audits().find((a) => a.id === auditId);
  if (storeId !== AUDIT_STORE || !audit || audit.status === "in_progress") return [];
  const cutoff = Date.parse(audit.completedAt ?? DEMO_NOW);
  const findings = await listFindings(storeId);
  return findings
    .filter((f) => Date.parse(f.firstDetectedAt) <= cutoff)
    .map((f) => ({ ...f, isNew: f.auditId === auditId }));
}

export async function listAuditTasks(storeId: string, auditId: string): Promise<AuditTaskLink[]> {
  const findings = await getAuditFindings(storeId, auditId);
  const ids = new Set(findings.map((f) => f.id));
  return registry
    .tasks()
    .filter((t) => ids.has(t.findingId))
    .map((t) => ({ id: t.id, title: t.title, findingId: t.findingId, status: t.status }));
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export async function getWizardData(storeId: string): Promise<WizardData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [prompts, groups, channels] = await Promise.all([listPromptsBase(storeId), listPromptGroups(storeId), listStoreChannels(storeId)]);
  const latestPages = storeId === AUDIT_STORE ? (registry.audits().find((a) => a.id === "aud-002")?.pages?.d ?? null) : null;
  return {
    store: { id: store.id, name: store.name, domain: store.domain, market: store.market, marketName: store.marketName, language: store.language },
    prompts: prompts
      .map((p) => ({
        id: p.id,
        text: p.text,
        version: p.version,
        status: p.status,
        groupId: p.groupId,
        groupName: groups.find((g) => g.id === p.groupId)?.name ?? "Ungrouped",
        intentLabel: INTENT_LABEL[p.intent],
        isCore: p.isCore,
        scopeLabel: SCOPE_LABEL[p.scope],
      })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    channels: channels.map((c) => ({ id: c.id, providerLabel: c.providerLabel, apiLabel: c.apiLabel, model: c.model, searchMode: c.searchMode, supportsCitations: c.supportsCitations })),
    integrations: { searchConsole: store.integrations.searchConsole === "connected", cms: store.integrations.commerce === "connected" },
    knownPages: latestPages,
    costPerJobUsd: APPROX_COST_PER_JOB_USD,
    costPerPageUsd: APPROX_COST_PER_PAGE_USD,
  };
}
