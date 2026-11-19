/**
 * Data access for the Monitoring module. Reads demonstration data today
 * (src/demo/monitoring.ts + the shared registry and response generator) and
 * derives every job table, provider split, timeline point and usage number from
 * the generated responses, so totals always agree with the registry.
 * Later these functions will call the real application services.
 */
import {
  EVENT_SPECS,
  EXTRA_RUNS,
  EXTRA_SCHEDULES,
  SCHEDULE_DETAILS,
  TIMELINE_MARKERS,
  USAGE_CAPS,
  USAGE_PERIODS,
  scheduleVersionAt,
  type EventSpec,
  type SlotRef,
} from "@/demo/monitoring";
import { formatShortDate } from "@/lib/format";
import { channelLabel, SEARCH_MODE_LABEL, shortChannelLabel } from "@/lib/labels";
import {
  getOrgUsage,
  getStore,
  listAlertHeadlines,
  listMembers,
  listPromptGroups,
  listPromptsBase,
  listStoreChannels,
} from "@/services/core";
import { listRunResponses, registry } from "@/services/records";
import type { AiChannel, Rate } from "@/types/core";
import type {
  AlertState,
  ChannelInfo,
  EvidenceSide,
  EventCategory,
  EventType,
  FailureClass,
  MonitoringEvent,
  MonitoringHeaderData,
  MonitoringSchedule,
  ObservationRow,
  ProviderHealth,
  ProviderSplit,
  RunDetail,
  RunFailureGroup,
  RunJob,
  RunSummary,
  ScheduleConfig,
  ScheduleFormContext,
  ScheduleRow,
  TimelinePoint,
  UsageNumbers,
  UsagePeriod,
  UsageSummary,
} from "@/types/monitoring";
import type { ResponseSample } from "@/types/shared-records";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const toInfo = (c: AiChannel): ChannelInfo => ({
  id: c.id,
  providerLabel: c.providerLabel,
  model: c.model,
  label: channelLabel(c),
  short: shortChannelLabel(c),
  searchMode: SEARCH_MODE_LABEL[c.searchMode],
  supportsCitations: c.supportsCitations,
  tone: c.tone,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function frequencyLabel(config: ScheduleConfig): string {
  const f = config.frequency;
  switch (f.kind) {
    case "daily":
      return `Daily · ${config.localTime}`;
    case "every_n_days":
      return `Every ${f.everyDays ?? 2} days · ${config.localTime}`;
    case "weekly":
      return `Weekly · ${WEEKDAYS[f.weekday ?? 1]} ${config.localTime}`;
    case "monthly":
      return `Monthly · ${f.dayOfMonth ?? 1}${f.dayOfMonth === 1 ? "st" : "th"} ${config.localTime}`;
    default:
      return `Custom · ${f.cron ?? "cron"}`;
  }
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function isMentioned(r: ResponseSample) {
  return r.status === "succeeded" && r.brandMentioned === "yes";
}
function hasOwned(r: ResponseSample) {
  return r.status === "succeeded" && r.citations.some((c) => c.source === "owned");
}

const RUN_IDS = () => registry.runs().map((r) => r.id);

async function loadRunResponses(storeId: string, runIds: string[]): Promise<Map<string, ResponseSample[]>> {
  const entries = await Promise.all(runIds.map(async (id) => [id, await listRunResponses(storeId, id)] as const));
  return new Map(entries);
}

function runTiming(responses: ResponseSample[], scheduledFor: string): number | null {
  if (responses.length === 0) return null;
  const end = Math.max(...responses.map((r) => (r.completedAt ? Date.parse(r.completedAt) : Date.parse(r.requestedAt) + 60_000)));
  return Math.max(0, Math.round((end - Date.parse(scheduledFor)) / 1000));
}

function requestCount(responses: ResponseSample[]): number {
  return sum(responses.map((r) => (r.status === "failed" ? (r.failure?.attempts ?? 1) : 1)));
}

function usageOf(responses: ResponseSample[]) {
  const ok = responses.filter((r) => r.status === "succeeded");
  return {
    requests: requestCount(responses),
    samples: ok.length,
    inputTokens: sum(ok.map((r) => r.usage.inputTokens)),
    outputTokens: sum(ok.map((r) => r.usage.outputTokens)),
    searchCalls: sum(ok.map((r) => r.usage.searchCalls)),
  };
}

/** Average cost per planned job over the latest runs (estimate). */
function costPerJob(): number {
  const recent = registry.runs().slice(-4);
  return round(sum(recent.map((r) => r.costUsd)) / Math.max(1, sum(recent.map((r) => r.plannedJobs))), 4);
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

function allSchedules(): MonitoringSchedule[] {
  const fromRegistry = registry.schedules().map<MonitoringSchedule>((s) => {
    const detail = SCHEDULE_DETAILS[s.id];
    return {
      id: s.id,
      storeId: "runpro-pk",
      name: s.name,
      status: s.status,
      statusReason: detail.statusReason,
      createdAt: detail.createdAt,
      createdBy: detail.createdBy,
      nextRunAt: s.nextRunAt,
      currentVersion: detail.versions[0].version,
      versions: detail.versions,
    };
  });
  const extra = EXTRA_SCHEDULES.map<MonitoringSchedule>((s) => {
    const detail = SCHEDULE_DETAILS[s.id];
    return { ...s, statusReason: detail.statusReason, createdAt: detail.createdAt, createdBy: detail.createdBy, currentVersion: detail.versions[0].version, versions: detail.versions };
  });
  return [...fromRegistry, ...extra];
}

async function toRow(schedule: MonitoringSchedule, channels: AiChannel[], activeIds: Set<string> | null, lastRunAt: string | null): Promise<ScheduleRow> {
  const config = schedule.versions[0].config;
  const infos = channels.filter((c) => config.channelIds.includes(c.id)).map(toInfo);
  const activePromptCount = activeIds ? config.promptIds.filter((id) => activeIds.has(id)).length : config.promptCount;
  const jobsPerRun = activePromptCount * infos.length * config.samples;
  const jobsPerMonth = Math.round(jobsPerRun * config.frequency.runsPerMonth);
  return {
    id: schedule.id,
    name: schedule.name,
    status: schedule.status,
    statusReason: schedule.statusReason,
    frequencyLabel: frequencyLabel(config),
    timezone: config.timezone,
    promptCount: config.promptCount,
    activePromptCount,
    channels: infos,
    samples: config.samples,
    jobsPerRun,
    runsPerMonth: config.frequency.runsPerMonth,
    jobsPerMonth,
    costPerMonthUsd: round(jobsPerMonth * costPerJob()),
    nextRunAt: schedule.nextRunAt,
    lastRunAt,
    currentVersion: schedule.currentVersion,
    config,
    editable: activeIds !== null,
  };
}

export async function listSchedules(storeId: string): Promise<ScheduleRow[]> {
  const [channels, prompts] = await Promise.all([listStoreChannels(storeId), listPromptsBase(storeId)]);
  const activeIds = prompts.length > 0 ? new Set(prompts.filter((p) => p.status === "active").map((p) => p.id)) : null;
  const runs = await listRuns(storeId);
  const schedules = allSchedules().filter((s) => s.storeId === storeId);
  return Promise.all(
    schedules.map((s) => {
      const last = runs.find((r) => r.scheduleId === s.id);
      return toRow(s, channels, activeIds, last?.scheduledFor ?? null);
    }),
  );
}

export type ScheduleDetail = {
  row: ScheduleRow;
  createdAt: string;
  createdBy: string;
  versions: MonitoringSchedule["versions"];
  prompts: { id: string; text: string; status: string; pinned: number | null; version: number }[];
  recentRuns: RunSummary[];
  storeTimezone: string;
};

export async function getSchedule(storeId: string, scheduleId: string): Promise<ScheduleDetail | null> {
  const schedule = allSchedules().find((s) => s.storeId === storeId && s.id === scheduleId);
  if (!schedule) return null;
  const [rows, prompts, runs, store] = await Promise.all([listSchedules(storeId), listPromptsBase(storeId), listRuns(storeId), getStore(storeId)]);
  const row = rows.find((r) => r.id === scheduleId);
  if (!row || !store) return null;
  const config = schedule.versions[0].config;
  return {
    row,
    createdAt: schedule.createdAt,
    createdBy: schedule.createdBy,
    versions: schedule.versions,
    prompts: config.promptIds.map((id) => {
      const p = prompts.find((x) => x.id === id);
      return { id, text: p?.text ?? id, status: p?.status ?? "active", pinned: config.pinnedVersions[id] ?? null, version: p?.version ?? 1 };
    }),
    recentRuns: runs.filter((r) => r.scheduleId === scheduleId).slice(0, 5),
    storeTimezone: store.timezone,
  };
}

export function scheduleParams(): { storeId: string; scheduleId: string }[] {
  return allSchedules().map((s) => ({ storeId: s.storeId, scheduleId: s.id }));
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function listRuns(storeId: string): Promise<RunSummary[]> {
  const scheduleName = (id: string) => allSchedules().find((s) => s.id === id)?.name ?? id;
  const registryRuns = registry.runs().filter(() => storeId === "runpro-pk");
  const responses = await loadRunResponses(storeId, registryRuns.map((r) => r.id));
  const fromRegistry = registryRuns.map<RunSummary>((r) => {
    const list = responses.get(r.id) ?? [];
    return {
      id: r.id,
      storeId,
      scheduleId: r.scheduleId,
      scheduleName: scheduleName(r.scheduleId),
      scheduleVersion: scheduleVersionAt(r.scheduleId, r.scheduledFor),
      trigger: "schedule",
      scheduledFor: r.scheduledFor,
      durationSeconds: runTiming(list, r.scheduledFor),
      status: r.status,
      mention: r.mention,
      recommendation: r.recommendation,
      planned: r.plannedJobs,
      succeeded: r.succeededJobs,
      failed: r.failedJobs,
      requests: requestCount(list),
      costUsd: r.costUsd,
      snapshotId: r.snapshotId,
      hasJobDetail: list.length > 0,
    };
  });
  const authored = EXTRA_RUNS.filter((r) => r.storeId === storeId).map<RunSummary>((r) => ({
    id: r.id,
    storeId,
    scheduleId: r.scheduleId,
    scheduleName: scheduleName(r.scheduleId),
    scheduleVersion: 1,
    trigger: "schedule",
    scheduledFor: r.scheduledFor,
    durationSeconds: r.durationSeconds,
    status: r.status,
    mention: r.mention,
    recommendation: r.recommendation,
    planned: r.planned,
    succeeded: r.succeeded,
    failed: r.failed,
    requests: r.succeeded + r.failed * 3,
    costUsd: r.costUsd,
    snapshotId: r.snapshotId,
    hasJobDetail: false,
  }));
  return [...fromRegistry, ...authored].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));
}

export function runParams(): { storeId: string; runId: string }[] {
  return [...RUN_IDS().map((runId) => ({ storeId: "runpro-pk", runId })), ...EXTRA_RUNS.map((r) => ({ storeId: r.storeId, runId: r.id }))];
}

function providerSplit(channel: AiChannel, list: ResponseSample[], previous: ResponseSample[] | null, costShare: number): ProviderSplit {
  const mine = list.filter((r) => r.channelId === channel.id);
  const ok = mine.filter((r) => r.status === "succeeded");
  const failed = mine.filter((r) => r.status === "failed");
  const classes: ProviderSplit["failureClasses"] = {};
  for (const r of failed) if (r.failure) classes[r.failure.class] = (classes[r.failure.class] ?? 0) + 1;
  const prevOk = previous?.filter((r) => r.channelId === channel.id && r.status === "succeeded") ?? null;
  const usage = usageOf(mine);
  return {
    channelId: channel.id,
    label: channelLabel(channel),
    short: shortChannelLabel(channel),
    planned: mine.length,
    succeeded: ok.length,
    failed: failed.length,
    mention: { n: ok.filter(isMentioned).length, d: ok.length },
    recommendation: { n: ok.filter((r) => r.recommendation === "recommended").length, d: ok.length },
    previousMention: prevOk ? { n: prevOk.filter(isMentioned).length, d: prevOk.length } : null,
    failureClasses: classes,
    requests: usage.requests,
    tokens: usage.inputTokens + usage.outputTokens,
    searchCalls: usage.searchCalls,
    costUsd: costShare,
  };
}

/** Allocate a run's registry cost across providers by tokens + search calls (an estimate). */
function allocateCost(totalCost: number, list: ResponseSample[], channels: AiChannel[]): Map<string, number> {
  const weights = channels.map((c) => {
    const u = usageOf(list.filter((r) => r.channelId === c.id));
    return { id: c.id, w: u.inputTokens + u.outputTokens + 400 * u.searchCalls };
  });
  const total = sum(weights.map((w) => w.w)) || 1;
  const out = new Map<string, number>();
  weights.forEach((w) => out.set(w.id, round((totalCost * w.w) / total, 3)));
  return out;
}

export async function getRunDetail(storeId: string, runId: string): Promise<RunDetail | null> {
  const runs = await listRuns(storeId);
  const run = runs.find((r) => r.id === runId);
  if (!run) return null;
  const [channels, list] = await Promise.all([listStoreChannels(storeId), listRunResponses(storeId, runId)]);
  const schedules = allSchedules();
  const schedule = schedules.find((s) => s.id === run.scheduleId);
  const version = schedule?.versions.find((v) => v.version === run.scheduleVersion) ?? schedule?.versions[schedule.versions.length - 1];
  const config = version?.config;
  const ordered = runs.filter((r) => r.scheduleId === run.scheduleId).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const idx = ordered.findIndex((r) => r.id === runId);
  const previousRunId = idx > 0 ? ordered[idx - 1].id : null;
  const previous = previousRunId && run.hasJobDetail ? await listRunResponses(storeId, previousRunId) : null;

  const usedChannels = channels.filter((c) => list.some((r) => r.channelId === c.id));
  const costs = allocateCost(run.costUsd, list, usedChannels);
  const providers = usedChannels.map((c) => providerSplit(c, list, previous, costs.get(c.id) ?? 0));

  const jobs = list.map<RunJob>((r) => ({
    id: r.id,
    promptId: r.promptId,
    promptText: r.promptText,
    promptVersion: r.promptVersion,
    channelId: r.channelId,
    provider: r.providerLabel,
    providerShort: `${r.providerLabel} · ${r.model}`,
    sample: r.sample,
    status: r.status,
    attempts: r.status === "failed" ? (r.failure?.attempts ?? 1) : 1,
    errorClass: r.failure?.class ?? null,
    errorMessage: r.failure?.message ?? null,
    outcome: r.outcome,
    response: r,
  }));

  const failureGroups = new Map<FailureClass, RunFailureGroup>();
  for (const job of jobs) {
    if (!job.errorClass) continue;
    const group = failureGroups.get(job.errorClass) ?? { cls: job.errorClass, count: 0, examples: [] };
    group.count += 1;
    group.examples.push({ jobId: job.id, prompt: job.promptText, provider: job.providerShort, message: job.errorMessage ?? "", attempts: job.attempts });
    failureGroups.set(job.errorClass, group);
  }

  const usage = usageOf(list);
  const promptMap = new Map<string, { id: string; text: string; version: number }>();
  for (const r of list) if (!promptMap.has(r.promptId)) promptMap.set(r.promptId, { id: r.promptId, text: r.promptText, version: r.promptVersion });

  const snapshotChannels = (usedChannels.length ? usedChannels : channels.filter((c) => config?.channelIds.includes(c.id))).map(toInfo);

  return {
    run,
    previousRunId,
    totals: {
      planned: run.planned,
      attempted: run.planned,
      succeeded: run.succeeded,
      failed: run.failed,
      retried: jobs.filter((j) => j.attempts > 1).length,
      analysed: run.succeeded,
    },
    providers,
    jobs,
    failures: [...failureGroups.values()].sort((a, b) => b.count - a.count),
    usage: { requests: run.requests, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, searchCalls: usage.searchCalls, costUsd: run.costUsd },
    snapshot: {
      id: run.snapshotId,
      scheduleVersion: run.scheduleVersion,
      analysisVersion: list[0]?.analysisVersion ?? "1.2",
      locale: `${config?.market ?? "—"} · ${(config?.language ?? "en").toUpperCase()}`,
      samples: config?.samples ?? 1,
      windowMinutes: config?.windowMinutes ?? 60,
      maxConcurrency: config?.maxConcurrency ?? 3,
      retry: config ? `${config.retry.maxAttempts} attempts · ${config.retry.backoffSeconds}s backoff` : "—",
      prompts: [...promptMap.values()],
      channels: snapshotChannels,
    },
    reportId: registry.reports().find((r) => r.type === "monitoring" && r.sourceId === runId)?.id ?? null,
    provisional: run.status === "running",
  };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function healthState(succeeded: number, planned: number): ProviderHealth["state"] {
  const rate = planned === 0 ? 1 : succeeded / planned;
  return rate >= 0.9 ? "healthy" : rate >= 0.75 ? "degraded" : "outage";
}

export type MonitoringOverview = {
  storeId: string;
  storeTimezone: string;
  market: string;
  schedules: ScheduleRow[];
  lastRun: RunSummary | null;
  nextRun: { scheduleId: string; scheduleName: string; at: string } | null;
  metrics: {
    mention: Rate;
    mentionPrevious: Rate | null;
    recommendation: Rate;
    recommendationPrevious: Rate | null;
    ownedCitation: Rate;
    ownedCitationPrevious: Rate;
    response: Rate;
    responsePrevious: Rate | null;
  } | null;
  timeline: TimelinePoint[];
  providerSeries: { channelId: string; label: string; tone: 1 | 2 | 3 | 4 | 5 }[];
  markers: { x: string; label: string }[];
  health: ProviderHealth[];
  openAlerts: MonitoringEvent[];
  recentEvents: MonitoringEvent[];
  runCount: number;
};

export async function getMonitoringOverview(storeId: string): Promise<MonitoringOverview | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [schedules, runs, channels, events] = await Promise.all([listSchedules(storeId), listRuns(storeId), listStoreChannels(storeId), listEvents(storeId)]);
  const chronological = [...runs].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const responses = await loadRunResponses(storeId, chronological.filter((r) => r.hasJobDetail).map((r) => r.id));

  const timeline = chronological.map<TimelinePoint>((r) => {
    const list = responses.get(r.id) ?? [];
    return {
      runId: r.id,
      label: formatShortDate(r.scheduledFor),
      scheduledFor: r.scheduledFor,
      status: r.status,
      overall: r.mention,
      byProvider: channels
        .filter((c) => list.some((x) => x.channelId === c.id))
        .map((c) => {
          const ok = list.filter((x) => x.channelId === c.id && x.status === "succeeded");
          return { channelId: c.id, rate: { n: ok.filter(isMentioned).length, d: ok.length } };
        }),
      failed: r.failed,
      planned: r.planned,
    };
  });

  const last = runs[0] ?? null;
  const prev = runs[1] ?? null;
  const lastList = last ? (responses.get(last.id) ?? []) : [];
  const health = channels
    .filter((c) => lastList.some((r) => r.channelId === c.id))
    .map<ProviderHealth>((c) => {
      const mine = lastList.filter((r) => r.channelId === c.id);
      const failed = mine.filter((r) => r.status === "failed");
      const classes: ProviderHealth["failureClasses"] = {};
      for (const r of failed) if (r.failure) classes[r.failure.class] = (classes[r.failure.class] ?? 0) + 1;
      return {
        channelId: c.id,
        label: channelLabel(c),
        short: shortChannelLabel(c),
        succeeded: mine.length - failed.length,
        planned: mine.length,
        failed: failed.length,
        failureClasses: classes,
        state: healthState(mine.length - failed.length, mine.length),
        credentials: "tested",
      };
    });

  const nextCandidates = schedules.filter((s) => s.status === "active" && s.nextRunAt).sort((a, b) => (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? ""));
  const summary = store.summary;
  const timelineLabel = new Map(timeline.map((p) => [p.runId, p.label]));

  return {
    storeId,
    storeTimezone: store.timezone,
    market: store.market,
    schedules,
    lastRun: last,
    nextRun: nextCandidates[0] ? { scheduleId: nextCandidates[0].id, scheduleName: nextCandidates[0].name, at: nextCandidates[0].nextRunAt as string } : null,
    metrics:
      last && summary
        ? {
            mention: last.mention,
            mentionPrevious: prev ? prev.mention : null,
            recommendation: last.recommendation,
            recommendationPrevious: prev ? prev.recommendation : null,
            ownedCitation: summary.ownedCitation,
            ownedCitationPrevious: summary.ownedCitationPrevious,
            response: { n: last.succeeded, d: last.planned },
            responsePrevious: prev ? { n: prev.succeeded, d: prev.planned } : null,
          }
        : null,
    timeline,
    providerSeries: channels.filter((c) => timeline.some((p) => p.byProvider.some((b) => b.channelId === c.id))).map((c) => ({ channelId: c.id, label: c.providerLabel, tone: c.tone })),
    markers: TIMELINE_MARKERS.flatMap((m) => {
      const x = timelineLabel.get(m.runId);
      return x ? [{ x, label: m.label }] : [];
    }),
    health,
    openAlerts: events.filter((e) => e.alert && !["resolved", "muted"].includes(e.alert.status)),
    // Open alerts have their own list; keep each event in one place.
    recentEvents: events.filter((e) => !(e.alert && !["resolved", "muted"].includes(e.alert.status))).slice(0, 6),
    runCount: runs.length,
  };
}

export async function getMonitoringHeader(storeId: string): Promise<MonitoringHeaderData | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [schedules, events] = await Promise.all([listSchedules(storeId), listEvents(storeId)]);
  return {
    storeId,
    canSchedule: store.channelIds.length > 0,
    openAlerts: events.filter((e) => e.alert && !["resolved", "muted"].includes(e.alert.status)).length,
    schedules: schedules
      .filter((s) => s.status !== "cancelled")
      .map((s) => ({
        id: s.id,
        name: s.name,
        jobsPerRun: s.jobsPerRun,
        windowMinutes: s.config.windowMinutes,
        maxConcurrency: s.config.maxConcurrency,
        usageCap: `${s.config.usageCap.jobsPerMonth} jobs / month · $${s.config.usageCap.costUsd} estimate`,
      })),
  };
}

// ---------------------------------------------------------------------------
// Events and alerts
// ---------------------------------------------------------------------------

const DATA_QUALITY: EventType[] = ["provider_error_spike", "run_incomplete", "run_late", "integration_attention"];

function describe(r: ResponseSample): Pick<EvidenceSide, "summary" | "tone" | "excerpt"> {
  if (r.status === "failed") {
    return { summary: `Request failed (${(r.failure?.class ?? "error").replace("_", " ")}). Not counted as absent.`, tone: "warning", excerpt: r.failure?.message ?? null };
  }
  const owned = r.citations.some((c) => c.source === "owned");
  const cite = r.citationSupport === "not_supported" ? "" : owned ? " · owned page cited" : " · no owned citation";
  if (r.outcome === "recommended") {
    return { summary: `Recommended${r.position ? ` · #${r.position} in list` : ""} · ${r.sentiment}${cite}`, tone: "success", excerpt: r.evidenceQuote };
  }
  if (r.outcome === "mentioned") {
    return { summary: `Mentioned only · ${r.sentiment} sentiment${cite}`, tone: "info", excerpt: r.evidenceQuote };
  }
  const text = r.answerText.replace(/\s+/g, " ").trim();
  return { summary: `Not mentioned${cite}`, tone: "neutral", excerpt: text ? `${text.slice(0, 150)}${text.length > 150 ? "…" : ""}` : null };
}

function side(label: string, slot: SlotRef, map: Map<string, ResponseSample[]>): EvidenceSide | null {
  const r = (map.get(slot.runId) ?? []).find((x) => x.promptId === slot.promptId && x.channelId === slot.channelId && x.sample === slot.sample);
  if (!r) return null;
  return { label: `${label} · ${slot.runId} · sample ${slot.sample}`, runId: slot.runId, at: r.requestedAt, response: r, ...describe(r) };
}

const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "N/A");

function avgPosition(list: ResponseSample[]) {
  const positions = list.filter((r) => r.status === "succeeded" && r.position).map((r) => r.position as number);
  return { avg: positions.length ? sum(positions) / positions.length : null, n: positions.length };
}

function competitorCitations(list: ResponseSample[]) {
  const ok = list.filter((r) => r.status === "succeeded" && r.citationSupport !== "not_supported");
  return { n: ok.filter((r) => r.citations.some((c) => c.source === "competitor")).length, d: ok.length };
}

function aggregateSides(
  spec: EventSpec,
  map: Map<string, ResponseSample[]>,
  runs: RunSummary[],
  channelName: (id: string) => string,
): { previous: EvidenceSide | null; current: EvidenceSide } {
  const cur = map.get(spec.runId) ?? [];
  const prevId = spec.compare?.previousRunId ?? null;
  const prev = prevId ? (map.get(prevId) ?? []) : null;
  const curRun = runs.find((r) => r.id === spec.runId);
  const prevRun = prevId ? runs.find((r) => r.id === prevId) : undefined;
  const mk = (label: string, runId: string, at: string, summary: string, tone: EvidenceSide["tone"]): EvidenceSide => ({ label: `${label} · ${runId}`, runId, at, summary, tone, excerpt: null, response: null });
  const fallbackAt = curRun?.scheduledFor ?? spec.at;

  switch (spec.metric) {
    case "run_incomplete": {
      const c = curRun;
      const p = prevRun;
      return {
        previous: p ? mk("Previous", p.id, p.scheduledFor, `${p.failed} of ${p.planned} jobs failed · ${p.succeeded} analysed`, "warning") : null,
        current: mk("Current", spec.runId, fallbackAt, `${c?.failed ?? 0} of ${c?.planned ?? 0} jobs failed · ${c?.succeeded ?? 0} analysed`, "warning"),
      };
    }
    case "error_spike": {
      const ch = spec.compare?.channelId ?? "";
      const stat = (list: ResponseSample[]) => {
        const mine = list.filter((r) => r.channelId === ch);
        const failed = mine.filter((r) => r.status === "failed");
        const cls = failed[0]?.failure?.class.replace("_", " ");
        return { failed: failed.length, total: mine.length, cls };
      };
      const c = stat(cur);
      const p = prev ? stat(prev) : null;
      return {
        previous: p && prevId ? mk("Previous", prevId, prevRun?.scheduledFor ?? fallbackAt, `${channelName(ch)}: ${p.failed} of ${p.total} jobs failed`, "success") : null,
        current: mk("Current", spec.runId, fallbackAt, `${channelName(ch)}: ${c.failed} of ${c.total} jobs failed${c.cls ? ` (${c.cls})` : ""}`, "danger"),
      };
    }
    case "avg_position": {
      const c = avgPosition(cur);
      const p = prev ? avgPosition(prev) : null;
      const text = (x: { avg: number | null; n: number }) => (x.avg === null ? "No ordered lists" : `Average list position ${x.avg.toFixed(2)} · ${x.n} ordered lists`);
      return {
        previous: p && prevId ? mk("Previous", prevId, prevRun?.scheduledFor ?? fallbackAt, text(p), "neutral") : null,
        current: mk("Current", spec.runId, fallbackAt, text(c), "warning"),
      };
    }
    case "competitor_citations": {
      const c = competitorCitations(cur);
      const p = prev ? competitorCitations(prev) : null;
      const text = (x: { n: number; d: number }) => `${x.n} / ${x.d} answers cite a competitor domain (${pct(x.n, x.d)})`;
      return {
        previous: p && prevId ? mk("Previous", prevId, prevRun?.scheduledFor ?? fallbackAt, text(p), "neutral") : null,
        current: mk("Current", spec.runId, fallbackAt, text(c), "warning"),
      };
    }
    default:
      return { previous: null, current: mk("Current", spec.runId, spec.at, "Commerce connection: needs attention", "warning") };
  }
}

export async function listEvents(storeId: string): Promise<MonitoringEvent[]> {
  const specs = EVENT_SPECS.filter((s) => s.storeId === storeId);
  if (specs.length === 0) return [];
  const [headlines, channels, runs, prompts] = await Promise.all([listAlertHeadlines(), listStoreChannels(storeId), listRuns(storeId), listPromptsBase(storeId)]);
  const runIds = new Set<string>();
  for (const s of specs) {
    runIds.add(s.runId);
    if (s.compare?.previousRunId) runIds.add(s.compare.previousRunId);
    if (s.previous) runIds.add(s.previous.runId);
    if (s.current) runIds.add(s.current.runId);
  }
  const map = await loadRunResponses(storeId, [...runIds].filter((id) => runs.find((r) => r.id === id)?.hasJobDetail));
  const channelName = (id: string) => channels.find((c) => c.id === id)?.providerLabel ?? id;

  const events = specs.map<MonitoringEvent>((spec) => {
    const headline = spec.headlineId ? headlines.find((h) => h.id === spec.headlineId) : undefined;
    const slotCur = spec.current ? side("Current", spec.current, map) : null;
    const slotPrev = spec.previous ? side("Previous", spec.previous, map) : null;
    const agg = spec.metric ? aggregateSides(spec, map, runs, channelName) : null;
    const current = slotCur ?? agg?.current;
    if (!current) throw new Error(`Event ${spec.id} has no evidence`);
    const slot = spec.current;
    const alert: AlertState | null = spec.alert
      ? {
          id: headline?.id ?? `al-${spec.id}`,
          severity: headline?.severity ?? spec.alert.severity,
          status: spec.alert.status,
          delivery: spec.alert.delivery,
          cooldown: spec.alert.cooldown,
          persistence: spec.alert.persistence,
          handledBy: spec.alert.handledBy,
        }
      : null;
    const channelId = slot?.channelId ?? spec.compare?.channelId ?? null;
    const category: EventCategory = DATA_QUALITY.includes(spec.type) ? "data_quality" : "visibility";
    return {
      id: spec.id,
      storeId,
      type: spec.type,
      category,
      runId: spec.runId,
      at: headline?.at ?? spec.at,
      promptId: slot?.promptId ?? null,
      promptText: slot ? (prompts.find((p) => p.id === slot.promptId)?.text ?? null) : null,
      channelId,
      providerShort: channelId ? channelName(channelId) : null,
      title: headline?.title ?? spec.title ?? spec.summary,
      summary: spec.summary,
      previous: slotPrev ?? agg?.previous ?? null,
      current,
      note: spec.note ?? null,
      alert,
    };
  });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

export async function listObservations(storeId: string): Promise<ObservationRow[]> {
  if (storeId !== "runpro-pk") return [];
  const [prompts, groups, channels, runs, events] = await Promise.all([listPromptsBase(storeId), listPromptGroups(storeId), listStoreChannels(storeId), listRuns(storeId), listEvents(storeId)]);
  const chronological = runs.filter((r) => r.hasJobDetail).sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const map = await loadRunResponses(storeId, chronological.map((r) => r.id));
  const latestRun = chronological[chronological.length - 1];
  if (!latestRun) return [];
  const rows: ObservationRow[] = [];
  for (const prompt of prompts.filter((p) => p.status === "active")) {
    for (const channel of channels) {
      const history = chronological.map((run) => {
        const slot = (map.get(run.id) ?? []).filter((r) => r.promptId === prompt.id && r.channelId === channel.id);
        const ok = slot.filter((r) => r.status === "succeeded");
        return { runId: run.id, label: formatShortDate(run.scheduledFor), n: ok.filter(isMentioned).length, d: ok.length, failed: slot.length - ok.length };
      });
      const latestSlot = (map.get(latestRun.id) ?? []).filter((r) => r.promptId === prompt.id && r.channelId === channel.id).sort((a, b) => a.sample - b.sample);
      if (latestSlot.length === 0) continue;
      const ok = latestSlot.filter((r) => r.status === "succeeded");
      const best: ResponseSample["outcome"] = ok.some((r) => r.outcome === "recommended") ? "recommended" : ok.some((r) => r.outcome === "mentioned") ? "mentioned" : ok.length > 0 ? "absent" : "failed";
      rows.push({
        id: `${prompt.id}|${channel.id}`,
        promptId: prompt.id,
        promptText: prompt.text,
        groupName: groups.find((g) => g.id === prompt.groupId)?.name ?? "Ungrouped",
        channelId: channel.id,
        providerShort: channel.providerLabel,
        channelLabel: channelLabel(channel),
        history,
        series: history.map((h) => (h.d > 0 ? round((h.n / h.d) * 100, 1) : null)),
        latestRunId: latestRun.id,
        latestAt: latestRun.scheduledFor,
        latest: {
          n: ok.filter(isMentioned).length,
          d: ok.length,
          failed: latestSlot.length - ok.length,
          recommended: ok.filter((r) => r.recommendation === "recommended").length,
          ownedCitations: ok.filter(hasOwned).length,
          best,
        },
        eventTypes: [...new Set(events.filter((e) => e.promptId === prompt.id && e.channelId === channel.id).map((e) => e.type))],
        samples: latestSlot.map((response) => ({ sample: response.sample, response })),
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

const ZERO: UsageNumbers = { requests: 0, samples: 0, searchCalls: 0, tokens: 0, costUsd: 0 };
const add = (a: UsageNumbers, b: UsageNumbers): UsageNumbers => ({
  requests: a.requests + b.requests,
  samples: a.samples + b.samples,
  searchCalls: a.searchCalls + b.searchCalls,
  tokens: a.tokens + b.tokens,
  costUsd: round(a.costUsd + b.costUsd, 3),
});

export async function getUsage(storeId: string): Promise<UsageSummary | null> {
  const [store, channels, schedules, runs, org] = await Promise.all([getStore(storeId), listStoreChannels(storeId), listSchedules(storeId), listRuns(storeId), getOrgUsage()]);
  if (!store) return null;
  const caps = USAGE_CAPS[storeId] ?? { requests: 100, samples: 100, searchCalls: 100, tokens: 50_000, costUsd: 5, providerRequests: 50 };
  const hasDetail = runs.some((r) => r.hasJobDetail);
  const perJob = costPerJob();

  let periods: UsagePeriod[];
  if (hasDetail) {
    const map = await loadRunResponses(storeId, USAGE_PERIODS.flatMap((p) => p.runIds));
    periods = USAGE_PERIODS.map<UsagePeriod>((period) => {
      const byProvider = channels.map((c) => {
        let numbers = ZERO;
        for (const runId of period.runIds) {
          const run = runs.find((r) => r.id === runId);
          const list = map.get(runId) ?? [];
          const costs = allocateCost(run?.costUsd ?? 0, list, channels);
          const u = usageOf(list.filter((r) => r.channelId === c.id));
          numbers = add(numbers, { requests: u.requests, samples: u.samples, searchCalls: u.searchCalls, tokens: u.inputTokens + u.outputTokens, costUsd: costs.get(c.id) ?? 0 });
        }
        return { channelId: c.id, label: c.providerLabel, numbers, requestCap: caps.providerRequests };
      });
      return { id: period.id, label: period.label, runCount: period.runIds.length, total: byProvider.reduce((acc, p) => add(acc, p.numbers), ZERO), byProvider };
    });
  } else {
    // No job-level records: estimate from run totals and pk per-job averages.
    const tokensPerJob = 400;
    const searchPerJob = 1.2;
    const mine = runs.filter((r) => r.storeId === storeId);
    const numbersFor = (list: RunSummary[], share: number): UsageNumbers => ({
      requests: Math.round(sum(list.map((r) => r.requests)) * share),
      samples: Math.round(sum(list.map((r) => r.succeeded)) * share),
      searchCalls: Math.round(sum(list.map((r) => r.succeeded)) * searchPerJob * share),
      tokens: Math.round(sum(list.map((r) => r.succeeded)) * tokensPerJob * share),
      costUsd: round(sum(list.map((r) => r.costUsd)) * share, 3),
    });
    const share = channels.length ? 1 / channels.length : 1;
    periods = [{ id: "2026-11", label: "Nov 2026 (to 19 Nov)", runCount: mine.length, total: numbersFor(mine, 1), byProvider: channels.map((c) => ({ channelId: c.id, label: c.providerLabel, numbers: numbersFor(mine, share), requestCap: caps.providerRequests })) }];
  }

  const current = periods[0];
  const completed = Math.max(1, current.runCount);
  const avgPerRun = (key: keyof UsageNumbers) => current.total[key] / completed;
  // Remaining scheduled runs this month for the active schedule(s).
  const active = schedules.filter((s) => s.status === "active" && s.nextRunAt);
  let remaining = 0;
  for (const s of active) {
    const month = "2026-11";
    let t = Date.parse(s.nextRunAt as string);
    const step = s.config.frequency.kind === "weekly" ? 7 * 86_400_000 : s.config.frequency.kind === "daily" ? 86_400_000 : 0;
    while (new Date(t).toISOString().startsWith(month)) {
      remaining += 1;
      if (!step) break;
      t += step;
    }
  }
  const projected: UsageNumbers = {
    requests: Math.round(current.total.requests + avgPerRun("requests") * remaining),
    samples: Math.round(current.total.samples + avgPerRun("samples") * remaining),
    searchCalls: Math.round(current.total.searchCalls + avgPerRun("searchCalls") * remaining),
    tokens: Math.round(current.total.tokens + avgPerRun("tokens") * remaining),
    costUsd: round(current.total.costUsd + avgPerRun("costUsd") * remaining, 2),
  };
  const storeUsage = org.perStore.find((s) => s.storeId === storeId);

  return {
    estimated: !hasDetail,
    currentPeriodId: current.id,
    periods,
    caps: { requests: caps.requests, samples: caps.samples, searchCalls: caps.searchCalls, tokens: caps.tokens, costUsd: caps.costUsd },
    projected,
    projectedNote: remaining > 0 ? `Includes ${remaining} more scheduled run${remaining === 1 ? "" : "s"} this month at the average of runs so far. Paused schedules are excluded.` : "No more scheduled runs this month.",
    storeRequests: storeUsage ? { used: storeUsage.requests, cap: storeUsage.cap } : null,
    schedules: schedules.map((s) => ({ id: s.id, name: s.name, status: s.status, jobsPerRun: s.jobsPerRun, runsPerMonth: s.runsPerMonth, jobsPerMonth: s.jobsPerMonth, costPerMonthUsd: s.costPerMonthUsd })),
    costPerJobUsd: perJob,
  };
}

// ---------------------------------------------------------------------------
// Schedule form
// ---------------------------------------------------------------------------

const TIMEZONES = [
  "UTC",
  "Asia/Karachi",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export async function getScheduleFormContext(storeId: string): Promise<ScheduleFormContext | null> {
  const store = await getStore(storeId);
  if (!store) return null;
  const [prompts, groups, channels, org, members, schedules] = await Promise.all([listPromptsBase(storeId), listPromptGroups(storeId), listStoreChannels(storeId), getOrgUsage(), listMembers(), listSchedules(storeId)]);
  const storeUsage = org.perStore.find((s) => s.storeId === storeId);
  return {
    storeId,
    storeTimezone: store.timezone,
    market: store.market,
    language: store.language,
    prompts: prompts.map((p) => ({
      id: p.id,
      text: p.text,
      group: groups.find((g) => g.id === p.groupId)?.name ?? "Ungrouped",
      status: p.status,
      version: p.version,
      isCore: p.isCore,
    })),
    channels: channels.map((c) => ({ ...toInfo(c), credentials: "tested" as const })),
    timezones: [...new Set([store.timezone, ...TIMEZONES])].map((value) => ({ value, label: value })),
    costPerJobUsd: costPerJob(),
    plan: { requestCap: storeUsage?.cap ?? 0, used: storeUsage?.requests ?? 0 },
    emails: members.filter((m) => m.role !== "viewer").map((m) => m.email),
    otherJobsPerMonth: sum(schedules.filter((s) => s.status === "active").map((s) => s.jobsPerMonth)),
  };
}

