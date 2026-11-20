/**
 * Data access for organization and store settings. Reads demonstration data
 * today; later these functions will call the real application services.
 */
import {
  DEMO_ACTIVITY,
  DEMO_ARCHIVED_COMPETITORS,
  DEMO_BILLING,
  DEMO_BRAND_KNOWLEDGE,
  DEMO_BRAND_VERSIONS,
  DEMO_CONNECTIONS,
  DEMO_CONNECTORS,
  DEMO_DOMAINS,
  DEMO_INTEGRATIONS,
  DEMO_INVITES,
  DEMO_MEMBER_ACCESS,
  DEMO_ORG_GENERAL,
  DEMO_ORG_NOTIFICATIONS,
  DEMO_PROVIDERS,
  DEMO_SETUP_SAMPLE,
  DEMO_STORE_NOTIFICATIONS,
  DEMO_TEAM_ACTIVITY,
  NOTIFICATION_EVENTS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "@/demo/settings";
import { WEBSITE_BASES } from "@/demo/audit";
import { registryFor } from "@/demo/registry";
import { getOrganization, listChannels, listCompetitors, listMembers, listPromptsBase, listStores } from "@/services/core";
import type { Competitor } from "@/types/core";
import type {
  ActivityEntry,
  BillingBase,
  BrandKnowledgeBase,
  BillingPlan,
  BillingState,
  BrandVersion,
  ConnectionState,
  ConnectorBase,
  SourcePage,
  DomainRecord,
  IntegrationDetail,
  NotificationEvent,
  NotificationPrefs,
  OrgGeneral,
  PendingInvite,
  Permission,
  ProviderConnection,
  RolePermissions,
  StoreNotificationOverride,
  StoreSetupSample,
  TeamMember,
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

/** Organization profile defaults (name and time zone come from the organization record). */
export async function getOrgGeneral(): Promise<OrgGeneral> {
  const org = await getOrganization();
  return { name: org.name, timezone: org.timezone, ...DEMO_ORG_GENERAL };
}

/** Members and pending invites as one Team list. Owners and admins see every website. */
export async function listTeam(): Promise<TeamMember[]> {
  const members = await listMembers();
  const active: TeamMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    initials: m.initials,
    lastActive: m.lastActive,
    status: "active",
    invitedAt: null,
    invitedBy: null,
    websiteIds: m.role === "owner" || m.role === "admin" ? null : (DEMO_MEMBER_ACCESS[m.id] ?? null),
  }));
  const invited: TeamMember[] = DEMO_INVITES.map((i) => ({
    id: i.id,
    name: i.email,
    email: i.email,
    role: i.role,
    initials: i.email.slice(0, 2).toUpperCase(),
    lastActive: null,
    status: "invited",
    invitedAt: i.invitedAt,
    invitedBy: i.invitedBy,
    websiteIds: DEMO_MEMBER_ACCESS[i.id] ?? null,
  }));
  return [...active, ...invited];
}

/** Billing demonstration data. Request counts come from the demo usage; websites without usage count as zero. */
export async function getBillingBase(): Promise<BillingBase> {
  const stores = await listStores();
  const usageSeeds = stores.map((store) => ({ websiteId: store.id, requests: DEMO_BILLING.usageSeeds.find((u) => u.websiteId === store.id)?.requests ?? {} }));
  return { ...DEMO_BILLING, usageSeeds };
}

/** Prompt id, website and status only: enough to count active prompts after local changes. */
export async function listPromptCountRows(): Promise<{ id: string; storeId: string; status: string }[]> {
  const stores = await listStores();
  const lists = await Promise.all(stores.map((store) => listPromptsBase(store.id)));
  return lists.flat().map((p) => ({ id: p.id, storeId: p.storeId, status: p.status }));
}

export async function listNotificationOverrides(): Promise<StoreNotificationOverride[]> {
  return DEMO_STORE_NOTIFICATIONS;
}

export async function listTeamActivity(): Promise<{ id: string; at: string; actor: string; title: string }[]> {
  return DEMO_TEAM_ACTIVITY;
}

/** Plans and the starting billing state, for screens that only need the seat limit. */
export async function getPlanSnapshot(): Promise<{ plans: BillingPlan[]; state: BillingState }> {
  return { plans: DEMO_BILLING.plans, state: DEMO_BILLING.state };
}

export async function listConnectors(): Promise<ConnectorBase[]> {
  return DEMO_CONNECTORS;
}

export async function getConnections(): Promise<Record<string, ConnectionState>> {
  return DEMO_CONNECTIONS;
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

/** Page types that make good source pages for brand context (skips plain pages and collections beyond a few). */
const SOURCE_PAGE_TYPES = new Set(["home", "product", "guide", "policy"]);

/**
 * Starting point for the Brand knowledge tab: authored facts and FAQs, key pages and AI crawler access
 * taken from the latest completed audit of the same website (so it never disagrees with Audit).
 * Websites without an audit return empty page and crawler lists.
 */
export async function getBrandKnowledgeBase(storeId: string): Promise<BrandKnowledgeBase> {
  const seed = DEMO_BRAND_KNOWLEDGE[storeId] ?? { facts: [], faqs: [], contentContext: "" };
  const base = WEBSITE_BASES[storeId];
  const audit = registryFor(storeId).audits.find((a) => a.status !== "in_progress" && a.lanes.includes("website_readiness")) ?? null;
  const sourcePages: SourcePage[] = base
    ? base.pages
        .filter((p) => SOURCE_PAGE_TYPES.has(p.type) && p.status === 200)
        .slice(0, 6)
        .map((p) => ({ id: `src-${p.id}`, url: p.url, title: p.title ?? p.path, type: p.type, confirmed: true }))
    : [];
  return {
    ...seed,
    sourcePages,
    crawlers: base ? base.crawlers.map((c) => ({ id: c.id, name: c.name, purpose: c.purpose, allowed: c.allowed, findingId: c.findingId })) : [],
    auditId: base && audit ? audit.id : null,
    scannedAt: base && audit ? (audit.completedAt ?? audit.startedAt) : null,
  };
}
