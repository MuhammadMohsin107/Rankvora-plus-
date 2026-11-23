/** Types for Organization settings and Store settings (demo-backed, service-shaped). */
import type { IntegrationState, ProviderCode, Role, SearchMode, StorePlatform } from "@/types/core";

/* ───────── Providers (organization → AI platforms) ───────── */

/** Provider facts that are not part of the shared channel record. */
export type ProviderConnectionBase = {
  provider: ProviderCode;
  /** Shared channel this provider powers; null when not offered yet. */
  channelId: string | null;
  label: string;
  availability: "available" | "later";
  status: IntegrationState;
  /** Last 4 characters only; the full key is never available to the UI. */
  keyLast4: string | null;
  byok: boolean;
  searchCapability: string;
  lastVerifiedAt: string | null;
  /** What the simulated "Test connection" returns. */
  testOutcome: { ok: true } | { ok: false; message: string };
  /** Short line for providers that are not offered yet. */
  laterNote?: string;
};

export type ProviderConnection = ProviderConnectionBase & {
  apiLabel: string;
  model: string | null;
  searchMode: SearchMode | null;
  supportsCitations: boolean | null;
};

/* ───────── Notifications ───────── */

export type NotificationChannel = "in_app" | "email" | "webhook";

export type NotificationEventId =
  | "new_mention"
  | "lost_mention"
  | "new_recommendation"
  | "recommendation_lost"
  | "new_owned_citation"
  | "lost_owned_citation"
  | "sentiment_shift"
  | "competitor_increase"
  | "competitor_decrease"
  | "rank_movement"
  | "provider_error_spike"
  | "run_incomplete";

export type NotificationEvent = { id: NotificationEventId; label: string; group: string; info?: string };

export type NotificationMatrix = Record<NotificationEventId, NotificationChannel[]>;

export type DigestFrequency = "off" | "daily" | "weekly";

export type QuietHours = { enabled: boolean; from: string; to: string; timezone: string; allowCritical: boolean };

export type NotificationPrefs = {
  matrix: NotificationMatrix;
  digest: DigestFrequency;
  quietHours: QuietHours;
  webhookUrl: string;
};

export type StoreNotificationOverride = { storeId: string; mode: "inherit" | "override"; matrix: NotificationMatrix };

/* ───────── Roles ───────── */

export type PermissionId = "view" | "edit" | "run_audits" | "review" | "approve" | "members";

export type Permission = { id: PermissionId; label: string; info: string };

export type RolePermissions = Record<Role, PermissionId[]>;

export type PendingInvite = { id: string; email: string; role: Role; invitedAt: string; invitedBy: string };

/* ───────── Team ───────── */

export type MemberStatus = "active" | "invited" | "deactivated";

/** A person in the Team list. Extends the shared Member with invite state and website access. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  lastActive: string | null;
  status: MemberStatus;
  invitedAt: string | null;
  invitedBy: string | null;
  /** Website ids this person can open. null means every website. */
  websiteIds: string[] | null;
};

/* ───────── Billing (demonstration only: no payments, no card data) ───────── */

export type PlanId = "starter" | "growth" | "agency";

export type PlanLimits = {
  websites: number;
  prompts: number;
  /** AI provider requests per month. */
  requests: number;
  /** Web search calls per month. */
  searchCalls: number;
  seats: number;
  /** Estimated provider cost included per month, USD. */
  usageAllowanceUsd: number;
};

export type BillingPlan = {
  id: PlanId;
  name: string;
  /** USD per month. */
  priceUsd: number;
  limits: PlanLimits;
  monitoring: string;
  retentionMonths: number;
};

export type InvoiceStatus = "paid" | "open" | "failed" | "refunded";

export type BillingInvoice = {
  id: string;
  issuedOn: string;
  /** Short label, e.g. "Nov 2026". */
  period: string;
  description: string;
  amountUsd: number;
  status: InvoiceStatus;
  /** Why it failed or was refunded. */
  note?: string;
};

export type PaymentMethod = {
  brand: "Visa" | "Mastercard" | "Amex";
  /** Last 4 digits of a demo test card only. */
  last4: string;
  expMonth: number;
  expYear: number;
  holder: string;
};

export type BillingContact = {
  name: string;
  email: string;
  legalName: string;
  addressLine: string;
  city: string;
  country: string;
  postalCode: string;
  taxId: string;
};

/** Everything the Billing screens change locally. Saved under the demo-state key `org.billing`. */
export type BillingState = {
  planId: PlanId;
  /** Extra requests (and matching search calls) bought for the current period. */
  credits: number;
  /** ISO date the subscription ends, or null while it renews. */
  cancelAt: string | null;
  paymentMethod: PaymentMethod;
  contact: BillingContact;
  createdInvoices: BillingInvoice[];
  invoiceStatus: Record<string, InvoiceStatus>;
};

export type CreditPack = { id: string; requests: number; priceUsd: number };

/** Requests for one website in the current period, by provider. */
export type WebsiteUsageSeed = {
  websiteId: string;
  requests: Partial<Record<"openai" | "gemini" | "perplexity", number>>;
};

export type UsageMonth = {
  /** Short label, e.g. "Aug". */
  label: string;
  /** null when nothing was tracked yet. */
  requests: number | null;
  /** Plan limit that month, null before a plan existed. */
  limit: number | null;
};

export type BillingHistoryEntry = {
  id: string;
  at: string;
  kind: "plan" | "payment" | "addon" | "refund" | "method";
  title: string;
  detail?: string;
};

export type BillingBase = {
  plans: BillingPlan[];
  state: BillingState;
  invoices: BillingInvoice[];
  packs: CreditPack[];
  /** Period dates are fixed for the demonstration. */
  period: { label: string; start: string; end: string; renewsOn: string };
  /** Unit cost per request, USD, by provider. */
  unitCostUsd: Record<"openai" | "gemini" | "perplexity", number>;
  usageSeeds: WebsiteUsageSeed[];
  history: UsageMonth[];
  events: BillingHistoryEntry[];
};

/* ───────── Organization profile and local provider state ───────── */

/** Saved under `org.general`. The shell can read it to show the organization name. */
export type OrgGeneral = { name: string; timezone: string; market: string; language: string };

/** Saved per provider under `org.providers`. Keys are never stored, only the last 4 characters of a masked demo key. */
export type ProviderLocalState = {
  status: IntegrationState;
  byok: boolean;
  keyLast4: string | null;
  lastVerifiedAt: string | null;
  /** "Notify me" for providers that are not offered yet. */
  notify: boolean;
};

/* ───────── Store settings ───────── */

export type ActivityKind = "store" | "integration" | "competitor" | "brand" | "domain" | "product" | "notification";

export type ActivityEntry = {
  id: string;
  storeId: string;
  at: string;
  actor: string;
  title: string;
  detail?: string;
  kind: ActivityKind;
};

export type BrandVersion = {
  version: number;
  createdAt: string;
  createdBy: string;
  note: string;
  brandName: string;
  aliases: string[];
  differentiators: string[];
  description: string;
  /** Business category (the website industry at the time of the version). */
  category?: string;
};

export type DomainAlias = { host: string; kind: "alias" | "redirect" };
export type FormerDomain = { host: string; from: string; to: string; reason: string };

export type DomainRecord = { storeId: string; canonical: string; aliases: DomainAlias[]; former: FormerDomain[] };

export type IntegrationScope = { scope: string; purpose: string; granted: boolean };

export type IntegrationDetail = {
  storeId: string;
  commerce: {
    platform: StorePlatform;
    state: IntegrationState;
    account: string | null;
    scopes: IntegrationScope[];
    lastVerifiedAt: string | null;
    note: string | null;
  };
  searchConsole: {
    state: IntegrationState;
    property: string | null;
    lastVerifiedAt: string | null;
    note: string | null;
  };
};

/* ───────── Website brand knowledge (website settings) ───────── */

export type BrandFact = { id: string; label: string; value: string; sourceUrl: string };
export type BrandFaq = { id: string; question: string; answer: string };
export type SourcePage = { id: string; url: string; title: string; type: string; confirmed: boolean };
/** One AI crawler as the latest audit saw it. Read only: reported apart from visibility metrics. */
export type CrawlerSummaryRow = { id: string; name: string; purpose: string; allowed: boolean; findingId: string | null };

/** Static starting point (demonstration data) for the Brand knowledge tab. */
export type BrandKnowledgeBase = {
  facts: BrandFact[];
  faqs: BrandFaq[];
  contentContext: string;
  sourcePages: SourcePage[];
  crawlers: CrawlerSummaryRow[];
  /** Audit the crawler summary and source pages came from; null when the website has no audit yet. */
  auditId: string | null;
  scannedAt: string | null;
};

/** Saved under `website.<id>.knowledge`. Crawler rows are never saved: they come from the audit. */
export type BrandKnowledgeState = Pick<BrandKnowledgeBase, "facts" | "faqs" | "contentContext" | "sourcePages" | "scannedAt">;

/* ───────── Add-website sample data ───────── */

export type SuggestedCompetitor = { id: string; name: string; domain: string; reason: string };
export type StoreSetupSample = { suggestedCompetitors: SuggestedCompetitor[] };
