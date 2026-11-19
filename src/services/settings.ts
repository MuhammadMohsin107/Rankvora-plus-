/**
 * Data access for organization and store settings. Reads demonstration data
 * today; later these functions will call the real application services.
 */
import {
  DEMO_ACTIVITY,
  DEMO_ARCHIVED_COMPETITORS,
  DEMO_BRAND_VERSIONS,
  DEMO_DOMAINS,
  DEMO_INTEGRATIONS,
  DEMO_INVITES,
  DEMO_INVOICES,
  DEMO_ORG_NOTIFICATIONS,
  DEMO_PLAN,
  DEMO_PROVIDERS,
  DEMO_PROVIDER_CAPS,
  DEMO_PROVIDER_EXTRAS,
  DEMO_SETUP_SAMPLE,
  DEMO_STORE_NOTIFICATIONS,
  DEMO_STORE_PROVIDER_REQUESTS,
  NOTIFICATION_EVENTS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "@/demo/settings";
import { getOrgUsage, listChannels, listCompetitors, listMembers, listStores } from "@/services/core";
import type { Competitor, ProviderCode } from "@/types/core";
import type {
  ActivityEntry,
  BillingOverview,
  BrandVersion,
  DomainRecord,
  IntegrationDetail,
  NotificationEvent,
  NotificationPrefs,
  PendingInvite,
  Permission,
  ProviderConnection,
  RolePermissions,
  StoreNotificationOverride,
  StoreSetupSample,
} from "@/types/settings";

export async function listProviderConnections(): Promise<ProviderConnection[]> {
  const channels = await listChannels();
  return DEMO_PROVIDERS.map((base) => {
    const channel = channels.find((c) => c.id === base.channelId);
    return {
      ...base,
      apiLabel: channel?.apiLabel ?? "Messages API",
      model: channel?.model ?? null,
      searchMode: channel?.searchMode ?? null,
      supportsCitations: channel ? channel.supportsCitations : null,
    };
  });
}

export async function listNotificationEvents(): Promise<NotificationEvent[]> {
  return NOTIFICATION_EVENTS;
}

export async function getOrgNotificationPrefs(): Promise<NotificationPrefs> {
  return DEMO_ORG_NOTIFICATIONS;
}

export async function getStoreNotificationOverride(storeId: string): Promise<StoreNotificationOverride> {
  return DEMO_STORE_NOTIFICATIONS.find((o) => o.storeId === storeId) ?? { storeId, mode: "inherit", matrix: DEMO_ORG_NOTIFICATIONS.matrix };
}

export async function listPermissions(): Promise<Permission[]> {
  return PERMISSIONS;
}

export async function getRolePermissions(): Promise<RolePermissions> {
  return ROLE_PERMISSIONS;
}

export async function listPendingInvites(): Promise<PendingInvite[]> {
  return DEMO_INVITES;
}

export async function getBilling(): Promise<BillingOverview> {
  const [stores, members, usage] = await Promise.all([listStores(), listMembers(), getOrgUsage()]);
  const providers: { code: Extract<ProviderCode, "openai" | "gemini" | "perplexity">; label: string }[] = [
    { code: "openai", label: "OpenAI" },
    { code: "gemini", label: "Gemini" },
    { code: "perplexity", label: "Perplexity" },
  ];

  const storeUsage = stores.map((store) => {
    const byProvider = DEMO_STORE_PROVIDER_REQUESTS[store.id] ?? {};
    const total = Object.values(byProvider).reduce((sum, value) => sum + (value ?? 0), 0);
    const cap = usage.perStore.find((row) => row.storeId === store.id)?.cap ?? 0;
    return { storeId: store.id, storeName: store.name, byProvider, total, cap };
  });

  const providerUsage = providers.map(({ code, label }) => ({
    provider: code as ProviderCode,
    label,
    requests: storeUsage.reduce((sum, row) => sum + (row.byProvider[code] ?? 0), 0),
    cap: DEMO_PROVIDER_CAPS[code],
    searchCalls: DEMO_PROVIDER_EXTRAS[code].searchCalls,
    estimatedCostUsd: DEMO_PROVIDER_EXTRAS[code].estimatedCostUsd,
  }));

  const totalRequests = providerUsage.reduce((sum, row) => sum + row.requests, 0);
  const totalCap = providerUsage.reduce((sum, row) => sum + row.cap, 0);
  const activePrompts = stores.reduce((sum, store) => sum + (store.summary?.activePrompts ?? 0), 0);

  return {
    planName: DEMO_PLAN.name,
    periodLabel: "Nov 2026",
    planLimits: [
      { id: "stores", label: "Stores", used: stores.length, limit: DEMO_PLAN.storeLimit, unit: "stores" },
      { id: "members", label: "Members", used: members.length, limit: DEMO_PLAN.memberLimit, unit: "members" },
      { id: "prompts", label: "Active prompts", used: activePrompts, limit: DEMO_PLAN.activePromptLimit, unit: "prompts" },
      { id: "requests", label: "Provider requests", used: totalRequests, limit: totalCap, unit: "requests" },
    ],
    providerUsage,
    storeUsage,
    totalRequests,
    totalCap,
    invoices: DEMO_INVOICES,
  };
}

export async function listStoreActivity(storeId: string): Promise<ActivityEntry[]> {
  return DEMO_ACTIVITY.filter((a) => a.storeId === storeId);
}

export async function listBrandVersions(storeId: string): Promise<BrandVersion[]> {
  return DEMO_BRAND_VERSIONS[storeId] ?? [];
}

export async function getDomainRecord(storeId: string): Promise<DomainRecord | null> {
  return DEMO_DOMAINS.find((d) => d.storeId === storeId) ?? null;
}

export async function getIntegrationDetail(storeId: string): Promise<IntegrationDetail | null> {
  return DEMO_INTEGRATIONS.find((i) => i.storeId === storeId) ?? null;
}

/** Confirmed and suggested competitors plus archived ones. */
export async function listStoreCompetitors(storeId: string): Promise<Competitor[]> {
  const active = await listCompetitors(storeId);
  return [...active, ...DEMO_ARCHIVED_COMPETITORS.filter((c) => c.storeId === storeId)];
}

export async function getStoreSetupSample(): Promise<StoreSetupSample> {
  return DEMO_SETUP_SAMPLE;
}
