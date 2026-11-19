/** Types for the Prompt management module (library, creation, detail). */
import type { PromptBase, PromptGroup, PromptIntent, PromptStatus, ProductService, Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";

/** A prompt with the tracking configuration the library and detail screens need. */
export type PromptRecord = PromptBase & {
  market: string;
  language: string;
  productIds: string[];
  createdAt: string;
  createdBy: string;
};

/** What the most recent monitoring run produced for one prompt on one provider. */
export type ResultState = "recommended" | "mentioned" | "absent" | "failed" | "na";

export type LastResult = {
  channelId: string;
  label: string;
  state: ResultState;
  /** Successful samples that mention the brand. */
  mentioned: number;
  /** Successful samples (failures excluded). */
  samples: number;
  failed: number;
};

export type LibraryPrompt = PromptRecord & { lastResults: LastResult[] };

export type PromptVersion = {
  version: number;
  text: string;
  changedBy: string;
  changedAt: string;
  note: string | null;
  /** Monitoring runs and audits whose responses used this version. */
  runs: number;
};

export type PromptActivityKind = "created" | "version" | "status" | "config";

export type PromptActivityItem = {
  id: string;
  at: string;
  actor: string;
  title: string;
  detail?: string;
  kind: PromptActivityKind;
};

/** Counts for one slice of results. Rates use successful responses as denominator. */
export type ResultCounts = {
  mention: Rate;
  recommendation: Rate;
  failed: number;
  requests: number;
};

export type ProviderResult = ResultCounts & {
  channelId: string;
  label: string;
  /** Provider API · model · search mode. */
  channelLabel: string;
};

export type RunResult = {
  runId: string;
  /** ISO date of the run. */
  date: string;
  pooled: ResultCounts;
  byChannel: Record<string, ResultCounts>;
};

export type PromptResults = {
  providers: ProviderResult[];
  pooled: ResultCounts;
  runs: RunResult[];
  /** Newest first. Empty when sample responses are not available. */
  latest: ResponseSample[];
  period: string | null;
};

export type ChannelOption = { id: string; label: string; providerLabel: string; tone: 1 | 2 | 3 | 4 | 5 };

export type StoreContext = {
  id: string;
  name: string;
  brandName: string;
  market: string;
  marketName: string;
  language: string;
};

export type ExistingPrompt = { id: string; text: string; status: PromptStatus };

export type PromptDetailData = {
  store: StoreContext;
  prompt: PromptRecord;
  versions: PromptVersion[];
  activity: PromptActivityItem[];
  results: PromptResults;
  channels: ChannelOption[];
  groups: PromptGroup[];
  products: ProductService[];
  existing: ExistingPrompt[];
  actor: string;
};

export type PromptSuggestion = {
  id: string;
  text: string;
  intent: PromptIntent;
  topic: string;
  /** Names the brand (brand-specific) vs neutral discovery. */
  brandSpecific: boolean;
};

export type PromptTemplate = {
  id: string;
  title: string;
  /** May contain {brand} {category} {market} {city} {competitor}. */
  text: string;
  intent: PromptIntent;
  topic: string;
};

export type TemplateProfile = { brand: string; category: string; market: string; city: string; competitor: string };

export type NewPromptData = {
  store: StoreContext;
  groups: PromptGroup[];
  products: ProductService[];
  existing: ExistingPrompt[];
  channels: ChannelOption[];
  suggestionBatches: PromptSuggestion[][];
  templates: PromptTemplate[];
  profile: TemplateProfile;
};

export type LibraryData = {
  store: StoreContext;
  prompts: LibraryPrompt[];
  groups: PromptGroup[];
  channels: ChannelOption[];
};
