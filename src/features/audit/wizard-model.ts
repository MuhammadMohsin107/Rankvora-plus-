import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { SearchMode } from "@/types/core";
import type { WizardData } from "@/types/audit";

export type WizardKind = "initial" | "full" | "focused" | "verification";
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
  criteria: string;
  searchConsole: boolean;
  pageSpeed: boolean;
  cms: boolean;
  maxUrls: number;
  maxRequests: number;
  concurrency: number;
  budgetUsd: number;
};

export const PAGE_TYPE_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "collection", label: "Collections" },
  { value: "product", label: "Products" },
  { value: "guide", label: "Guides" },
  { value: "page", label: "Pages and policies" },
] as const;

export const KIND_OPTIONS: { value: WizardKind; label: string; description: string }[] = [
  { value: "initial", label: "Initial", description: "First baseline for this store" },
  { value: "full", label: "Full", description: "All active prompts and the whole site" },
  { value: "focused", label: "Focused", description: "A subset of prompts or sections" },
  { value: "verification", label: "Verification", description: "Re-check after a fix" },
];

export const MARKETS = [
  { value: "PK", label: "PK · Pakistan" },
  { value: "AE", label: "AE · United Arab Emirates" },
  { value: "GB", label: "GB · United Kingdom" },
  { value: "US", label: "US · United States" },
];
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
];

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
    samples: 2,
    startHomepage: true,
    startSitemap: true,
    startUrlList: false,
    startCms: false,
    urlList: "",
    maxDepth: 4,
    pageTypes: PAGE_TYPE_OPTIONS.map((p) => p.value),
    excludedPaths: "/cart\n/checkout\n/account",
    criteria: "2.1",
    searchConsole: data.integrations.searchConsole,
    pageSpeed: true,
    cms: data.integrations.cms,
    maxUrls: 150,
    maxRequests: 200,
    concurrency: 4,
    budgetUsd: 8,
  };
}

export const urlLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Active prompts that this configuration includes. */
export function includedPrompts(data: WizardData, state: WizardState) {
  const active = data.prompts.filter((p) => p.status === "active");
  if (state.promptMode === "all") return active;
  if (state.promptMode === "groups") return active.filter((p) => p.groupId && state.groupIds.includes(p.groupId));
  return active.filter((p) => state.promptIds.includes(p.id));
}

export type Usage = {
  prompts: number;
  channels: number;
  samples: number;
  jobs: number;
  pages: number;
  costUsd: number;
  overBudget: boolean;
  overRequests: boolean;
};

/** Live predicted usage: jobs = active prompts × channels × samples. Cost is approximate. */
export function predictUsage(data: WizardData, state: WizardState): Usage {
  const prompts = state.ai ? includedPrompts(data, state).length : 0;
  const channels = state.ai ? state.channelIds.length : 0;
  const jobs = prompts * channels * state.samples;
  const listed = state.startUrlList ? urlLines(state.urlList).length : 0;
  const crawlStarts = state.startHomepage || state.startSitemap || state.startCms;
  const discovered = crawlStarts ? (data.knownPages ?? state.maxUrls) : 0;
  const pages = state.web ? Math.min(state.maxUrls, discovered + listed) : 0;
  const costUsd = jobs * data.costPerJobUsd + pages * data.costPerPageUsd;
  return { prompts, channels, samples: state.samples, jobs, pages, costUsd, overBudget: costUsd > state.budgetUsd, overRequests: jobs > state.maxRequests };
}

export type Limitation = { id: string; tone: "warning" | "info"; text: string };

export function limitations(data: WizardData, state: WizardState, usage: Usage): Limitation[] {
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
    const active = data.prompts.filter((p) => p.status === "active").length;
    if (usage.prompts < active) out.push({ id: "subset", tone: "info", text: `${active - usage.prompts} active prompts are not included. Results are not comparable with a full audit.` });
    if (state.market !== data.store.market || state.language !== data.store.language) {
      out.push({ id: "market", tone: "warning", text: `Market or language differs from the store (${data.store.market} · ${data.store.language.toUpperCase()}). Results will not match earlier audits.` });
    }
  }
  if (state.web) {
    if (!state.searchConsole) out.push({ id: "gsc", tone: "warning", text: "Search Console is off. Indexing coverage checks will be marked not assessed." });
    if (!state.pageSpeed) out.push({ id: "psi", tone: "warning", text: "PageSpeed is off. Performance checks will be marked not assessed." });
    if (!state.cms) out.push({ id: "cms", tone: "info", text: "No CMS connector. Product facts are compared from crawled HTML only." });
    out.push({ id: "field", tone: "info", text: "Field performance data is usually unavailable for low-traffic pages. Lab data is labelled as lab." });
  }
  if (usage.overRequests) out.push({ id: "requests", tone: "warning", text: `${usage.jobs} requests exceed the ${state.maxRequests} request limit. The audit would stop at the limit and be partially completed.` });
  if (usage.overBudget) out.push({ id: "budget", tone: "warning", text: "Approximate cost exceeds the budget cap." });
  return out;
}

export const searchModeOptions = (Object.keys(SEARCH_MODE_LABEL) as SearchMode[]).map((m) => ({ value: m, label: SEARCH_MODE_LABEL[m] }));
