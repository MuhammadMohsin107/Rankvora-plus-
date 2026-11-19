/**
 * Data access and orchestration for Comparison. It loads the generated response
 * samples for each source (audit or monitoring run), builds the two sides and
 * runs the deterministic engine in src/features/comparison/engine.ts.
 * Pure engine functions live there so the browser can run the same preview.
 */
import {
  COMPARISON_LIMITATIONS,
  COMPARISON_TYPES,
  COMPETITOR_DOMAINS,
  COMPLETED_TASK_STATES,
  METHODOLOGY,
  OWNED_DOMAINS,
  TYPE_DEFAULT_TARGET,
  TYPE_LABEL,
  TYPE_PRESETS,
  WINDOW_PRESETS,
} from "@/demo/comparison";
import { RP } from "@/demo/registry";
import { compareSides, type EngineContext } from "@/features/comparison/engine";
import { resolveSide } from "@/features/comparison/sides";
import { channelLabel } from "@/lib/labels";
import { listChannels, listCompetitors, listPromptGroups, listPromptsBase, getStore, storeIds } from "@/services/core";
import { listRunResponses, registry, getResponse } from "@/services/records";
import type {
  ComparisonDetail,
  ComparisonFilters,
  ComparisonRecord,
  ComparisonType,
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

export function wizardCatalog(): WizardCatalog {
  return {
    types: COMPARISON_TYPES,
    presets: TYPE_PRESETS,
    defaultTargets: TYPE_DEFAULT_TARGET,
    aggregation: METHODOLOGY.aggregation,
    windows: WINDOW_PRESETS,
    matching: METHODOLOGY.matching,
  };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

function recordsFor(storeId: string): ComparisonRecord[] {
  if (storeId !== RP) return [];
  const reports = registry.reports();
  return registry.comparisons().map((c) => ({
    ...c,
    reportId: reports.find((r) => r.type === "comparison" && r.sourceId === c.id)?.id ?? null,
  }));
}

export async function listComparisons(storeId: string): Promise<ComparisonRecord[]> {
  return recordsFor(storeId);
}

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

function toRow(r: ResponseSample, groupId: string | null): SlotRow {
  const mentioned = r.status === "succeeded" && r.brandMentioned === "yes";
  return {
    storeId: r.storeId,
    runId: r.runId,
    promptId: r.promptId,
    promptVersion: r.promptVersion,
    groupId,
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
  const group = new Map(prompts.map((p) => [p.id, p.groupId]));
  const rows = responses.map((r) => toRow(r, group.get(r.promptId) ?? null));
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
  if (storeId !== RP) return [];
  const audits: SnapshotRef[] = registry
    .audits()
    .filter((a) => a.snapshotId)
    .map((a) => ({ snapshotId: a.snapshotId!, sourceId: a.id, kind: "audit", title: a.title, date: a.startedAt }));
  const runs: SnapshotRef[] = registry.runs().map((r) => ({ snapshotId: r.snapshotId, sourceId: r.id, kind: "monitoring", title: `Monitoring run ${r.id.slice(4)}`, date: r.scheduledFor }));
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
  const [channels, prompts, competitors] = await Promise.all([listChannels(), listPromptsBase(storeId), listCompetitors(storeId)]);
  return {
    channelLabels: Object.fromEntries(channels.map((c) => [c.id, channelLabel(c)])),
    promptText: Object.fromEntries(prompts.map((p) => [p.id, p.text])),
    competitors: competitors.filter((c) => c.status === "confirmed").map((c) => ({ id: c.id, name: c.name })),
    ownedDomains: OWNED_DOMAINS,
    competitorDomains: COMPETITOR_DOMAINS,
  };
}

// ---------------------------------------------------------------------------
// Fixes timeline context
// ---------------------------------------------------------------------------

function fixesBetween(from: string, to: string): FixTimelineItem[] {
  const runs = registry.runs();
  return registry
    .tasks()
    .filter((t) => t.dueAt && t.dueAt >= from && t.dueAt <= to)
    .sort((a, b) => (a.dueAt! < b.dueAt! ? -1 : 1))
    .map((t) => {
      const before = [...runs].filter((r) => r.scheduledFor <= t.dueAt!).pop();
      const after = runs.find((r) => r.scheduledFor > t.dueAt!);
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt,
        completed: COMPLETED_TASK_STATES.includes(t.status),
        before: before ? { runId: before.id, date: before.scheduledFor, rate: before.mention } : null,
        after: after ? { runId: after.id, date: after.scheduledFor, rate: after.mention } : null,
      };
    });
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

const detailCache = new Map<string, ComparisonDetail>();

export async function getComparisonDetail(storeId: string, comparisonId: string): Promise<ComparisonDetail | null> {
  const cacheKey = `${storeId}|${comparisonId}`;
  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  const [record, store] = await Promise.all([getComparisonRecord(storeId, comparisonId), getStore(storeId)]);
  if (!record || !store) return null;
  const snapshots = await listSnapshots(storeId);
  const [baseline, current, ctx] = await Promise.all([loadSide(storeId, record.baseline, store.brandName, snapshots), loadSide(storeId, record.current, store.brandName, snapshots), engineContext(storeId)]);
  if (!baseline || !current) return null;

  const filters: ComparisonFilters = {};
  const result = compareSides(baseline.info, current.info, baseline.rows, current.rows, filters, "matched_slot_macro", ctx);
  const rangeFrom = baseline.info.from < current.info.from ? baseline.info.from : current.info.from;
  const rangeTo = baseline.info.to > current.info.to ? baseline.info.to : current.info.to;

  const detail: ComparisonDetail = {
    record,
    baseline: baseline.info,
    current: current.info,
    filters,
    result,
    fixes: fixesBetween(rangeFrom, rangeTo),
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
  return {
    snapshots,
    cores,
    prompts: prompts.filter((p) => usedPrompts.has(p.id)).map((p) => ({ id: p.id, text: p.text, groupId: p.groupId })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    channels: channels.filter((c) => all.some((r) => r.channelId === c.id)).map((c) => ({ id: c.id, label: channelLabel(c) })),
    competitors: competitors.filter((c) => c.status === "confirmed").map((c) => ({ id: c.id, name: c.name })),
    domains: [...domains].sort(),
    markets: [...new Set(all.map((r) => r.market))].sort(),
    languages: [...new Set(all.map((r) => r.language))].sort(),
    registry: recordsFor(storeId).map((c) => ({ id: c.id, type: c.type as ComparisonType, baseline: c.baseline, current: c.current })),
    brand: store.brandName,
  };
}

