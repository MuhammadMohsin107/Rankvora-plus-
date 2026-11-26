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
  /** AI channels selected for the website. 0 means nothing is tracked yet and results are N/A. */
  channelCount: number;
  /** False when the server does not know this website (created locally): the client fills the fields from demo-state. */
  resolved?: boolean;
};

export type ExistingPrompt = { id: string; storeId: string; text: string; status: PromptStatus };

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

/** `brands` is the phrase for "the brands in this category" ("running shoe brands", "nutrition websites and brands"). */
export type TemplateProfile = { brand: string; category: string; brands: string; market: string; city: string; competitor: string; item: string; need: string };

/** Another website of the organization, for "Copy to website". `texts` are its prompt texts (duplicate check). */
export type WebsiteOption = { id: string; name: string; texts: string[] };

/** Everything the library, detail and create screens need about one website. Never contains per-prompt results. */
export type PromptContext = {
  store: StoreContext;
  channels: ChannelOption[];
  groups: PromptGroup[];
  /** Optional offerings (products, services, locations). */
  products: ProductService[];
  existing: ExistingPrompt[];
  actor: string;
  otherWebsites: WebsiteOption[];
  profile: TemplateProfile;
  templates: PromptTemplate[];
  /** Competitor names confirmed for this website (for competitor-angle suggestions). */
  competitors: string[];
};

export type CompetitorMention = { id: string; name: string; mentioned: Rate };

/** Share of citation-returning responses that cite a domain. */
export type CitationSummary = { domain: string; source: "owned" | "competitor" | "third_party"; cited: Rate };

export type Observation = { runId: string; kind: "monitoring" | "audit"; at: string; channelLabel: string } | null;

/** A monitoring schedule that includes the prompt. */
export type PromptScheduleInfo = { id: string; name: string; frequency: string; status: string };

export type PromptEvidence = {
  lastObservation: Observation;
  competitors: CompetitorMention[];
  /** Citation-returning responses in scope (denominator for every citation row). */
  citationResponses: number;
  citations: CitationSummary[];
  schedules: PromptScheduleInfo[];
};

export type PromptDetailData = {
  storeId: string;
  context: PromptContext;
  /** null when the prompt is not in the static data (created in this browser). */
  prompt: PromptRecord | null;
  versions: PromptVersion[];
  activity: PromptActivityItem[];
  results: PromptResults;
  evidence: PromptEvidence;
};

export type NewPromptData = {
  storeId: string;
  context: PromptContext;
};

export type LibraryData = {
  storeId: string;
  context: PromptContext;
  prompts: LibraryPrompt[];
  /** Prompts in the latest monitoring run (coverage label). 0 when nothing ran. */
  inLatestRun: number;
};

/** Fields kept on a locally stored prompt row besides the PromptRecord ones. */
export type LocalPromptExtras = {
  /** Stamped by the demo state on rows created in this browser. */
  origin?: "local-demo";
  simulated?: true;
  /** Versions created in this browser (newest first). Earlier ones come from the static data. */
  localVersions?: PromptVersion[];
  localActivity?: PromptActivityItem[];
};

export type StoredPrompt = PromptRecord & LocalPromptExtras;
