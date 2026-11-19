/** Audit module types. Backend-agnostic shapes so real services can return the same data. */
import type { Rate, SearchMode } from "@/types/core";
import type { Finding, ResponseSample } from "@/types/shared-records";

export type AuditLane = "ai_visibility" | "website_readiness";
export type AuditType = "initial" | "full" | "focused" | "verification" | "triggered" | "scheduled";
export type AuditStatus = "completed" | "completed_with_warnings" | "in_progress" | "partially_completed";

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

export type AuditDetail = AuditSummary & {
  config: AuditConfig;
  coverage: AuditCoverage;
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

export type CompetitorRow = { id: string; name: string; mentioned: Rate; isBrand: boolean };

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

export type PageIssue = { checkId: string; name: string; status: CheckStatus; snippet: string };

export type AuditFinding = Finding & {
  /** First detected by this audit. */
  isNew: boolean;
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
  prompts: WizardPrompt[];
  groups: { id: string; name: string }[];
  channels: WizardChannel[];
  integrations: { searchConsole: boolean; cms: boolean };
  knownPages: number | null;
  costPerJobUsd: number;
  costPerPageUsd: number;
};
