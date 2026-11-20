import { INTENT_LABEL, SCOPE_LABEL, SEARCH_MODE_LABEL } from "@/lib/labels";
import type { PromptBase, PromptGroup, SearchMode } from "@/types/core";
import type { AuditConfig, AuditLane, AuditTrigger, AuditType, PageType, SimScenario, WizardData, WizardPrompt } from "@/types/audit";

import { AUDIT_TYPE_HINT, AUDIT_TYPE_LABEL, CRITERIA_CATEGORIES } from "./labels";
import { planFor } from "./rows";

export type WizardKind = AuditType;
export type PromptMode = "all" | "groups" | "ids";

export type WizardState = {
  kind: WizardKind;
  ai: boolean;
  web: boolean;
  promptMode: PromptMode;
  groupIds: string[];
  promptIds: string[];
  channelIds: string[];
  searchModes: Record<string, SearchMode>;
  market: string;
  language: string;
  samples: number;
  startHomepage: boolean;
  startSitemap: boolean;
  startUrlList: boolean;
  startCms: boolean;
  urlList: string;
  maxDepth: number;
  pageTypes: string[];
  excludedPaths: string;
  categories: string[];
  criteria: string;
  searchConsole: boolean;
  pageSpeed: boolean;
  cms: boolean;
  maxUrls: number;
  maxRequests: number;
  concurrency: number;
  budgetUsd: number;
  retries: number;
  timeoutSeconds: number;
  scenario: SimScenario;
  findingId: string;
  taskId: string;
  triggerSource: AuditTrigger["source"];
  triggerReason: string;
  cadence: "weekly" | "monthly";
};

/** Page types are generic: a website does not have to sell products. Values are the ids used by the crawl data. */
export const PAGE_TYPE_OPTIONS: { value: PageType; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "collection", label: "Categories and listings" },
  { value: "product", label: "Products and services" },
  { value: "guide", label: "Guides and articles" },
  { value: "page", label: "Other pages" },
  { value: "policy", label: "Policies" },
];

export const KIND_OPTIONS: { value: WizardKind; label: string; description: string }[] = (["initial", "full", "focused", "verification", "triggered", "scheduled"] as const).map((value) => ({
  value,
  label: AUDIT_TYPE_LABEL[value],
  description: AUDIT_TYPE_HINT[value],
}));

const MARKET_LIST = [
  { value: "PK", label: "PK · Pakistan" },
  { value: "AE", label: "AE · United Arab Emirates" },
  { value: "GB", label: "GB · United Kingdom" },
  { value: "US", label: "US · United States" },
];
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
];

/** The website's own market first, then the others. */
export function marketOptions(data: WizardData) {
  const own = { value: data.store.market, label: `${data.store.market} · ${data.store.marketName}` };
  return [own, ...MARKET_LIST.filter((m) => m.value !== own.value)];
}

export const TRIGGER_SOURCES: { value: AuditTrigger["source"]; label: string }[] = [
  { value: "fix_applied", label: "A fix was applied" },
  { value: "brand_fact", label: "A brand fact changed" },
  { value: "alert", label: "A monitoring alert" },
  { value: "competitor_suggested", label: "A competitor was suggested" },
];

export function toWizardPrompts(prompts: readonly PromptBase[], groups: readonly PromptGroup[]): WizardPrompt[] {
  return prompts.map((p) => ({
    id: p.id,
    text: p.text,
    version: p.version,
    status: p.status,
    groupId: p.groupId,
    groupName: groups.find((g) => g.id === p.groupId)?.name ?? "Ungrouped",
    intentLabel: INTENT_LABEL[p.intent],
    isCore: p.isCore,
    scopeLabel: SCOPE_LABEL[p.scope],
  }));
}

export function initialState(data: WizardData): WizardState {
  return {
    kind: "full",
    ai: true,
    web: true,
    promptMode: "all",
    groupIds: [],
    promptIds: [],
    channelIds: data.channels.map((c) => c.id),
    searchModes: Object.fromEntries(data.channels.map((c) => [c.id, c.searchMode])),
    market: data.store.market,
    language: data.store.language,
    samples: data.defaults.samples,
    startHomepage: true,
    startSitemap: true,
    startUrlList: false,
    startCms: false,
    urlList: "",
    maxDepth: data.defaults.maxDepth,
    pageTypes: PAGE_TYPE_OPTIONS.map((p) => p.value),
    excludedPaths: data.defaults.excludedPaths.join("\n"),
    categories: CRITERIA_CATEGORIES.map((c) => c.id),
    criteria: "2.1",
    searchConsole: data.integrations.searchConsole,
    pageSpeed: true,
    cms: data.integrations.cms,
    maxUrls: data.defaults.maxUrls,
    maxRequests: data.defaults.maxRequests,
    concurrency: data.defaults.concurrency,
    budgetUsd: data.defaults.budgetUsd,
    retries: 3,
    timeoutSeconds: 60,
    scenario: "normal",
    findingId: "",
    taskId: "",
    triggerSource: "fix_applied",
    triggerReason: "",
    cadence: "weekly",
  };
}

const PAGE_TYPE_ALIAS: Record<string, string> = { Home: "home", Collections: "collection", Products: "product", Guides: "guide", Pages: "page", "Pages and policies": "page" };

/** Starting state from an earlier audit's frozen configuration ("Run again"). */
export function stateFromConfig(data: WizardData, config: AuditConfig, kind: AuditType, lanes: AuditLane[]): WizardState {
  const base = initialState(data);
  const promptMode: PromptMode = config.promptScope === "all_active" ? "all" : config.promptScope === "groups" ? "groups" : "ids";
  const urlLines = config.startPoints.filter((p) => p.startsWith("URL list"));
  return {
    ...base,
    kind: kind === "triggered" || kind === "scheduled" ? "full" : kind,
    ai: lanes.includes("ai_visibility"),
    web: lanes.includes("website_readiness"),
    promptMode,
    promptIds: config.promptIds,
    channelIds: config.channelIds.length > 0 ? config.channelIds : base.channelIds,
    searchModes: { ...base.searchModes, ...(config.searchModes as Record<string, SearchMode> | undefined) },
    market: config.market || base.market,
    language: config.language || base.language,
    samples: config.samples || base.samples,
    startHomepage: config.startPoints.length === 0 ? base.startHomepage : config.startPoints.includes("Homepage"),
    startSitemap: config.startPoints.length === 0 ? base.startSitemap : config.startPoints.includes("Sitemap"),
    startUrlList: urlLines.length > 0,
    maxDepth: config.maxDepth || base.maxDepth,
    pageTypes: config.pageTypes.length > 0 ? config.pageTypes.map((t) => PAGE_TYPE_ALIAS[t] ?? t) : base.pageTypes,
    excludedPaths: config.excludedPaths.join("\n"),
    categories: config.categories ?? base.categories,
    criteria: config.criteriaVersion,
    searchConsole: config.integrations.searchConsole && data.integrations.searchConsole,
    pageSpeed: config.integrations.pageSpeed,
    cms: config.integrations.cms && data.integrations.cms,
    maxUrls: config.maxUrls || base.maxUrls,
    maxRequests: config.limits.maxRequests,
    concurrency: config.limits.concurrency,
    budgetUsd: config.limits.budgetUsd,
    retries: config.retries ?? 3,
    timeoutSeconds: config.timeoutSeconds ?? 60,
  };
}

export const urlLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Active prompts that this configuration includes. */
export function includedPrompts(prompts: WizardPrompt[], state: WizardState) {
  const active = prompts.filter((p) => p.status === "active");
  if (state.promptMode === "all") return active;
  if (state.promptMode === "groups") return active.filter((p) => p.groupId && state.groupIds.includes(p.groupId));
  return active.filter((p) => state.promptIds.includes(p.id));
}

/** Verification re-checks the prompts a finding affected, with one sample each. */
export function applyFinding(state: WizardState, data: WizardData, prompts: WizardPrompt[], findingId: string): WizardState {
  const finding = data.findings.find((f) => f.id === findingId);
  if (!finding) return { ...state, findingId };
  const active = new Set(prompts.filter((p) => p.status === "active").map((p) => p.id));
  const ids = finding.affectedPromptIds.filter((id) => active.has(id));
  const ai = finding.lane === "ai_visibility";
  return { ...state, findingId, ai: ai || state.ai, web: !ai || state.web, promptMode: "ids", promptIds: ids, samples: 1 };
}

export type Usage = {
  prompts: number;
  channels: number;
  samples: number;
  jobs: number;
  pages: number;
  checks: number;
  costUsd: number;
  durationSeconds: number;
  overBudget: boolean;
  overRequests: boolean;
};

/** Live predicted workload: jobs = prompts × providers × samples. Pages, cost and duration are illustrative. */
export function predictUsage(data: WizardData, state: WizardState, prompts: WizardPrompt[]): Usage {
  const promptCount = state.ai ? includedPrompts(prompts, state).length : 0;
  const channels = state.ai ? state.channelIds.length : 0;
  const jobs = promptCount * channels * state.samples;
  const listed = state.startUrlList ? urlLines(state.urlList).length : 0;
  const crawlStarts = state.startHomepage || state.startSitemap || state.startCms;
  const discovered = crawlStarts ? (data.knownPages ?? state.maxUrls) : 0;
  const pages = state.web ? Math.min(state.maxUrls, discovered + listed) : 0;
  const checks = state.web ? data.checkCount : 0;
  const costUsd = jobs * data.costPerJobUsd + pages * data.costPerPageUsd;
  const plan = planFor(
    {
      lanes: [...(state.ai ? (["ai_visibility"] as const) : []), ...(state.web ? (["website_readiness"] as const) : [])],
      config: { limits: { maxRequests: state.maxRequests, concurrency: state.concurrency, budgetUsd: state.budgetUsd } } as AuditConfig,
      counts: { jobs, pages, checks },
    },
    "estimate",
    "normal",
  );
  return { prompts: promptCount, channels, samples: state.samples, jobs, pages, checks, costUsd, durationSeconds: Math.round(plan.endAtMs / 1000), overBudget: costUsd > state.budgetUsd, overRequests: jobs > state.maxRequests };
}

export type Limitation = { id: string; tone: "warning" | "info"; text: string };

export function limitations(data: WizardData, state: WizardState, usage: Usage, prompts: WizardPrompt[]): Limitation[] {
  const out: Limitation[] = [];
  const channels = data.channels.filter((c) => state.channelIds.includes(c.id));
  if (state.ai) {
    for (const c of channels.filter((x) => !x.supportsCitations)) {
      out.push({ id: `nocite-${c.id}`, tone: "warning", text: `${c.providerLabel} returns no citations. Owned citation rate will be N/A for it, not 0%.` });
    }
    for (const c of channels.filter((x) => (state.searchModes[x.id] ?? x.searchMode) === "model_only")) {
      out.push({ id: `modelonly-${c.id}`, tone: "warning", text: `${c.providerLabel} runs model-only: no web search, so no citations.` });
    }
    if (state.samples === 1) out.push({ id: "samples", tone: "info", text: "One sample per prompt. Variation between runs is not measured." });
    const active = prompts.filter((p) => p.status === "active").length;
    if (usage.prompts < active) out.push({ id: "subset", tone: "info", text: `${active - usage.prompts} active prompts are not included. Results are not comparable with a full audit.` });
    if (state.market !== data.store.market || state.language !== data.store.language) {
      out.push({ id: "market", tone: "warning", text: `Market or language differs from this website (${data.store.market} · ${data.store.language.toUpperCase()}). Results will not match earlier audits.` });
    }
    const answered = new Set(data.answeredPromptIds);
    const missing = includedPrompts(prompts, state).filter((p) => !answered.has(p.id)).length;
    if (missing > 0) out.push({ id: "unanswered", tone: "warning", text: `${missing} selected ${missing === 1 ? "prompt has" : "prompts have"} no demonstration answers. In this simulation they show as failed requests, not as the brand being absent.` });
  }
  if (state.web) {
    if (!state.searchConsole) out.push({ id: "gsc", tone: "warning", text: "Search Console is off. Indexing coverage checks will be marked not assessed." });
    if (!state.pageSpeed) out.push({ id: "psi", tone: "warning", text: "PageSpeed is off. Performance checks will be marked not assessed." });
    if (!state.cms) {
      out.push({
        id: "cms",
        tone: "info",
        text: data.integrations.cmsNeedsAttention ? "The website connector needs attention, so it is off. Page facts are read from crawled HTML only." : "No website connector. Page facts are read from crawled HTML only.",
      });
    }
    out.push({ id: "field", tone: "info", text: "Field performance data is usually unavailable for low-traffic pages. Lab data is labelled as lab." });
  }
  if (state.scenario !== "normal") out.push({ id: "scenario", tone: "info", text: state.scenario === "provider_outage" ? "Simulated provider outage: the run will fail." : "Simulated blocked crawl: the run will stop during validation." });
  if (usage.overRequests) out.push({ id: "requests", tone: "warning", text: `${usage.jobs} requests exceed the ${state.maxRequests} request limit. The audit would stop at the limit and be partially completed.` });
  if (usage.overBudget) out.push({ id: "budget", tone: "warning", text: "Estimated cost exceeds the budget cap. The audit would stop at the cap and be partially completed." });
  return out;
}

export const searchModeOptions = (Object.keys(SEARCH_MODE_LABEL) as SearchMode[]).map((m) => ({ value: m, label: SEARCH_MODE_LABEL[m] }));

/** The frozen configuration saved with the audit. */
export function buildConfig(data: WizardData, state: WizardState, prompts: WizardPrompt[]): { config: AuditConfig; lanes: AuditLane[] } {
  const included = includedPrompts(prompts, state);
  const startPoints = [state.startHomepage && "Homepage", state.startSitemap && "Sitemap", state.startUrlList && `URL list (${urlLines(state.urlList).length} URLs)`, state.startCms && "Website connector"].filter(Boolean) as string[];
  const trigger: AuditTrigger | undefined =
    state.kind === "triggered"
      ? { source: state.triggerSource, reason: state.triggerReason.trim(), dedupKey: `${state.triggerSource}:${state.findingId || "manual"}` }
      : state.kind === "scheduled"
        ? { source: "schedule", reason: `${state.cadence === "weekly" ? "Weekly" : "Monthly"}, first run now`, cadence: state.cadence }
        : undefined;
  const answered = new Set(data.answeredPromptIds);
  const noAnswerPromptIds = state.ai ? included.filter((p) => !answered.has(p.id)).map((p) => p.id) : [];
  const config: AuditConfig = {
    noAnswerPromptIds: noAnswerPromptIds.length > 0 ? noAnswerPromptIds : undefined,
    promptScope: state.promptMode === "all" ? "all_active" : state.promptMode === "groups" ? "groups" : "ids",
    promptIds: state.ai ? included.map((p) => p.id) : [],
    prompts: state.ai ? included.map((p) => ({ id: p.id, text: p.text, version: p.version })) : [],
    channelIds: state.ai ? state.channelIds : [],
    searchModes: state.searchModes,
    samples: state.samples,
    market: state.market,
    language: state.language,
    startPoints: state.web ? startPoints : [],
    maxUrls: state.web ? state.maxUrls : 0,
    maxDepth: state.web ? state.maxDepth : 0,
    pageTypes: state.web ? state.pageTypes : [],
    excludedPaths: state.web ? urlLines(state.excludedPaths) : [],
    criteriaVersion: state.criteria,
    analysisVersion: "1.2",
    integrations: { searchConsole: state.web && state.searchConsole, pageSpeed: state.web && state.pageSpeed, cms: state.web && state.cms },
    limits: { maxRequests: state.maxRequests, concurrency: state.concurrency, budgetUsd: state.budgetUsd },
    categories: state.web ? state.categories : [],
    trigger,
    verifies: state.kind === "verification" && state.findingId ? { findingId: state.findingId, taskId: state.taskId || undefined } : undefined,
    scenario: state.scenario,
    retries: state.retries,
    timeoutSeconds: state.timeoutSeconds,
  };
  return { config, lanes: [...(state.ai ? (["ai_visibility"] as const) : []), ...(state.web ? (["website_readiness"] as const) : [])] };
}
