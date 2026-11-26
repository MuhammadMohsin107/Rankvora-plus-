/** Audit module types. Backend-agnostic shapes so real services can return the same data. */
import type { PromptBase, PromptGroup, Rate, SearchMode } from "@/types/core";
import type { EvidenceIds, Finding, ResponseSample } from "@/types/shared-records";

export type AuditLane = "ai_visibility" | "website_readiness";
export type AuditType = "initial" | "full" | "focused" | "verification" | "triggered" | "scheduled";
export type AuditStatus =
  | "draft"
  | "validating"
  | "queued"
  | "in_progress"
  | "completed"
  | "completed_with_warnings"
  | "partially_completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type CheckStatus = "pass" | "fail" | "warning" | "not_applicable" | "not_assessed" | "inconclusive" | "blocked" | "error";
export type CheckGroup =
  | "reachability"
  | "indexing"
  | "canonical"
  | "sitemaps"
  | "linking"
  | "rendering"
  | "url_quality"
  | "metadata"
  | "mobile_a11y"
  | "structured_data"
  | "content_entity";
/** Technical and content-quality pass rates are always reported separately. */
export type CheckKind = "technical" | "content";

/** Why a triggered or scheduled audit started. Manual audits have none. */
export type AuditTrigger = {
  source: "fix_applied" | "brand_fact" | "alert" | "competitor_suggested" | "schedule";
  reason: string;
  /** Prevents the same event from starting two audits. */
  dedupKey?: string;
  /** Scheduled audits only. */
  cadence?: "weekly" | "monthly";
  nextRunAt?: string;
};

/** What a verification audit re-checks. */
export type AuditVerifies = { findingId: string; taskId?: string };

/** Simulation switch for the demo: lets every end state be reached from the wizard. */
export type SimScenario = "normal" | "provider_outage" | "crawl_blocked";

export type AuditConfig = {
  promptScope: "all_active" | "groups" | "ids";
  promptIds: string[];
  channelIds: string[];
  samples: number;
  market: string;
  language: string;
  startPoints: string[];
  maxUrls: number;
  maxDepth: number;
  pageTypes: string[];
  excludedPaths: string[];
  criteriaVersion: string;
  analysisVersion: string;
  integrations: { searchConsole: boolean; pageSpeed: boolean; cms: boolean };
  limits: { maxRequests: number; concurrency: number; budgetUsd: number };
  /** Website lane: criteria categories evaluated. Omitted on earlier audits = all. */
  categories?: string[];
  searchModes?: Record<string, string>;
  /** Exact prompt versions run (frozen when the audit starts). */
  prompts?: { id: string; text: string; version: number }[];
  trigger?: AuditTrigger;
  verifies?: AuditVerifies;
  scenario?: SimScenario;
  /** Selected prompts the demonstration data has no answers for. Their requests fail in a simulation. */
  noAnswerPromptIds?: string[];
};

export type StageState = "done" | "running" | "queued";
export type AuditStage = {
  id: "validating" | "ai_requests" | "crawling" | "analysis" | "evaluation" | "report";
  label: string;
  state: StageState;
  done: number;
  total: number;
  unit: string;
  note?: string;
};

export type AuditProgress = {
  stages: AuditStage[];
  /** Overall work units (jobs + pages) for the progress bar. */
  overall: Rate;
  elapsedSeconds: number;
  jobs: { succeeded: number; failed: number; running: number; queued: number };
  current: { provider: string; promptText: string; sample: number; url: string };
  warnings: string[];
  failedResponses: ResponseSample[];
};

export type AuditCoverage = {
  /** Prompts with at least one successful response ÷ prompts planned. */
  prompts: Rate;
  /** Providers with at least one successful response ÷ providers planned. */
  providers: Rate;
  /** Successful ÷ planned requests. */
  responses: Rate;
  /** Pages assessed ÷ discovered in-scope. */
  pages: Rate;
  pagesDetail: { excluded: number; blocked: number; unvisited: number };
  /** Determinate checks ÷ applicable checks. */
  checks: Rate;
};

export type AuditSummary = {
  id: string;
  storeId: string;
  title: string;
  type: AuditType;
  lanes: AuditLane[];
  status: AuditStatus;
  startedAt: string;
  completedAt: string | null;
  /** Seconds between start and completion; elapsed-to-now while in progress. */
  durationSeconds: number;
  snapshotId: string | null;
  createdBy: string;
  plannedJobs: number;
  succeededJobs: number;
  failedJobs: number;
  /** Registry value: findings created by this audit. */
  findingsCreated: number;
  mention: Rate | null;
  recommendation: Rate | null;
  pages: Rate | null;
  provisional: boolean;
  reportId: string | null;
  reportStatus: "ready" | "generating" | "failed" | null;
  reportVersion: string | null;
};

/** What the audit consumed. Cost is an estimate from typical per-request pricing, not an invoice. */
export type AuditUsage = {
  requests: { attempted: number; succeeded: number; failed: number };
  searchCalls: number;
  inputTokens: number;
  outputTokens: number;
  pagesCrawled: number;
  estimatedCostUsd: number;
  budgetUsd: number;
};

export type AuditDetail = AuditSummary & {
  config: AuditConfig;
  coverage: AuditCoverage;
  usage: AuditUsage;
  limitations: { id: string; tone: "warning" | "info" | "neutral"; text: string }[];
  progress: AuditProgress | null;
  /** Previous comparable audit (same scope family) for baselines, or null. */
  baseline: { id: string; title: string } | null;
};

// ---------------------------------------------------------------------------
// AI visibility lane (computed from real response samples)
// ---------------------------------------------------------------------------

export type MetricKey = "mention" | "recommendation" | "citation";

export type BreakdownRow = {
  id: string;
  label: string;
  sub: string;
  /** Per metric: current rate, baseline rate (previous comparable audit) and failures excluded. */
  current: Record<MetricKey, Rate | null>;
  baseline: Record<MetricKey, Rate | null>;
  failed: number;
};

export type CompetitorRow = {
  id: string;
  name: string;
  mentioned: Rate;
  isBrand: boolean;
  /** A suggested (not yet confirmed) competitor that appears in the answers. */
  suggested?: boolean;
};

export type CitationDomainRow = { domain: string; source: "owned" | "competitor" | "third_party"; count: number };

export type AiLane = {
  responses: ResponseSample[];
  succeeded: number;
  failed: number;
  planned: number;
  mention: Rate;
  recommendation: Rate;
  /** Denominator: successful responses from citation-capable providers. */
  ownedCitation: Rate;
  baselinePrevious: { mention: Rate; recommendation: Rate; ownedCitation: Rate } | null;
  byProvider: BreakdownRow[];
  byGroup: BreakdownRow[];
  competitors: CompetitorRow[];
  citationsBySource: { owned: number; competitor: number; third_party: number };
  noCitationReturned: number;
  citationNotSupported: number;
  topDomains: CitationDomainRow[];
  prompts: { id: string; text: string; version: number }[];
  providers: { id: string; label: string }[];
};

// ---------------------------------------------------------------------------
// Website readiness lane
// ---------------------------------------------------------------------------

export type PageType = "home" | "collection" | "product" | "guide" | "page" | "policy";

export type CrawledPage = {
  id: string;
  url: string;
  path: string;
  type: PageType;
  status: number;
  finalUrl: string | null;
  redirectHops: number;
  contentType: string;
  sizeKb: number;
  depth: number;
  rendered: boolean;
  /** ISO date the page first existed (pages published later are absent from older audits). */
  publishedAt: string | null;
  indexable: boolean;
  metaRobots: string | null;
  xRobots: string | null;
  canonical: string | null;
  canonicalSelf: boolean;
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  schemaTypes: string[];
  schemaIssues: string[];
  words: number;
  inlinks: number;
  outInternal: number;
  outExternal: number;
  brokenLinks: string[];
  lab: { lcpMs: number; cls: number; tbtMs: number } | null;
  /** CrUX field data; null = no field data available. */
  field: { lcpMs: number; cls: number; inpMs: number } | null;
  crawledAt: string;
};

export type CheckEvidence = { label: string; snippet: string };

export type WebsiteCheck = {
  id: string;
  group: CheckGroup;
  kind: CheckKind;
  name: string;
  status: CheckStatus;
  /** Number of affected pages; null for site-wide checks. */
  affected: number | null;
  affectedPaths: string[];
  evidence: CheckEvidence;
  findingId: string | null;
};

export type CrawlerAccess = {
  id: string;
  name: string;
  purpose: string;
  allowed: boolean;
  /** The actual robots.txt group that applies. */
  rule: string;
  consequence: string;
  findingId: string | null;
};

export type WebsiteLane = {
  provisional: boolean;
  coverage: Pick<AuditCoverage, "pages" | "pagesDetail" | "checks">;
  pages: CrawledPage[];
  pagesTotalDetail: number;
  pageIssues: Record<string, PageIssue[]>;
  checks: WebsiteCheck[];
  crawlers: CrawlerAccess[];
  technical: Rate;
  content: Rate;
  checkCoverage: Rate;
  notice: string | null;
};

export type PageIssue = { checkId: string; name: string; status: CheckStatus; snippet: string; findingId?: string | null };

export type AuditFinding = Finding & {
  /** First detected by this audit. */
  isNew: boolean;
  /** Shared ids for the evidence trace (metric, prompt, response, fix, ...). */
  evidenceIds?: EvidenceIds;
};

export type AuditTaskLink = { id: string; title: string; findingId: string; status: string };

/** Headline metrics of both lanes, kept separate (never blended). */
export type LaneSummary = {
  provisional: boolean;
  ai: { mention: Rate; recommendation: Rate; ownedCitation: Rate; responses: Rate; prompts: Rate } | null;
  website: { technical: Rate; content: Rate; checks: Rate; pages: Rate; pagesDetail: { excluded: number; blocked: number; unvisited: number } } | null;
};

export type WizardPrompt = {
  id: string;
  text: string;
  version: number;
  status: "draft" | "active" | "paused" | "archived";
  groupId: string | null;
  groupName: string;
  intentLabel: string;
  isCore: boolean;
  scopeLabel: string;
};

export type WizardChannel = {
  id: string;
  providerLabel: string;
  apiLabel: string;
  model: string;
  searchMode: SearchMode;
  supportsCitations: boolean;
};

export type WizardData = {
  store: { id: string; name: string; domain: string; market: string; marketName: string; language: string };
  /** Static prompts. The wizard merges prompts created in this browser (usePrompts). */
  promptsBase: PromptBase[];
  groups: PromptGroup[];
  /** Prompts the demonstration basis has answers for; others show as failed requests in a simulation. */
  answeredPromptIds: string[];
  channels: WizardChannel[];
  integrations: { searchConsole: boolean; cms: boolean; cmsNeedsAttention: boolean };
  knownPages: number | null;
  costPerJobUsd: number;
  costPerPageUsd: number;
  /** Starting values taken from the website's latest full audit. */
  defaults: { samples: number; maxUrls: number; maxDepth: number; maxRequests: number; concurrency: number; budgetUsd: number; excludedPaths: string[] };
  findings: { id: string; title: string; lane: AuditLane; affectedPromptIds: string[] }[];
  /** Frozen configuration of earlier audits, for "Run again". */
  reruns: { id: string; title: string; type: AuditType; lanes: AuditLane[]; config: AuditConfig }[];
  /** Page-type ids present in the crawl basis (Home, Category, ...). */
  pageTypes: PageType[];
  /** Number of website checks a full evaluation runs. */
  checkCount: number;
  /** Audit the simulation takes its answers and crawl facts from; null when the website has none yet. */
  basisAuditId: string | null;
};

// ---------------------------------------------------------------------------
// Simulated runs (created in this browser)
// ---------------------------------------------------------------------------

/** Deterministic plan of a simulated run. Everything the clock needs; no randomness at run time. */
export type RunPlan = {
  jobs: number;
  pages: number;
  checks: number;
  /** Requests allowed by the request limit and the budget cap; below `jobs` the audit stops there. */
  jobCap: number;
  failPercent: number;
  seed: number;
  /** Request indexes that have no demonstration answer. They always fail, on top of the random failures. */
  noAnswerSlots?: number[];
  scenario: SimScenario;
  /** Milliseconds from start to the end of the run, and the status it ends in. */
  endAtMs: number;
  outcome: AuditStatus;
  /** Warnings that appear once the run clock passes `atMs`. */
  warnings: { atMs: number; text: string }[];
  aiLane: boolean;
  webLane: boolean;
};

/** Clock of a run. Elapsed time excludes pauses; `endedElapsedMs` freezes it when the run ends or is cancelled. */
export type RunState = { startedAtMs: number; pausedAtMs: number | null; pausedMs: number; endedElapsedMs: number | null };

/** One row of the audits collection: a seeded summary, or a simulated audit with its frozen setup. */
export type AuditRow = AuditSummary & {
  paused?: boolean;
  config?: AuditConfig;
  plan?: RunPlan;
  run?: RunState | null;
  basisAuditId?: string;
  endedAt?: string | null;
  note?: string;
  createdAt?: string;
  simulated?: boolean;
};

/** Everything the browser needs to build the results of a simulated audit from an existing one. */
export type AuditBasis = {
  storeId: string;
  brandName: string;
  domain: string;
  market: string;
  language: string;
  basisAudit: { id: string; title: string };
  basisConfig: AuditConfig;
  responses: ResponseSample[];
  channels: WizardChannel[];
  prompts: { id: string; text: string; version: number; groupId: string | null; status: string }[];
  groups: { id: string; name: string }[];
  suggestedCompetitors: { id: string; name: string }[];
  pages: CrawledPage[];
  checks: WebsiteCheck[];
  crawlers: CrawlerAccess[];
  findings: (Finding & { evidenceIds: EvidenceIds })[];
  tasks: AuditTaskLink[];
};
