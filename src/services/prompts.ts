/**
 * Data access for the Prompt module. Reads demonstration data today; later these
 * functions will call the real prompt services. Per-prompt results are derived
 * from the shared response samples so they always agree with the registry.
 *
 * Every function works for any website id. Websites that only exist in this browser
 * (created through the Add website wizard) get an "unresolved" context and the client
 * fills in the website fields from the local demo state.
 */
import { DEMO_TEMPLATES, PROMPT_EDITS, PROMPT_META, PROMPT_STATUS_EVENTS, profileFor } from "@/demo/prompts";
import { formatDate, formatShortDate } from "@/lib/format";
import { SOURCE_LABEL, channelLabel } from "@/lib/labels";
import { getCurrentUser, getStore, listCompetitors, listProducts, listPromptGroups, listPromptsBase, listStoreChannels, listStores, storeIds } from "@/services/core";
import { listSchedules } from "@/services/monitoring";
import { listRunResponses, registry } from "@/services/records";
import type { AiChannel, PromptBase, PromptGroup, Store } from "@/types/core";
import type {
  ChannelOption,
  CitationSummary,
  CompetitorMention,
  LastResult,
  LibraryData,
  LibraryPrompt,
  NewPromptData,
  Observation,
  PromptActivityItem,
  PromptContext,
  PromptDetailData,
  PromptEvidence,
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
  // nutrition leaves out the 6-response verification audit (aud-nu-004), like runpro-pk.
  nutrition: ["aud-nu-001", "aud-nu-002", "aud-nu-003", "aud-nu-005"],
};

const auditIdsFor = (storeId: string): string[] => AUDIT_IDS[storeId] ?? registry.audits(storeId).filter((a) => a.status !== "in_progress").map((a) => a.id);

const ZERO_COUNTS: ResultCounts = { mention: { n: 0, d: 0 }, recommendation: { n: 0, d: 0 }, failed: 0, requests: 0 };
const EMPTY_RESULTS: PromptResults = { providers: [], pooled: ZERO_COUNTS, runs: [], latest: [], period: null };
const EMPTY_EVIDENCE: PromptEvidence = { lastObservation: null, competitors: [], citationResponses: 0, citations: [], schedules: [] };
const TOP_DOMAINS = 5;

function storeContext(store: Store): StoreContext {
  return { id: store.id, name: store.name, brandName: store.brandName, market: store.market, marketName: store.marketName, language: store.language, channelCount: store.channelIds.length, resolved: true };
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
// Context shared by library, detail and create screens
// ---------------------------------------------------------------------------

/** For a website the server does not know (created in this browser). The client fills in the real fields. */
function unresolvedContext(storeId: string, actor: string): PromptContext {
  return {
    store: { id: storeId, name: "Website", brandName: "", market: "", marketName: "", language: "en", channelCount: 0, resolved: false },
    channels: [],
    groups: [],
    products: [],
    existing: [],
    actor,
    otherWebsites: [],
    profile: { brand: "", category: "offerings", brands: "providers", market: "", city: "your city", competitor: "a leading brand", item: "offering", need: "everyday use" },
    templates: DEMO_TEMPLATES,
    competitors: [],
  };
}

export async function getPromptContext(storeId: string): Promise<PromptContext> {
  const user = await getCurrentUser();
  const store = await getStore(storeId);
  if (!store) return unresolvedContext(storeId, user.name);
  const [records, groups, products, channels, competitors, stores] = await Promise.all([
    listRecords(storeId),
    listGroups(storeId),
    listProducts(storeId),
    listStoreChannels(storeId),
    listCompetitors(storeId),
    listStores(),
  ]);
  const confirmed = competitors.filter((c) => c.status === "confirmed").map((c) => c.name);
  const profile = profileFor(storeId);
  const otherWebsites = await Promise.all(
    stores
      .filter((other) => other.id !== storeId)
      .map(async (other) => ({ id: other.id, name: other.name, texts: (await listPromptsBase(other.id)).map((p) => p.text) })),
  );
  return {
    store: storeContext(store),
    channels: channelOptions(channels),
    groups,
    products,
    existing: records.map((p) => ({ id: p.id, storeId, text: p.text, status: p.status })),
    actor: user.name,
    otherWebsites,
    profile: { brand: store.brandName, category: profile.category, brands: profile.brands ?? `${profile.category} brands`, market: store.marketName, city: profile.city, competitor: confirmed[0] ?? "a leading brand", item: profile.item, need: profile.need },
    templates: DEMO_TEMPLATES,
    competitors: confirmed,
  };
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

export async function getLibrary(storeId: string): Promise<LibraryData> {
  const store = await getStore(storeId);
  const context = await getPromptContext(storeId);
  if (!store) return { storeId, context, prompts: [], inLatestRun: 0 };
  const [records, channels, responses] = await Promise.all([listRecords(storeId), listStoreChannels(storeId), loadResponses(storeId)]);
  const prompts = records.map<LibraryPrompt>((p) => ({ ...p, lastResults: lastResultsFor(p.id, channels, storeId, responses) }));
  const latestRunId = registry.runs(storeId).at(-1)?.id;
  const inLatestRun = latestRunId ? new Set((responses.monitoring.get(latestRunId) ?? []).map((r) => r.promptId)).size : 0;
  return { storeId, context, prompts, inLatestRun };
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

function buildEvidence(prompt: PromptRecord, channels: AiChannel[], responses: StoreResponses, schedules: PromptEvidence["schedules"]): PromptEvidence {
  const own = [...[...responses.monitoring.values()].flat(), ...[...responses.audits.values()].flat()].filter((r) => r.promptId === prompt.id);
  const ok = own.filter((r) => r.status === "succeeded");

  const names = new Map<string, string>();
  for (const r of ok) for (const c of r.competitors) names.set(c.id, c.name);
  const competitors: CompetitorMention[] = [...names].map(([id, name]) => ({
    id,
    name,
    mentioned: { n: ok.filter((r) => r.competitors.some((c) => c.id === id && c.mentioned)).length, d: ok.length },
  }));
  competitors.sort((a, b) => b.mentioned.n - a.mentioned.n || a.name.localeCompare(b.name));

  const withCitations = ok.filter((r) => r.citationSupport === "returned");
  const byDomain = new Map<string, { source: CitationSummary["source"]; ids: Set<string> }>();
  for (const r of withCitations) {
    for (const c of r.citations) {
      const entry = byDomain.get(c.domain) ?? { source: c.source, ids: new Set<string>() };
      entry.ids.add(r.id);
      byDomain.set(c.domain, entry);
    }
  }
  const citations: CitationSummary[] = [...byDomain]
    .map(([domain, entry]) => ({ domain, source: entry.source, cited: { n: entry.ids.size, d: withCitations.length } }))
    .sort((a, b) => b.cited.n - a.cited.n || a.domain.localeCompare(b.domain))
    .slice(0, TOP_DOMAINS);

  const latest = [...own].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt) || b.id.localeCompare(a.id))[0];
  const lastObservation: Observation = latest
    ? { runId: latest.runId, kind: latest.runKind, at: latest.requestedAt, channelLabel: channels.find((c) => c.id === latest.channelId)?.providerLabel ?? latest.providerLabel }
    : null;
  return { lastObservation, competitors, citationResponses: withCitations.length, citations, schedules };
}

/** Detail for a prompt. `prompt` is null when the id is not in the static data (a prompt created in this browser). */
export async function getPromptDetail(storeId: string, promptId: string): Promise<PromptDetailData> {
  const context = await getPromptContext(storeId);
  const empty: PromptDetailData = { storeId, context, prompt: null, versions: [], activity: [], results: EMPTY_RESULTS, evidence: EMPTY_EVIDENCE };
  const store = await getStore(storeId);
  if (!store) return empty;
  const records = await listRecords(storeId);
  const prompt = records.find((p) => p.id === promptId);
  if (!prompt) return empty;
  const [channels, responses, schedules] = await Promise.all([listStoreChannels(storeId), loadResponses(storeId), listSchedules(storeId)]);
  const versions = buildVersions(prompt, responses);
  const onSchedules = schedules
    .filter((sch) => sch.config.promptIds.includes(prompt.id))
    .map((sch) => ({ id: sch.id, name: sch.name, frequency: sch.frequencyLabel, status: sch.status }));
  return {
    storeId,
    context,
    prompt,
    versions,
    activity: buildActivity(prompt, versions),
    results: buildResults(prompt, channels, responses),
    evidence: buildEvidence(prompt, channels, responses, onSchedules),
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function getNewPromptData(storeId: string): Promise<NewPromptData> {
  return { storeId, context: await getPromptContext(storeId) };
}
