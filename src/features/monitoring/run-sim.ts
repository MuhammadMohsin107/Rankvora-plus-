/**
 * Simulated runs: "Run now" and "Retry failed jobs" create a run that replays sample responses of an earlier run
 * (its basis). Nothing is sent to a provider. Pure and clock-free: callers pass timestamps and ids.
 *
 * Lifecycle (advanced by a client timer, one tick at a time): queued -> running -> completed
 * (or completed with warnings when the replayed jobs include failures).
 */
import type {
  ChannelInfo,
  JobAttempt,
  ProviderSplit,
  RunCatalog,
  RunDetail,
  RunFailureGroup,
  RunJob,
  RunPurpose,
  RunRec,
  RunStatus,
  RunSummary,
  ScheduleConfig,
  ScheduleRec,
  UsageNumbers,
} from "@/types/monitoring";
import type { Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";

const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = ["queued", "running"];
export const isActiveRun = (status: RunStatus) => status === "queued" || status === "running";
/** Statuses of finished runs that carry results. */
export const FINISHED_RUN_STATUSES: readonly RunStatus[] = ["completed", "completed_with_warnings", "partially_completed"];

// ---------------------------------------------------------------------------
// Choosing what to replay
// ---------------------------------------------------------------------------

export type JobSelect = RunRec["select"];

/** Why a slot failed when the demonstration data has no answer for its prompt and provider. */
export const NO_ANSWER_MESSAGE = "Simulated: the demonstration data has no answer for this prompt and provider";

/** Used only when the caller gives no timestamp (the module is clock-free). */
const NO_TIME = "1970-01-01T00:00:00.000Z";

const pairOf = (promptId: string, channelId: string) => `${promptId}|${channelId}`;

/**
 * A failed job for a slot with no demonstration answer. It carries the real prompt (at its pinned version), provider
 * and sample; it has no response analysis, so it is never counted as the brand being absent.
 */
export function buildNoAnswerJob(promptId: string, channelId: string, sample: number, catalog: RunCatalog | undefined, requestedAt: string = NO_TIME, basis: readonly RunJob[] = []): RunJob {
  const prompt = catalog?.prompts.find((p) => p.id === promptId) ?? { id: promptId, text: basis.find((j) => j.promptId === promptId)?.promptText ?? promptId, version: basis.find((j) => j.promptId === promptId)?.promptVersion ?? 1 };
  const channel = catalog?.channels.find((c) => c.id === channelId);
  const seen = basis.find((j) => j.channelId === channelId);
  const provider = channel?.providerLabel ?? seen?.provider ?? channelId;
  const providerShort = channel ? `${channel.providerLabel} · ${channel.model}` : (seen?.providerShort ?? channelId);
  const id = `resp-noanswer-${promptId}-${channelId}-${sample}`;
  const response: ResponseSample = {
    id,
    storeId: basis[0]?.response.storeId ?? "",
    runKind: "monitoring",
    runId: "",
    promptId,
    promptVersion: prompt.version,
    promptText: prompt.text,
    channelId,
    providerLabel: provider,
    model: channel?.model ?? "",
    searchMode: (channel?.searchMode as ResponseSample["searchMode"] | undefined) ?? "web_grounded_auto",
    searchExecuted: false,
    market: catalog?.market ?? basis[0]?.response.market ?? "",
    language: catalog?.language ?? basis[0]?.response.language ?? "en",
    sample,
    status: "failed",
    failure: { class: "refusal", message: NO_ANSWER_MESSAGE, attempts: 3 },
    outcome: "failed",
    answerText: "",
    brandSpans: [],
    brandMentioned: "uncertain",
    recommendation: "none",
    sentiment: "unknown",
    confidence: 0,
    evidenceQuote: null,
    position: null,
    competitors: [],
    citations: [],
    citationSupport: "none_returned",
    usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
    providerRequestId: "simulated · no request sent",
    rawPayloadRef: "no demonstration answer",
    requestedAt,
    completedAt: null,
    analysisVersion: basis[0]?.response.analysisVersion ?? "1.2",
  };
  return {
    id,
    promptId,
    promptText: prompt.text,
    promptVersion: prompt.version,
    channelId,
    provider,
    providerShort,
    sample,
    status: "failed",
    attempts: 3,
    errorClass: "refusal",
    errorMessage: NO_ANSWER_MESSAGE,
    outcome: "failed",
    response,
  };
}

/**
 * The jobs a simulated run contains: exactly the schedule's selected prompts x providers x samples (up to maxSample).
 * A prompt and provider the basis run answered replay those answers (the basis' own samples, or its first one when
 * none is within maxSample). A pair with no answer in the basis, for example a prompt added after the basis run,
 * becomes failed jobs, one per sample: it never borrows another prompt's answers.
 * Answered jobs keep the basis order; the failed ones follow in selection order.
 */
export function selectBasisJobs(basis: readonly RunJob[], select: JobSelect, requestedAt?: string): RunJob[] {
  if (select.retry && select.onlyPairs) return selectRetryJobs(basis, select.onlyPairs, select.catalog, requestedAt);
  const promptIds = [...new Set(select.promptIds)];
  const channelIds = [...new Set(select.channelIds)];
  const wanted = (promptId: string, channelId: string) => !select.onlyPairs || select.onlyPairs.includes(pairOf(promptId, channelId));

  const keep = new Set<string>();
  const missing: RunJob[] = [];
  for (const promptId of promptIds) {
    for (const channelId of channelIds) {
      if (!wanted(promptId, channelId)) continue;
      const mine = basis.filter((j) => j.promptId === promptId && j.channelId === channelId);
      if (mine.length > 0) {
        const inRange = mine.filter((j) => j.sample <= select.maxSample);
        const use = inRange.length > 0 ? inRange : [[...mine].sort((a, b) => a.sample - b.sample)[0]];
        for (const j of use) keep.add(j.id);
        continue;
      }
      for (let sample = 1; sample <= select.maxSample; sample += 1) missing.push(buildNoAnswerJob(promptId, channelId, sample, select.catalog, requestedAt, basis));
    }
  }
  return [...basis.filter((j) => keep.has(j.id)), ...missing];
}

/**
 * A retry replays one answer per failed job: a succeeded answer of the same prompt and provider when the basis has one
 * (each used once while they last), otherwise the failed job itself, so a retry can fail again. A pair the basis has
 * nothing for (it never had a demonstration answer) fails again with the same reason.
 */
export function selectRetryJobs(basis: readonly RunJob[], pairs: readonly string[], catalog?: RunCatalog, requestedAt?: string): RunJob[] {
  const used = new Set<string>();
  const synthesised = new Map<string, number>();
  return pairs.flatMap((pair) => {
    const same = basis.filter((j) => pairOf(j.promptId, j.channelId) === pair);
    const answer = same.find((j) => j.status === "succeeded" && !used.has(j.id)) ?? same.find((j) => j.status === "succeeded");
    if (answer) {
      used.add(answer.id);
      return [answer];
    }
    const failed = same.find((j) => j.status === "failed");
    if (failed) return [failed];
    const [promptId, channelId] = pair.split("|");
    const sample = (synthesised.get(pair) ?? 0) + 1;
    synthesised.set(pair, sample);
    return [buildNoAnswerJob(promptId, channelId, sample, catalog, requestedAt, basis)];
  });
}

/** The selected prompts at the versions the schedule pins (the latest version when it follows the latest) and providers. */
export function buildRunCatalog(input: {
  config: Pick<ScheduleConfig, "promptMode" | "pinnedVersions" | "market" | "language">;
  promptIds: readonly string[];
  prompts: readonly { id: string; text: string; version: number }[];
  channelIds: readonly string[];
  channels: readonly ChannelInfo[];
}): RunCatalog {
  const { config } = input;
  return {
    market: config.market,
    language: config.language,
    prompts: input.promptIds.map((id) => {
      const p = input.prompts.find((x) => x.id === id);
      const pinned = config.promptMode === "pinned" ? config.pinnedVersions[id] : undefined;
      return { id, text: p?.text ?? id, version: pinned ?? p?.version ?? 1 };
    }),
    channels: input.channels
      .filter((c) => input.channelIds.includes(c.id))
      .map((c) => ({ id: c.id, providerLabel: c.providerLabel, model: c.model, label: c.label, short: c.short, searchMode: c.searchMode, supportsCitations: c.supportsCitations, tone: c.tone })),
  };
}

/** The latest finished run with job detail of this schedule, else the latest of the website. */
export function pickBasisRun(runs: readonly RunSummary[], scheduleId: string): RunSummary | null {
  const usable = runs.filter((r) => r.hasJobDetail && FINISHED_RUN_STATUSES.includes(r.status) && !(r as { simulated?: boolean }).simulated);
  const newest = (list: RunSummary[]) => [...list].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))[0] ?? null;
  return newest(usable.filter((r) => r.scheduleId === scheduleId)) ?? newest(usable);
}

// ---------------------------------------------------------------------------
// Plan and records
// ---------------------------------------------------------------------------

export type SimPlan = {
  jobs: RunJob[];
  planned: number;
  succeeded: number;
  failed: number;
  mention: Rate;
  recommendation: Rate;
  usage: { numbers: UsageNumbers; byProvider: RunRec["usage"]["byProvider"] };
  requests: number;
  costUsd: number;
  durationSeconds: number;
};

const mentioned = (j: RunJob) => j.status === "succeeded" && j.response.brandMentioned === "yes";
const recommended = (j: RunJob) => j.status === "succeeded" && j.response.recommendation === "recommended";
const requestsOf = (j: RunJob) => (j.status === "failed" ? j.attempts : 1);

function numbersOf(jobs: RunJob[], costUsd: number): UsageNumbers {
  const ok = jobs.filter((j) => j.status === "succeeded");
  return {
    requests: sum(jobs.map(requestsOf)),
    samples: ok.length,
    searchCalls: sum(ok.map((j) => j.response.usage.searchCalls)),
    tokens: sum(ok.map((j) => j.response.usage.inputTokens + j.response.usage.outputTokens)),
    costUsd: round(costUsd),
  };
}

/** Numbers a simulated run will report. Cost is an estimate: planned jobs x the website's recent cost per job. */
export function planSimulatedRun(basisJobs: readonly RunJob[], select: JobSelect, costPerJobUsd: number, requestedAt?: string): SimPlan {
  const jobs = selectBasisJobs(basisJobs, select, requestedAt);
  const ok = jobs.filter((j) => j.status === "succeeded");
  const costUsd = round(jobs.length * costPerJobUsd, 2);
  const byChannel = new Map<string, RunJob[]>();
  for (const j of jobs) byChannel.set(j.channelId, [...(byChannel.get(j.channelId) ?? []), j]);
  const byProvider = [...byChannel.entries()].map(([channelId, list]) => ({
    channelId,
    label: list[0].provider,
    numbers: numbersOf(list, (list.length / Math.max(1, jobs.length)) * costUsd),
  }));
  return {
    jobs,
    planned: jobs.length,
    succeeded: ok.length,
    failed: jobs.length - ok.length,
    mention: { n: ok.filter(mentioned).length, d: ok.length },
    recommendation: { n: ok.filter(recommended).length, d: ok.length },
    usage: { numbers: numbersOf(jobs, costUsd), byProvider },
    requests: sum(jobs.map(requestsOf)),
    costUsd,
    durationSeconds: Math.max(20, Math.round(jobs.length * 3.7)),
  };
}

export type NewRunInput = {
  id: string;
  snapshotId: string;
  schedule: Pick<ScheduleRec, "id" | "name" | "currentVersion" | "storeId" | "config">;
  basisRunId: string;
  plan: SimPlan;
  select: JobSelect;
  purpose: RunPurpose;
  reason: string;
  initiator: string;
  nowIso: string;
  taskId?: string;
  findingId?: string;
  retryOf?: string;
};

/** The record stored when a run is queued. Rates stay empty until the run completes. */
export function buildRunRec(input: NewRunInput): RunRec {
  const { plan, schedule } = input;
  return {
    id: input.id,
    storeId: schedule.storeId,
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    scheduleVersion: schedule.currentVersion,
    trigger: "manual",
    scheduledFor: input.nowIso,
    durationSeconds: null,
    status: "queued",
    mention: { n: 0, d: 0 },
    recommendation: { n: 0, d: 0 },
    planned: plan.planned,
    succeeded: 0,
    failed: 0,
    requests: 0,
    costUsd: 0,
    snapshotId: input.snapshotId,
    hasJobDetail: true,
    channelIds: [...new Set(plan.jobs.map((j) => j.channelId))],
    promptIds: [...new Set(plan.jobs.map((j) => j.promptId))],
    simulated: true,
    basisRunId: input.basisRunId,
    initiator: input.initiator,
    reason: input.reason,
    purpose: input.purpose,
    taskId: input.taskId,
    findingId: input.findingId,
    retryOf: input.retryOf,
    doneJobs: 0,
    select: input.select,
    createdAt: input.nowIso,
    usage: plan.usage,
    result: {
      succeeded: plan.succeeded,
      failed: plan.failed,
      mention: plan.mention,
      recommendation: plan.recommendation,
      requests: plan.requests,
      costUsd: plan.costUsd,
      durationSeconds: plan.durationSeconds,
    },
  };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Ticks a run needs to finish after it starts (about 6). */
export const RUN_TICKS = 6;

/** Fields to patch for the next tick, or null when the run is already finished. Pure. */
export function advanceRun(run: RunRec, nowIso: string): Partial<RunRec> | null {
  if (run.status === "queued") return { status: "running" };
  if (run.status !== "running") return null;
  const step = Math.max(1, Math.ceil(run.planned / RUN_TICKS));
  const done = Math.min(run.planned, run.doneJobs + step);
  if (done < run.planned) return { doneJobs: done };
  const r = run.result;
  return {
    doneJobs: run.planned,
    status: r.failed > 0 ? "completed_with_warnings" : "completed",
    succeeded: r.succeeded,
    failed: r.failed,
    mention: r.mention,
    recommendation: r.recommendation,
    requests: r.requests,
    costUsd: r.costUsd,
    durationSeconds: r.durationSeconds,
    finishedAt: nowIso,
  };
}

export function runProgress(run: Pick<RunRec, "doneJobs" | "planned">): number {
  return run.planned > 0 ? Math.round((run.doneJobs / run.planned) * 100) : 0;
}

/** Cancelling keeps what finished: the run ends as cancelled with no rates (a partial run has no trend value). */
export function cancelRunPatch(nowIso: string): Partial<RunRec> {
  return { status: "cancelled", finishedAt: nowIso };
}

// ---------------------------------------------------------------------------
// Detail view of a simulated run
// ---------------------------------------------------------------------------

function costShares(totalCost: number, jobs: RunJob[], channelIds: string[]): Map<string, number> {
  let weights = channelIds.map((id) => {
    const list = jobs.filter((j) => j.channelId === id && j.status === "succeeded");
    return { id, w: sum(list.map((j) => j.response.usage.inputTokens + j.response.usage.outputTokens + 400 * j.response.usage.searchCalls)) };
  });
  // No successful answers at all (every request failed): the failed requests were still sent, so split by request count.
  if (sum(weights.map((w) => w.w)) === 0) weights = channelIds.map((id) => ({ id, w: jobs.filter((j) => j.channelId === id).length }));
  const total = sum(weights.map((w) => w.w)) || 1;
  return new Map(weights.map((w) => [w.id, round((totalCost * w.w) / total)]));
}

/** Builds the same RunDetail the real runs use, from the basis run's jobs. Jobs shown so far depend on progress. */
export function simulateRunDetail(run: RunRec, basis: RunDetail, costPerJobUsd: number): RunDetail {
  const plan = planSimulatedRun(basis.jobs, run.select, costPerJobUsd, run.scheduledFor);
  const finished = FINISHED_RUN_STATUSES.includes(run.status);
  const shown = finished ? plan.jobs : plan.jobs.slice(0, run.doneJobs);
  const jobs = shown.map<RunJob>((j, i) => ({
    ...j,
    id: `resp-${run.id}-${i + 1}`,
    response: { ...j.response, id: `resp-${run.id}-${i + 1}`, runId: run.id, providerRequestId: "simulated · no request sent", rawPayloadRef: j.response.rawPayloadRef === "no demonstration answer" ? j.response.rawPayloadRef : `replay of ${j.id}` },
  }));
  const catalogChannels = run.select.catalog?.channels ?? [];
  const channelIds = [...new Set(jobs.map((j) => j.channelId))];
  const costs = costShares(plan.costUsd, jobs, channelIds);
  const providers = channelIds.map<ProviderSplit>((channelId) => {
    const list = jobs.filter((j) => j.channelId === channelId);
    const ok = list.filter((j) => j.status === "succeeded");
    const classes: ProviderSplit["failureClasses"] = {};
    for (const j of list) if (j.errorClass) classes[j.errorClass] = (classes[j.errorClass] ?? 0) + 1;
    const basisProvider = basis.providers.find((p) => p.channelId === channelId);
    const catalogProvider = catalogChannels.find((c) => c.id === channelId);
    return {
      channelId,
      label: basisProvider?.label ?? catalogProvider?.label ?? list[0].provider,
      short: basisProvider?.short ?? catalogProvider?.short ?? list[0].providerShort,
      planned: list.length,
      succeeded: ok.length,
      failed: list.length - ok.length,
      mention: { n: ok.filter(mentioned).length, d: ok.length },
      recommendation: { n: ok.filter(recommended).length, d: ok.length },
      previousMention: null,
      failureClasses: classes,
      requests: sum(list.map(requestsOf)),
      tokens: sum(ok.map((j) => j.response.usage.inputTokens + j.response.usage.outputTokens)),
      searchCalls: sum(ok.map((j) => j.response.usage.searchCalls)),
      costUsd: costs.get(channelId) ?? 0,
    };
  });
  const groups = new Map<string, RunFailureGroup>();
  for (const j of jobs) {
    if (!j.errorClass) continue;
    const g = groups.get(j.errorClass) ?? { cls: j.errorClass, count: 0, examples: [] };
    g.count += 1;
    g.examples.push({ jobId: j.id, prompt: j.promptText, provider: j.providerShort, message: j.errorMessage ?? "", attempts: j.attempts });
    groups.set(j.errorClass, g);
  }
  const ok = jobs.filter((j) => j.status === "succeeded");
  // The snapshot is the run's plan (not its progress): every prompt and provider it was asked to run.
  const promptMap = new Map<string, { id: string; text: string; version: number }>();
  for (const j of plan.jobs) if (!promptMap.has(j.promptId)) promptMap.set(j.promptId, { id: j.promptId, text: j.promptText, version: j.promptVersion });
  const plannedChannelIds = new Set(plan.jobs.map((j) => j.channelId));
  const snapshotChannels = [...basis.snapshot.channels, ...catalogChannels.filter((c) => !basis.snapshot.channels.some((b) => b.id === c.id))].filter((c) => plannedChannelIds.has(c.id));
  const usageNumbers = numbersOf(jobs, finished ? plan.costUsd : round((jobs.length / Math.max(1, plan.planned)) * plan.costUsd));
  return {
    run,
    previousRunId: null,
    totals: { planned: run.planned, attempted: jobs.length, succeeded: ok.length, failed: jobs.length - ok.length, retried: jobs.filter((j) => j.attempts > 1).length, analysed: ok.length },
    providers,
    jobs,
    failures: [...groups.values()].sort((a, b) => b.count - a.count),
    usage: { requests: usageNumbers.requests, inputTokens: sum(ok.map((j) => j.response.usage.inputTokens)), outputTokens: sum(ok.map((j) => j.response.usage.outputTokens)), searchCalls: usageNumbers.searchCalls, costUsd: usageNumbers.costUsd },
    snapshot: { ...basis.snapshot, id: run.snapshotId, scheduleVersion: run.scheduleVersion, samples: run.select.retry ? basis.snapshot.samples : run.select.maxSample, prompts: [...promptMap.values()], channels: snapshotChannels },
    reportId: null,
    provisional: !finished,
  };
}

// ---------------------------------------------------------------------------
// Job attempts (estimated from the response timing)
// ---------------------------------------------------------------------------

/**
 * Attempt timeline of one job. The provider returns one timing per job, so attempts are split evenly over the
 * time between request and completion, less the backoff between them. Labelled "estimated" wherever it is shown.
 */
export function buildAttempts(job: Pick<RunJob, "attempts" | "status" | "errorClass" | "response">, backoffSeconds: number): JobAttempt[] {
  const start = Date.parse(job.response.requestedAt);
  const end = job.response.completedAt ? Date.parse(job.response.completedAt) : null;
  const attempts = Math.max(1, job.attempts);
  const spanSeconds = end !== null && !Number.isNaN(start) ? Math.max(1, (end - start) / 1000) : null;
  const latency = spanSeconds === null ? null : Math.max(1, round((spanSeconds - backoffSeconds * (attempts - 1)) / attempts, 1));
  return Array.from({ length: attempts }, (_, i) => {
    const last = i === attempts - 1;
    const outcome: JobAttempt["outcome"] = last && job.status === "succeeded" ? "succeeded" : "failed";
    const offset = latency === null ? 0 : i * (latency + backoffSeconds);
    return {
      n: i + 1,
      at: Number.isNaN(start) ? job.response.requestedAt : new Date(start + offset * 1000).toISOString(),
      outcome,
      errorClass: outcome === "failed" ? job.errorClass : null,
      latencySeconds: latency,
    };
  });
}

/** Latency of a job in seconds: request to completion. Null when there is no completion time. */
export function jobLatencySeconds(job: Pick<RunJob, "response">): number | null {
  const { requestedAt, completedAt } = job.response;
  if (!completedAt) return null;
  const s = (Date.parse(completedAt) - Date.parse(requestedAt)) / 1000;
  return Number.isFinite(s) && s >= 0 ? round(s, 1) : null;
}

/** Jobs and estimated cost a schedule has used in the month of `nowIso`. Cancelled, skipped and failed runs do not count. */
export function scheduleMonthUsage(runs: readonly Pick<RunSummary, "scheduleId" | "scheduledFor" | "status" | "planned" | "costUsd">[], scheduleId: string, nowIso: string): { jobs: number; costUsd: number } {
  const month = nowIso.slice(0, 7);
  const counted = runs.filter((r) => r.scheduleId === scheduleId && r.scheduledFor.slice(0, 7) === month && r.status !== "cancelled" && r.status !== "skipped" && r.status !== "failed");
  return { jobs: sum(counted.map((r) => r.planned)), costUsd: round(sum(counted.map((r) => r.costUsd))) };
}

// ---------------------------------------------------------------------------
// Extra run metrics (competitors, sentiment, position, coverage)
// ---------------------------------------------------------------------------

export type RunExtras = {
  /** Competitors named in successful answers, most named first. */
  competitors: { name: string; n: number; d: number }[];
  positive: Rate;
  position: { average: number | null; lists: number };
  coverage: { prompts: Rate; providers: Rate };
};

/** Secondary measures of a run, each with its denominator. Failed jobs are not counted as absent. */
export function runExtras(jobs: readonly RunJob[], totals: { prompts: number; providers: number }): RunExtras {
  const ok = jobs.filter((j) => j.status === "succeeded");
  const names = new Map<string, number>();
  for (const j of ok) for (const c of j.response.competitors) if (c.mentioned) names.set(c.name, (names.get(c.name) ?? 0) + 1);
  const positions = ok.map((j) => j.response.position).filter((p): p is number => p !== null);
  return {
    competitors: [...names.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n, d: ok.length })),
    positive: { n: ok.filter((j) => j.response.sentiment === "positive").length, d: ok.length },
    position: { average: positions.length ? sum(positions) / positions.length : null, lists: positions.length },
    coverage: {
      prompts: { n: new Set(ok.map((j) => j.promptId)).size, d: Math.max(totals.prompts, new Set(ok.map((j) => j.promptId)).size) },
      providers: { n: new Set(ok.map((j) => j.channelId)).size, d: Math.max(totals.providers, new Set(ok.map((j) => j.channelId)).size) },
    },
  };
}
