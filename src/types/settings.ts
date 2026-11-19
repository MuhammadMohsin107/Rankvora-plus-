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

/* ───────── Billing ───────── */

export type ProviderUsage = { provider: ProviderCode; label: string; requests: number; cap: number; searchCalls: number; estimatedCostUsd: number };

export type StoreProviderUsage = { storeId: string; storeName: string; byProvider: Partial<Record<ProviderCode, number>>; total: number; cap: number };

export type PlanLimit = { id: string; label: string; used: number; limit: number; unit: string };

export type Invoice = { id: string; period: string; issuedOn: string; amountUsd: number; status: "paid" | "upcoming" };

export type BillingOverview = {
  planName: string;
  periodLabel: string;
  planLimits: PlanLimit[];
  providerUsage: ProviderUsage[];
  storeUsage: StoreProviderUsage[];
  totalRequests: number;
  totalCap: number;
  invoices: Invoice[];
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

/* ───────── Add-store sample data ───────── */

export type SuggestedCompetitor = { id: string; name: string; domain: string; reason: string };
export type SampleProduct = { id: string; title: string; category: string; url: string };
export type StoreSetupSample = { suggestedCompetitors: SuggestedCompetitor[]; shopifyProducts: SampleProduct[] };
