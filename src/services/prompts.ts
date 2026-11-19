/**
 * Data access for the Prompt module. Reads demonstration data today; later these
 * functions will call the real prompt services. Per-prompt results are derived
 * from the shared response samples so they always agree with the registry.
 */
import {
  DEMO_TEMPLATES,
  PROMPT_EDITS,
  PROMPT_META,
  PROMPT_STATUS_EVENTS,
  buildSuggestionBatches,
  profileFor,
} from "@/demo/prompts";
import { formatDate, formatShortDate } from "@/lib/format";
import { SOURCE_LABEL, channelLabel } from "@/lib/labels";
import { getCurrentUser, getStore, listCompetitors, listProducts, listPromptGroups, listPromptsBase, listStoreChannels, storeIds } from "@/services/core";
import { listRunResponses, registry } from "@/services/records";
import type { AiChannel, PromptBase, PromptGroup, Store } from "@/types/core";
import type {
  ChannelOption,
  LastResult,
  LibraryData,
  LibraryPrompt,
  NewPromptData,
  PromptActivityItem,
  PromptDetailData,
  PromptRecord,
  PromptResults,
  PromptVersion,
  ResultCounts,
  ResultState,
  RunResult,
  StoreContext,
} from "@/types/prompts";
import type { ResponseSample } from "@/types/shared-records";

/**
 * Audits whose response samples count toward prompt results. runpro-pk leaves out the
 * 6-response verification audit (aud-003) and the unfinished audit (aud-004).
 */
const AUDIT_IDS: Record<string, string[]> = {
  "runpro-pk": ["aud-001", "aud-002"],
  "runpro-ae": ["aud-ae-001", "aud-ae-002", "aud-ae-003"],
};

const auditIdsFor = (storeId: string): string[] => AUDIT_IDS[storeId] ?? registry.audits(storeId).filter((a) => a.status !== "in_progress").map((a) => a.id);

const ZERO_COUNTS: ResultCounts = { mention: { n: 0, d: 0 }, recommendation: { n: 0, d: 0 }, failed: 0, requests: 0 };

function storeContext(store: Store): StoreContext {
  return { id: store.id, name: store.name, brandName: store.brandName, market: store.market, marketName: store.marketName, language: store.language, channelCount: store.channelIds.length };
}

function channelOptions(channels: AiChannel[]): ChannelOption[] {
  return channels.map((c) => ({ id: c.id, label: channelLabel(c), providerLabel: c.providerLabel, tone: c.tone }));
}

function toRecord(base: PromptBase, store: Store): PromptRecord {
  const meta = PROMPT_META[base.id];
  return {
    ...base,
    market: store.market,
    language: store.language,
    productIds: meta?.productIds ?? [],
    createdAt: meta?.createdAt ?? base.updatedAt,
    createdBy: meta?.createdBy ?? "Sana Iqbal",
  };
}

async function listRecords(storeId: string): Promise<PromptRecord[]> {
  const store = await getStore(storeId);
  if (!store) return [];
  const base = await listPromptsBase(storeId);
  return base.map((p) => toRecord(p, store));
}

async function listGroups(storeId: string): Promise<PromptGroup[]> {
  return listPromptGroups(storeId);
}

/** All {storeId, promptId} pairs, for generateStaticParams. */
export async function promptStaticParams(): Promise<{ storeId: string; promptId: string }[]> {
  const pairs: { storeId: string; promptId: string }[] = [];
  for (const { storeId } of storeIds()) {
    for (const prompt of await listRecords(storeId)) pairs.push({ storeId, promptId: prompt.id });
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Results derived from response samples
// ---------------------------------------------------------------------------

function counts(responses: ResponseSample[]): ResultCounts {
  const ok = responses.filter((r) => r.status === "succeeded");
  return {
    mention: { n: ok.filter((r) => r.brandMentioned === "yes").length, d: ok.length },
    recommendation: { n: ok.filter((r) => r.outcome === "recommended").length, d: ok.length },
    failed: responses.length - ok.length,
    requests: responses.length,
  };
}

function stateOf(c: ResultCounts, recommended: number): ResultState {
  if (c.requests === 0) return "na";
  if (c.mention.d === 0) return "failed";
  if (recommended > 0) return "recommended";
  return c.mention.n > 0 ? "mentioned" : "absent";
}

type StoreResponses = { monitoring: Map<string, ResponseSample[]>; audits: Map<string, ResponseSample[]> };

async function loadResponses(storeId: string): Promise<StoreResponses> {
  const monitoring = new Map<string, ResponseSample[]>();
  const audits = new Map<string, ResponseSample[]>();
  for (const run of registry.runs(storeId)) monitoring.set(run.id, await listRunResponses(storeId, run.id));
  for (const id of auditIdsFor(storeId)) audits.set(id, await listRunResponses(storeId, id));
  return { monitoring, audits };
}

function lastResultsFor(promptId: string, channels: AiChannel[], storeId: string, responses: StoreResponses): LastResult[] {
  const latestRunId = registry.runs(storeId).at(-1)?.id;
  const latest = latestRunId ? (responses.monitoring.get(latestRunId) ?? []).filter((r) => r.promptId === promptId) : [];
  return channels.map<LastResult>((channel) => {
    const own = latest.filter((r) => r.channelId === channel.id);
    const c = counts(own);
    return { channelId: channel.id, label: channel.providerLabel, state: stateOf(c, c.recommendation.n), mentioned: c.mention.n, samples: c.mention.d, failed: c.failed };
  });
}

export async function getLibrary(storeId: string): Promise<LibraryData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [records, groups, channels, responses] = await Promise.all([listRecords(storeId), listGroups(storeId), listStoreChannels(storeId), loadResponses(storeId)]);
  const prompts = records.map<LibraryPrompt>((p) => ({ ...p, lastResults: lastResultsFor(p.id, channels, storeId, responses) }));
  return { store: storeContext(store), prompts, groups, channels: channelOptions(channels) };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

function buildVersions(prompt: PromptRecord, responses: StoreResponses): PromptVersion[] {
  const used = new Map<number, Set<string>>();
  const note = (version: number, runId: string) => used.set(version, (used.get(version) ?? new Set()).add(runId));
  for (const group of [responses.monitoring, responses.audits]) {
    for (const [runId, list] of group) for (const r of list) if (r.promptId === prompt.id) note(r.promptVersion, runId);
  }

  const edits = PROMPT_EDITS[prompt.id] ?? [{ version: 1, text: prompt.text, changedBy: prompt.createdBy, changedAt: prompt.createdAt, note: null }];
  return edits
    .map<PromptVersion>((v) => ({ ...v, runs: used.get(v.version)?.size ?? 0 }))
    .sort((a, b) => b.version - a.version);
}

function buildActivity(prompt: PromptRecord, versions: PromptVersion[]): PromptActivityItem[] {
  const meta = PROMPT_META[prompt.id];
  const items: PromptActivityItem[] = [
    {
      id: `${prompt.id}-created`,
      at: prompt.createdAt,
      actor: prompt.createdBy,
      title: prompt.source === "manual" ? "Created" : `Added · ${SOURCE_LABEL[prompt.source]}`,
      kind: "created",
    },
  ];
  if (meta?.activatedAt) items.push({ id: `${prompt.id}-activated`, at: meta.activatedAt, actor: prompt.createdBy, title: "Activated", kind: "status" });
  for (const v of versions) {
    if (v.version > 1) items.push({ id: `${prompt.id}-v${v.version}`, at: v.changedAt, actor: v.changedBy, title: `Wording changed · v${v.version}`, detail: v.note ?? undefined, kind: "version" });
  }
  const statusEvent = PROMPT_STATUS_EVENTS[prompt.id];
  if (statusEvent) items.push({ id: `${prompt.id}-status`, at: statusEvent.at, actor: statusEvent.actor, title: statusEvent.title, kind: "status" });
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function buildResults(prompt: PromptRecord, channels: AiChannel[], responses: StoreResponses): PromptResults {
  const runs: RunResult[] = [];
  const all: ResponseSample[] = [];
  for (const run of registry.runs(prompt.storeId)) {
    const own = (responses.monitoring.get(run.id) ?? []).filter((r) => r.promptId === prompt.id);
    if (own.length === 0) continue;
    all.push(...own);
    const byChannel: Record<string, ResultCounts> = {};
    for (const channel of channels) byChannel[channel.id] = counts(own.filter((r) => r.channelId === channel.id));
    runs.push({ runId: run.id, date: run.scheduledFor, pooled: counts(own), byChannel });
  }
  const providers = channels.map((channel) => ({
    channelId: channel.id,
    label: channel.providerLabel,
    channelLabel: channelLabel(channel),
    ...counts(all.filter((r) => r.channelId === channel.id)),
  }));
  const auditResponses = [...responses.audits.values()].flat().filter((r) => r.promptId === prompt.id);
  const latest = [...all, ...auditResponses].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt) || b.id.localeCompare(a.id)).slice(0, 6);
  const period = runs.length ? `${formatShortDate(runs[0].date)} – ${formatDate(runs[runs.length - 1].date)}` : null;
  return { providers, pooled: runs.length ? counts(all) : ZERO_COUNTS, runs, latest, period };
}

export async function getPromptDetail(storeId: string, promptId: string): Promise<PromptDetailData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const records = await listRecords(storeId);
  const prompt = records.find((p) => p.id === promptId);
  if (!prompt) return null;
  const [groups, products, channels, responses, user] = await Promise.all([listGroups(storeId), listProducts(storeId), listStoreChannels(storeId), loadResponses(storeId), getCurrentUser()]);
  const versions = buildVersions(prompt, responses);
  return {
    store: storeContext(store),
    prompt,
    versions,
    activity: buildActivity(prompt, versions),
    results: buildResults(prompt, channels, responses),
    channels: channelOptions(channels),
    groups,
    products,
    existing: records.filter((p) => p.id !== prompt.id).map((p) => ({ id: p.id, text: p.text, status: p.status })),
    actor: user.name,
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function getNewPromptData(storeId: string): Promise<NewPromptData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [records, groups, products, channels, competitors] = await Promise.all([listRecords(storeId), listGroups(storeId), listProducts(storeId), listStoreChannels(storeId), listCompetitors(storeId)]);
  const profile = profileFor(storeId);
  const competitor = competitors.find((c) => c.status === "confirmed")?.name ?? "a leading brand";
  return {
    store: storeContext(store),
    groups,
    products,
    existing: records.map((p) => ({ id: p.id, text: p.text, status: p.status })),
    channels: channelOptions(channels),
    suggestionBatches: buildSuggestionBatches(profile, store.brandName, competitor, store.marketName),
    templates: DEMO_TEMPLATES,
    profile: { brand: store.brandName, category: profile.category, market: store.marketName, city: profile.city, competitor },
  };
}
