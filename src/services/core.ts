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
  DEMO_GROUPS,
  DEMO_MEMBERS,
  DEMO_ORG,
  DEMO_PRODUCTS,
  DEMO_PROMPTS,
  DEMO_STORES,
  DEMO_USAGE,
} from "@/demo/shared";
import { REGISTRY_RUNS } from "@/demo/registry";
import { buildRunResponses } from "@/demo/shared-records";
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
 * generated responses every module uses, so the portfolio, dashboard and detail
 * screens can never disagree.
 */
function ownedCitation(runId: string): Rate {
  const ok = buildRunResponses(runId).filter((r) => r.status === "succeeded" && r.citationSupport !== "not_supported");
  return { n: ok.filter((r) => r.citations.some((c) => c.source === "owned")).length, d: ok.length };
}

function withComputedSummary(store: Store): Store {
  if (store.id !== "runpro-pk" || !store.summary) return store;
  const latest = REGISTRY_RUNS[REGISTRY_RUNS.length - 1];
  const previous = REGISTRY_RUNS[REGISTRY_RUNS.length - 2];
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
  return DEMO_GROUPS.filter((g) => g.storeId === storeId);
}

export async function listPromptsBase(storeId: string): Promise<PromptBase[]> {
  return DEMO_PROMPTS.filter((p) => p.storeId === storeId);
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
