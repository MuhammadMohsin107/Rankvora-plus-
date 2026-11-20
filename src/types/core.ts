/**
 * Core domain types shared by every UI module. They mirror the specification
 * vocabulary (stores, prompts, channels) so real services can return the same shapes.
 */

export type Role = "owner" | "admin" | "editor" | "auditor" | "viewer";

export type StoreStatus = "draft" | "needs_review" | "ready" | "active" | "paused" | "disconnected" | "archived";
/** Site type. Shopify is one option among many; user-facing labels come from lib/labels (siteTypeLabel). */
export type StorePlatform = "shopify" | "woocommerce" | "wordpress" | "webflow" | "wix" | "squarespace" | "custom" | "manual";
export type IntegrationState = "connected" | "needs_attention" | "disconnected" | "manual" | "not_connected";

export type Organization = {
  id: string;
  name: string;
  timezone: string;
};

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  lastActive: string;
};

export type Rate = { n: number; d: number };

export type StoreSummary = {
  mention: Rate;
  mentionPrevious: Rate;
  recommendation: Rate;
  recommendationPrevious: Rate;
  /** Denominator counts only citation-capable responses. */
  ownedCitation: Rate;
  ownedCitationPrevious: Rate;
  openFindings: number;
  pendingTasks: number;
  openAlerts: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  activePrompts: number;
};

export type Store = {
  id: string;
  name: string;
  brandName: string;
  domain: string;
  platform: StorePlatform;
  market: string;
  marketName: string;
  language: string;
  timezone: string;
  status: StoreStatus;
  industry: string;
  brandGroupId?: string;
  integrations: { commerce: IntegrationState; searchConsole: IntegrationState };
  channelIds: string[];
  createdAt: string;
  /** null while setup is incomplete — no tracking data yet. */
  summary: StoreSummary | null;
  /** Present on websites created in the browser (demo-state). Never on seeded websites. */
  simulated?: true;
  origin?: "local-demo";
};

export type ProviderCode = "openai" | "gemini" | "perplexity" | "anthropic";
export type SearchMode = "model_only" | "web_grounded_required" | "web_grounded_auto";

/** A specific provider API + model + configuration being measured. */
export type AiChannel = {
  id: string;
  provider: ProviderCode;
  providerLabel: string;
  apiLabel: string;
  /** Placeholder id: real model ids come from the provider registry. */
  model: string;
  searchMode: SearchMode;
  supportsCitations: boolean;
  tone: 1 | 2 | 3 | 4 | 5;
};

export type Competitor = {
  id: string;
  storeId: string;
  name: string;
  domains: string[];
  aliases: string[];
  status: "suggested" | "confirmed" | "archived";
  market: string | null;
};

export type PromptIntent = "discovery" | "recommendation" | "comparison" | "alternative" | "product_service" | "local_market" | "informational";
export type PromptStatus = "draft" | "active" | "paused" | "archived";
export type PromptScope = "audit" | "monitoring" | "both";
export type PromptSource = "manual" | "ai_generated" | "imported" | "research_derived" | "template";

export type PromptBase = {
  id: string;
  storeId: string;
  text: string;
  intent: PromptIntent;
  topic: string;
  groupId: string | null;
  status: PromptStatus;
  scope: PromptScope;
  source: PromptSource;
  version: number;
  isCore: boolean;
  /** Names the brand (brand-specific) vs neutral discovery. */
  mentionsBrand: boolean;
  updatedAt: string;
};

export type PromptGroup = { id: string; storeId: string; name: string };

export type ProductService = { id: string; storeId: string; title: string; category: string; url: string };

export type AlertSeverity = "info" | "low" | "medium" | "high" | "critical";

/** Headline alerts surfaced in the shell notification menu. Monitoring demo data must reuse these ids. */
export type AlertHeadline = {
  id: string;
  storeId: string;
  severity: AlertSeverity;
  title: string;
  at: string;
  read: boolean;
};

export type OrgUsage = {
  periodLabel: string;
  requestCap: number;
  requests: number;
  perStore: { storeId: string; requests: number; cap: number }[];
};

/** One line of the unified activity timeline (authored activity or a locally recorded demo event). */
export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
  tone: "success" | "warning" | "accent" | "neutral" | "info";
  icon: "check-circle" | "alert-triangle" | "audit" | "monitoring" | "compare" | "fixes" | "globe" | "settings" | "bell" | "reports" | "prompts";
  /** Website the item belongs to. */
  websiteId: string;
  /** True for items recorded by an action in this browser. */
  simulated?: boolean;
};
