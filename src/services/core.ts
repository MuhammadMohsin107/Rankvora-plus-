/**
 * Data access for shared entities. Today it reads demonstration data; later
 * these functions will call the real application services. Screens only ever
 * import from here, so swapping the source needs no UI changes.
 */
import {
  DEMO_ALERTS,
  DEMO_CHANNELS,
  DEMO_COMPETITORS,
  DEMO_CURRENT_USER_ID,
  ALL_GROUPS,
  ALL_PROMPTS,
  DEMO_MEMBERS,
  DEMO_ORG,
  DEMO_PRODUCTS,
  DEMO_STORES,
  DEMO_USAGE,
} from "@/demo/shared";
import { registryFor } from "@/demo/registry";
import { DEMO_FINDINGS, buildRunResponses } from "@/demo/shared-records";
import { OPEN_FINDING_STATUSES, OPEN_TASK_STATUSES } from "@/lib/record-status";
import type {
  AiChannel,
  AlertHeadline,
  Competitor,
  Member,
  Organization,
  OrgUsage,
  ProductService,
  Rate,
  PromptBase,
  PromptGroup,
  Store,
} from "@/types/core";

export async function getOrganization(): Promise<Organization> {
  return DEMO_ORG;
}

export async function listMembers(): Promise<Member[]> {
  return DEMO_MEMBERS;
}

export async function getCurrentUser(): Promise<Member> {
  const user = DEMO_MEMBERS.find((m) => m.id === DEMO_CURRENT_USER_ID);
  if (!user) throw new Error("Current user missing");
  return user;
}

/**
 * Headline numbers for the store with full data come from the same registry and
 * generated responses every module uses, so the websites list, dashboard and detail
 * screens can never disagree.
 */
function ownedCitation(runId: string): Rate {
  const ok = buildRunResponses(runId).filter((r) => r.status === "succeeded" && r.citationSupport !== "not_supported");
  return { n: ok.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: ok.length };
}

function withComputedSummary(store: Store): Store {
  const reg = registryFor(store.id);
  if (!store.summary || reg.runs.length === 0) return store;
  const latest = reg.runs[reg.runs.length - 1];
  const previous = reg.runs.length > 1 ? reg.runs[reg.runs.length - 2] : latest;
  const nextRunAt = reg.schedules.filter((s) => s.status === "active" && s.nextRunAt).map((s) => s.nextRunAt as string).sort()[0] ?? null;
  return {
    ...store,
    summary: {
      ...store.summary,
      mention: latest.mention,
      mentionPrevious: previous.mention,
      recommendation: latest.recommendation,
      recommendationPrevious: previous.recommendation,
      ownedCitation: ownedCitation(latest.id),
      ownedCitationPrevious: ownedCitation(previous.id),
      openFindings: DEMO_FINDINGS.filter((f) => f.storeId === store.id && OPEN_FINDING_STATUSES.has(f.status)).length,
      pendingTasks: reg.tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status)).length,
      openAlerts: DEMO_ALERTS.filter((a) => a.storeId === store.id && !a.read).length,
      activePrompts: ALL_PROMPTS.filter((p) => p.storeId === store.id && p.status === "active").length,
      lastRunAt: latest.scheduledFor,
      nextRunAt,
    },
  };
}

export async function listStores(): Promise<Store[]> {
  return DEMO_STORES.map(withComputedSummary);
}

export async function getStore(storeId: string): Promise<Store | null> {
  const store = DEMO_STORES.find((s) => s.id === storeId);
  return store ? withComputedSummary(store) : null;
}

/** Ids used by generateStaticParams for store routes. */
export function storeIds(): { storeId: string }[] {
  return DEMO_STORES.map((s) => ({ storeId: s.id }));
}

export async function listChannels(): Promise<AiChannel[]> {
  return DEMO_CHANNELS;
}

export async function listStoreChannels(storeId: string): Promise<AiChannel[]> {
  const store = DEMO_STORES.find((s) => s.id === storeId);
  return DEMO_CHANNELS.filter((c) => store?.channelIds.includes(c.id));
}

export async function listCompetitors(storeId: string): Promise<Competitor[]> {
  return DEMO_COMPETITORS.filter((c) => c.storeId === storeId);
}

export async function listPromptGroups(storeId: string): Promise<PromptGroup[]> {
  return ALL_GROUPS.filter((g) => g.storeId === storeId);
}

export async function listPromptsBase(storeId: string): Promise<PromptBase[]> {
  return ALL_PROMPTS.filter((p) => p.storeId === storeId);
}

export async function listProducts(storeId: string): Promise<ProductService[]> {
  return DEMO_PRODUCTS.filter((p) => p.storeId === storeId);
}

export async function listAlertHeadlines(): Promise<AlertHeadline[]> {
  return DEMO_ALERTS;
}

export async function getOrgUsage(): Promise<OrgUsage> {
  return DEMO_USAGE;
}
