/**
 * Data access and orchestration for Comparison. It loads the generated response
 * samples for each source (audit or monitoring run), builds the two sides and
 * runs the deterministic engine in src/features/comparison/engine.ts.
 * Pure engine functions live there so the browser can run the same preview.
 */
import { COMPARISON_LIMITATIONS, COMPARISON_TYPES, COMPLETED_TASK_STATES, comparisonConfigFor, METHODOLOGY, TYPE_LABEL } from "@/demo/comparison";
import { buildTitle, decodeDefinition, isLocalComparisonId, statusForVerdict } from "@/features/comparison/definition";
import { compareSides, type EngineContext } from "@/features/comparison/engine";
import { resolveSide } from "@/features/comparison/sides";
import { DEMO_NOW } from "@/lib/format";
import { channelLabel } from "@/lib/labels";
import { listChannels, listCompetitors, listPromptGroups, listPromptsBase, getStore, storeIds } from "@/services/core";
import { getTaskDetail } from "@/services/fixes";
import { listRunResponses, registry, getResponse } from "@/services/records";
import type {
  ComparisonDefinition,
  ComparisonDetail,
  ComparisonRecord,
  FixTimelineItem,
  PairRowWithResponses,
  SlotCore,
  SlotRow,
  SnapshotRef,
  WizardCatalog,
  WizardData,
} from "@/types/comparison";
import type { ResponseSample } from "@/types/shared-records";

export { COMPARISON_LIMITATIONS, COMPARISON_TYPES, METHODOLOGY, TYPE_LABEL };

export function wizardCatalog(storeId: string): WizardCatalog {
  const config = comparisonConfigFor(storeId);
  return {
    types: COMPARISON_TYPES,
    presets: config.presets,
    aggregation: METHODOLOGY.aggregation,
    windows: config.windows,
    matching: METHODOLOGY.matching,
  };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

function recordsFor(storeId: string): ComparisonRecord[] {
  const reports = registry.reports(storeId);
  return registry.comparisons(storeId).map((c) => ({
    ...c,
    storeId,
    filters: {},
    aggregation: "matched_slot_macro" as const,
    reportId: reports.find((r) => r.type === "comparison" && r.sourceId === c.id)?.id ?? null,
    archived: false,
    matched: null,
  }));
}

/** Seeded comparisons with their matched coverage (computed by the engine). */
export async function listComparisons(storeId: string): Promise<ComparisonRecord[]> {
  return Promise.all(
    recordsFor(storeId).map(async (record) => {
      const detail = await getComparisonDetail(storeId, record.id);
      return detail ? { ...record, matched: detail.result.coverage } : record;
    }),
  );
}

/** A seeded record, or null. Comparisons created in the wizard are rebuilt from their id by getComparisonDetail. */
export async function getComparisonRecord(storeId: string, comparisonId: string): Promise<ComparisonRecord | null> {
  return recordsFor(storeId).find((c) => c.id === comparisonId) ?? null;
}

/** All {storeId, comparisonId} pairs, for generateStaticParams. */
export async function comparisonStaticParams(): Promise<{ storeId: string; comparisonId: string }[]> {
  return storeIds().flatMap(({ storeId }) => recordsFor(storeId).map((c) => ({ storeId, comparisonId: c.id })));
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const rowCache = new Map<string, SlotRow[]>();

function toRow(r: ResponseSample, groupId: string | null, topic: string | null): SlotRow {
  const mentioned = r.status === "succeeded" && r.brandMentioned === "yes";
  return {
    storeId: r.storeId,
    runId: r.runId,
    promptId: r.promptId,
    promptVersion: r.promptVersion,
    groupId,
    topic,
    channelId: r.channelId,
    model: r.model,
    sample: r.sample,
    market: r.market,
    language: r.language,
    searchMode: r.searchMode,
    ok: r.status === "succeeded",
    mentioned,
    analysisVersion: r.analysisVersion,
    responseId: r.id,
    outcome: r.outcome,
    recommended: r.status === "succeeded" && r.recommendation === "recommended",
    sentiment: r.sentiment,
    citationSupport: r.citationSupport,
    ownedCited: r.citations.some((c) => c.source === "owned"),
    domains: [...new Set(r.citations.map((c) => c.domain))],
    urls: r.citations.map((c) => ({ url: c.url, title: c.title, domain: c.domain })),
    competitors: r.competitors.filter((c) => c.mentioned).map((c) => c.name),
    quote: r.evidenceQuote,
    failureClass: r.failure?.class ?? null,
    requestedAt: r.requestedAt,
  };
}

async function sourceRows(storeId: string, sourceId: string): Promise<SlotRow[]> {
  const cacheKey = `${storeId}|${sourceId}`;
  const cached = rowCache.get(cacheKey);
  if (cached) return cached;
  const [responses, prompts] = await Promise.all([listRunResponses(storeId, sourceId), listPromptsBase(storeId)]);
  const meta = new Map(prompts.map((p) => [p.id, p]));
  const rows = responses.map((r) => toRow(r, meta.get(r.promptId)?.groupId ?? null, meta.get(r.promptId)?.topic ?? null));
  rowCache.set(cacheKey, rows);
  return rows;
}

export async function getSourceRows(storeId: string, sourceId: string): Promise<SlotRow[]> {
  return sourceRows(storeId, sourceId);
}

export function toCore(row: SlotRow): SlotCore {
  return {
    storeId: row.storeId,
    runId: row.runId,
    promptId: row.promptId,
    promptVersion: row.promptVersion,
    groupId: row.groupId,
    topic: row.topic,
    channelId: row.channelId,
    model: row.model,
    sample: row.sample,
    market: row.market,
    language: row.language,
    searchMode: row.searchMode,
    ok: row.ok,
    mentioned: row.mentioned,
    analysisVersion: row.analysisVersion,
  };
}

export async function listSnapshots(storeId: string): Promise<SnapshotRef[]> {
  const audits: SnapshotRef[] = registry
    .audits(storeId)
    .filter((a) => a.snapshotId)
    .map((a) => ({ snapshotId: a.snapshotId!, sourceId: a.id, kind: "audit", title: a.title, date: a.startedAt }));
  const runs: SnapshotRef[] = registry
    .runs(storeId)
    .map((r) => ({ snapshotId: r.snapshotId, sourceId: r.id, kind: "monitoring", title: `Monitoring run ${r.id.match(/(\d+)$/)?.[1] ?? r.id}`, date: r.scheduledFor }));
  return [...audits, ...runs].sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function loadSide(storeId: string, reference: string, brand: string, snapshots: SnapshotRef[]) {
  const rowsBySource: Record<string, SlotRow[]> = {};
  await Promise.all(
    snapshots.map(async (snap) => {
      rowsBySource[snap.sourceId] = await sourceRows(storeId, snap.sourceId);
    }),
  );
  return resolveSide(reference, snapshots, rowsBySource, brand);
}

// ---------------------------------------------------------------------------
// Engine context
// ---------------------------------------------------------------------------

export async function engineContext(storeId: string): Promise<EngineContext> {
  const config = comparisonConfigFor(storeId);
  const [channels, prompts, competitors] = await Promise.all([listChannels(), listPromptsBase(storeId), listCompetitors(storeId)]);
  return {
    channelLabels: Object.fromEntries(channels.map((c) => [c.id, channelLabel(c)])),
    promptText: Object.fromEntries(prompts.map((p) => [p.id, p.text])),
    competitors: competitors.filter((c) => c.status === "confirmed").map((c) => ({ id: c.id, name: c.name })),
    ownedDomains: config.ownedDomains,
    competitorDomains: config.competitorDomains,
  };
}

// ---------------------------------------------------------------------------
// Fixes timeline context
// ---------------------------------------------------------------------------

const sourceIdIn = (href: string | undefined) => href?.match(/(aud-[\w-]+|run-[\w-]+)/)?.[1] ?? null;

/**
 * Tasks placed on the timeline by when they were completed (applied, published or marked complete).
 * A task that is not completed is placed by its due date and says so. Context only, never a cause.
 */
async function fixesBetween(storeId: string, from: string, to: string): Promise<FixTimelineItem[]> {
  const runs = registry.runs(storeId);
  const items = await Promise.all(
    registry.tasks(storeId).map(async (t): Promise<FixTimelineItem | null> => {
      const detail = await getTaskDetail(storeId, t.id);
      const exec = detail?.execution;
      const completed = COMPLETED_TASK_STATES.includes(t.status);
      const completedAt = completed ? (exec?.completedAt ?? exec?.publishedAt ?? exec?.appliedAt ?? null) : null;
      const placedAt = completedAt ?? t.dueAt;
      if (!placedAt || placedAt < from || placedAt > to) return null;
      const before = [...runs].filter((r) => r.scheduledFor <= placedAt).pop();
      const after = runs.find((r) => r.scheduledFor > placedAt);
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        findingId: t.findingId,
        findingTitle: detail?.task.findingTitle ?? t.findingId,
        dueAt: t.dueAt,
        completedAt,
        placedAt,
        placedBy: completedAt ? "completed" : "due",
        verificationId: sourceIdIn(detail?.verification.outcome?.sourceHref),
        completed,
        before: before ? { runId: before.id, date: before.scheduledFor, rate: before.mention } : null,
        after: after ? { runId: after.id, date: after.scheduledFor, rate: after.mention } : null,
      };
    }),
  );
  return items.filter((i): i is FixTimelineItem => i !== null).sort((a, b) => (a.placedAt < b.placedAt ? -1 : a.placedAt > b.placedAt ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

const detailCache = new Map<string, ComparisonDetail>();

/** Record for an id that is not seeded: rebuilt from the definition inside the id. Local data (title, author, time, archive) overlays it in the browser. */
function recordFromDefinition(storeId: string, id: string, def: ComparisonDefinition, snapshots: SnapshotRef[]): ComparisonRecord {
  return {
    id,
    storeId,
    title: buildTitle(def, snapshots),
    type: def.type,
    baseline: def.baseline,
    current: def.current,
    filters: def.filters,
    aggregation: def.aggregation,
    ...(def.taskId ? { taskId: def.taskId } : {}),
    status: "completed",
    comparability: "insufficient_data",
    createdAt: DEMO_NOW,
    createdBy: "You",
    methodologyVersion: METHODOLOGY.version,
    reportId: null,
    archived: false,
    matched: null,
    simulated: true,
  };
}

export async function getComparisonDetail(storeId: string, comparisonId: string): Promise<ComparisonDetail | null> {
  const cacheKey = `${storeId}|${comparisonId}`;
  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  const store = await getStore(storeId);
  if (!store) return null;
  const snapshots = await listSnapshots(storeId);
  let record = await getComparisonRecord(storeId, comparisonId);
  if (!record && isLocalComparisonId(comparisonId)) {
    const def = decodeDefinition(comparisonId);
    if (def) record = recordFromDefinition(storeId, comparisonId, def, snapshots);
  }
  if (!record) return null;

  const [baseline, current, ctx] = await Promise.all([loadSide(storeId, record.baseline, store.brandName, snapshots), loadSide(storeId, record.current, store.brandName, snapshots), engineContext(storeId)]);
  if (!baseline || !current) return null;

  const result = compareSides(baseline.info, current.info, baseline.rows, current.rows, record.filters, record.aggregation, ctx);
  const rangeFrom = baseline.info.from < current.info.from ? baseline.info.from : current.info.from;
  const rangeTo = baseline.info.to > current.info.to ? baseline.info.to : current.info.to;
  const finished: ComparisonRecord = record.simulated
    ? { ...record, comparability: result.verdict, status: statusForVerdict(result.verdict), matched: result.coverage }
    : { ...record, matched: result.coverage };

  const detail: ComparisonDetail = {
    record: finished,
    baseline: baseline.info,
    current: current.info,
    filters: record.filters,
    result,
    fixes: await fixesBetween(storeId, rangeFrom, rangeTo),
    rangeFrom,
    rangeTo,
  };
  detailCache.set(cacheKey, detail);
  return detail;
}

/** Matched rows with the latest response on each side, for the Prompts tab. */
export async function getPromptRows(storeId: string, comparisonId: string): Promise<PairRowWithResponses[]> {
  const detail = await getComparisonDetail(storeId, comparisonId);
  if (!detail) return [];
  return Promise.all(
    detail.result.matchedRows.map(async (row) => ({
      ...row,
      baselineResponse: row.baseline.latestResponseId ? await getResponse(storeId, row.baseline.latestResponseId) : null,
      currentResponse: row.current.latestResponseId ? await getResponse(storeId, row.current.latestResponseId) : null,
    })),
  );
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export async function getWizardData(storeId: string): Promise<WizardData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const snapshots = await listSnapshots(storeId);
  const [channels, prompts, groups, competitors] = await Promise.all([listChannels(), listPromptsBase(storeId), listPromptGroups(storeId), listCompetitors(storeId)]);
  const cores: Record<string, SlotCore[]> = {};
  const domains = new Set<string>();
  for (const snap of snapshots) {
    const rows = await sourceRows(storeId, snap.sourceId);
    cores[snap.sourceId] = rows.map(toCore);
    for (const r of rows) for (const d of r.domains) domains.add(d);
  }
  const usedPrompts = new Set(Object.values(cores).flat().map((r) => r.promptId));
  const all = Object.values(cores).flat();
  const usedPromptRows = prompts.filter((p) => usedPrompts.has(p.id));
  const tasks: WizardData["tasks"] = [];
  for (const t of registry.tasks(storeId)) {
    if (!COMPLETED_TASK_STATES.includes(t.status)) continue;
    const exec = (await getTaskDetail(storeId, t.id))?.execution;
    const completedAt = exec?.completedAt ?? exec?.publishedAt ?? exec?.appliedAt ?? null;
    if (completedAt) tasks.push({ id: t.id, title: t.title, completedAt });
  }
  return {
    snapshots,
    cores,
    prompts: usedPromptRows.map((p) => ({ id: p.id, text: p.text, groupId: p.groupId, topic: p.topic ?? null })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    topics: [...new Set(usedPromptRows.map((p) => p.topic).filter((t): t is string => Boolean(t)))].sort(),
    channels: channels
      .filter((c) => all.some((r) => r.channelId === c.id))
      .map((c) => ({ id: c.id, label: channelLabel(c), provider: c.provider, providerLabel: c.providerLabel, model: c.model })),
    tasks: tasks.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1)),
    competitors: competitors.filter((c) => c.status === "confirmed").map((c) => ({ id: c.id, name: c.name })),
    domains: [...domains].sort(),
    markets: [...new Set(all.map((r) => r.market))].sort(),
    languages: [...new Set(all.map((r) => r.language))].sort(),
    registry: recordsFor(storeId).map((c) => ({ id: c.id, baseline: c.baseline, current: c.current })),
    brand: store.brandName,
  };
}
