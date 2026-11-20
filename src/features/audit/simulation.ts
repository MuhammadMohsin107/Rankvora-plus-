/**
 * Simulated audit run: a deterministic stage machine driven by a clock.
 * No randomness at run time: the same plan and the same elapsed time always give the same progress, so a
 * run survives a reload (the clock is stored) and tests can check every stage. Pure and framework-free.
 */
import type { Rate } from "@/types/core";
import type { AuditStage, AuditStatus, RunPlan, RunState, SimScenario } from "@/types/audit";

export const VALIDATE_MS = 3000;
export const QUEUE_MS = 1200;
const REPORT_MS = 2500;

export const TERMINAL_STATUSES: readonly AuditStatus[] = ["completed", "completed_with_warnings", "partially_completed", "blocked", "failed", "cancelled"];
export const isTerminal = (status: AuditStatus) => TERMINAL_STATUSES.includes(status);
/** Statuses that produce an immutable snapshot. */
export const hasSnapshot = (status: AuditStatus) => status === "completed" || status === "completed_with_warnings" || status === "partially_completed";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Stable 0-99 draw for request `index`. */
export function drawFor(seed: number, index: number): number {
  let h = Math.imul((seed + Math.imul(index + 1, 0x9e3779b1)) | 0, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % 100;
}
/** A request fails when it has no demonstration answer, or by the seeded random draw. */
export const isNoAnswerJob = (plan: Pick<RunPlan, "noAnswerSlots">, index: number) => Boolean(plan.noAnswerSlots?.includes(index));
export const isFailedJob = (plan: Pick<RunPlan, "seed" | "failPercent" | "noAnswerSlots">, index: number) => isNoAnswerJob(plan, index) || drawFor(plan.seed, index) < plan.failPercent;

export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export type PlanInput = {
  jobs: number;
  pages: number;
  checks: number;
  maxRequests: number;
  budgetUsd: number;
  costPerJobUsd: number;
  costPerPageUsd: number;
  scenario: SimScenario;
  aiLane: boolean;
  webLane: boolean;
  seedKey: string;
  /** Request indexes that have no demonstration answer; they count as failed. */
  noAnswerSlots?: number[];
};

const durations = (jobs: number, pages: number, checks: number, webLane: boolean) => {
  const requests = jobs > 0 ? clamp(jobs * 450, 8000, 45000) : 0;
  const crawl = pages > 0 ? clamp(pages * 220, 6000, 36000) : 0;
  const evaluation = webLane && checks > 0 ? clamp(checks * 180, 3000, 7000) : 0;
  return { requests, crawl, evaluation, run: Math.max(requests, crawl) };
};

/** Builds the plan of a run from the counts the wizard shows. */
export function planRun(input: PlanInput): RunPlan {
  const jobs = input.aiLane ? input.jobs : 0;
  const pages = input.webLane ? input.pages : 0;
  const budgetJobs = input.costPerJobUsd > 0 ? Math.floor(Math.max(0, input.budgetUsd - pages * input.costPerPageUsd) / input.costPerJobUsd) : jobs;
  const jobCap = jobs > 0 ? Math.max(0, Math.min(jobs, input.maxRequests, budgetJobs)) : 0;
  // The provider outage only means something when requests are sent.
  const scenario: SimScenario = input.scenario === "provider_outage" && jobs === 0 ? "normal" : input.scenario === "crawl_blocked" && pages === 0 ? "normal" : input.scenario;
  const failPercent = scenario === "provider_outage" ? 85 : 5;
  const seed = seedOf(input.seedKey);
  const d = durations(jobs, pages, input.checks, input.webLane);
  const runStart = VALIDATE_MS + QUEUE_MS;
  const noAnswerSlots = input.aiLane && input.noAnswerSlots && input.noAnswerSlots.length > 0 ? input.noAnswerSlots : undefined;
  const base = { jobs, pages, checks: input.webLane ? input.checks : 0, jobCap, failPercent, seed, ...(noAnswerSlots ? { noAnswerSlots } : {}), scenario, aiLane: input.aiLane, webLane: input.webLane };

  if (scenario === "crawl_blocked") {
    return { ...base, endAtMs: VALIDATE_MS, outcome: "blocked", warnings: [{ atMs: VALIDATE_MS - 1, text: "robots.txt disallows the audit crawler. Allow it or remove the website lane to continue." }] };
  }
  if (scenario === "provider_outage") {
    return {
      ...base,
      endAtMs: runStart + Math.round(d.requests * 0.45),
      outcome: "failed",
      warnings: [{ atMs: runStart + Math.round(d.requests * 0.2), text: "The provider is returning errors on most requests. Retries are being used up." }],
    };
  }

  const warnings: RunPlan["warnings"] = [];
  if (pages >= 60) warnings.push({ atMs: runStart + Math.round(d.crawl * 0.4), text: "The site answered 429 to the crawler. It backed off to 2 concurrent requests." });
  if (jobCap < jobs && d.requests > 0) warnings.push({ atMs: runStart + Math.round(d.requests * (jobCap / jobs)), text: "The request limit or budget cap was reached. The remaining requests were not sent." });

  const endAtMs = runStart + d.run + d.evaluation + REPORT_MS;
  let failed = 0;
  for (let i = 0; i < jobCap; i += 1) if (isFailedJob({ seed, failPercent, noAnswerSlots }, i)) failed += 1;
  let outcome: AuditStatus = "completed";
  if (jobCap < jobs || (jobCap > 0 && failed / jobCap > 0.2)) outcome = "partially_completed";
  else if (failed > 0 || warnings.length > 0) outcome = "completed_with_warnings";
  return { ...base, endAtMs, outcome, warnings };
}

// ---------------------------------------------------------------------------
// Run clock
// ---------------------------------------------------------------------------

export const startRun = (nowMs: number): RunState => ({ startedAtMs: nowMs, pausedAtMs: null, pausedMs: 0, endedElapsedMs: null });

/** Elapsed run time in ms, without time spent paused. Frozen once the run ended or was cancelled. */
export function elapsedOf(run: RunState, nowMs: number): number {
  if (run.endedElapsedMs !== null) return run.endedElapsedMs;
  return Math.max(0, (run.pausedAtMs ?? nowMs) - run.startedAtMs - run.pausedMs);
}

export const isPaused = (run: RunState) => run.endedElapsedMs === null && run.pausedAtMs !== null;

export function pauseRun(run: RunState, nowMs: number): RunState {
  if (run.endedElapsedMs !== null || run.pausedAtMs !== null) return run;
  return { ...run, pausedAtMs: nowMs };
}

export function resumeRun(run: RunState, nowMs: number): RunState {
  if (run.endedElapsedMs !== null || run.pausedAtMs === null) return run;
  return { ...run, pausedAtMs: null, pausedMs: run.pausedMs + Math.max(0, nowMs - run.pausedAtMs) };
}

/** Stops the clock where it is. Work done so far stays visible; nothing more happens. */
export function endRun(run: RunState, nowMs: number, atElapsedMs?: number): RunState {
  if (run.endedElapsedMs !== null) return run;
  return { ...run, pausedAtMs: null, endedElapsedMs: atElapsedMs ?? elapsedOf(run, nowMs) };
}

// ---------------------------------------------------------------------------
// Progress at a point in time
// ---------------------------------------------------------------------------

export const SETUP_CHECKS = [
  { id: "prompts", label: "Prompts and versions resolved", lane: "ai" },
  { id: "keys", label: "AI provider connections present", lane: "ai" },
  { id: "robots", label: "robots.txt reachable", lane: "web" },
  { id: "start", label: "Start URLs reachable", lane: "web" },
  { id: "limits", label: "Limits and budget within plan", lane: "both" },
  { id: "scope", label: "Scope saved as a snapshot", lane: "both" },
] as const;

export type SetupCheck = { id: string; label: string; state: "done" | "running" | "queued" | "failed" };

export type RunProgress = {
  phase: "validating" | "queued" | "running" | "finished";
  /** Lifecycle status at this moment. Terminal only once the run ended. */
  status: AuditStatus;
  elapsedMs: number;
  stages: AuditStage[];
  setup: SetupCheck[];
  jobs: { planned: number; sent: number; succeeded: number; failed: number; running: number; queued: number; notSent: number };
  pages: { planned: number; crawled: number };
  overall: Rate;
  warnings: string[];
};

export function progressAt(plan: RunPlan, elapsedMs: number): RunProgress {
  const t = clamp(elapsedMs, 0, plan.endAtMs);
  const finished = t >= plan.endAtMs;
  const d = durations(plan.jobs, plan.pages, plan.checks, plan.webLane);
  const runStart = VALIDATE_MS + QUEUE_MS;
  const r = Math.max(0, t - runStart);
  const phase: RunProgress["phase"] = finished ? "finished" : t < VALIDATE_MS ? "validating" : t < runStart ? "queued" : "running";
  const blocked = plan.outcome === "blocked";

  const sent = d.requests > 0 ? Math.min(plan.jobCap, Math.floor((r * plan.jobs) / d.requests)) : 0;
  let failed = 0;
  for (let i = 0; i < sent; i += 1) if (isFailedJob(plan, i)) failed += 1;
  const crawled = d.crawl > 0 ? Math.min(plan.pages, Math.floor((r * plan.pages) / d.crawl)) : 0;
  const crawlDone = plan.pages === 0 || crawled >= plan.pages;
  const jobsDone = plan.jobs === 0 || sent >= plan.jobCap;
  const ended = plan.outcome === "failed" && finished;

  const evalStart = runStart + d.run;
  const evalDone = plan.checks > 0 ? clamp(Math.floor((plan.checks * Math.max(0, t - evalStart)) / Math.max(1, d.evaluation)), 0, plan.checks) : 0;
  const reportStart = evalStart + d.evaluation;
  const sections = 9;
  const reportDone = clamp(Math.floor((sections * Math.max(0, t - reportStart)) / REPORT_MS), 0, sections);
  const running = phase === "running";
  const passedRun = t >= evalStart && !ended && !blocked;

  const state = (done: boolean, active: boolean): AuditStage["state"] => (done ? "done" : active ? "running" : "queued");
  const stages: AuditStage[] = [];
  const setupDone = Math.min(SETUP_CHECKS.length, Math.floor((SETUP_CHECKS.length * t) / VALIDATE_MS));
  stages.push({ id: "validating", label: "Validating", state: t >= VALIDATE_MS ? "done" : "running", done: t >= VALIDATE_MS ? SETUP_CHECKS.length : setupDone, total: SETUP_CHECKS.length, unit: "setup checks" });
  if (plan.jobs > 0) {
    stages.push({
      id: "ai_requests",
      label: "AI requests",
      state: state(jobsDone && t >= runStart, running && !jobsDone),
      done: sent,
      total: plan.jobCap,
      unit: "requests",
      note: plan.jobCap < plan.jobs ? `Limit reached: ${plan.jobs - plan.jobCap} requests will not be sent` : undefined,
    });
    const analysed = jobsDone && !ended ? sent - failed : Math.max(0, sent - failed - (running ? 2 : 0));
    stages.push({ id: "analysis", label: "Analysis", state: state(jobsDone && analysed >= sent - failed && t >= runStart, running && sent > 0), done: analysed, total: Math.max(analysed, plan.jobCap - Math.round((plan.jobCap * plan.failPercent) / 100)), unit: "responses analysed" });
  }
  if (plan.pages > 0) {
    stages.push({ id: "crawling", label: "Crawling", state: state(crawlDone && t >= runStart, running && !crawlDone), done: crawled, total: plan.pages, unit: "pages" });
  }
  if (plan.checks > 0) {
    stages.push({ id: "evaluation", label: "Evaluation", state: state(evalDone >= plan.checks, passedRun && evalDone < plan.checks), done: evalDone, total: plan.checks, unit: "checks", note: crawlDone ? undefined : "Starts when the crawl finishes" });
  }
  stages.push({ id: "report", label: "Report", state: state(reportDone >= sections, false), done: reportDone, total: sections, unit: "sections" });

  const checkList = SETUP_CHECKS.filter((c) => c.lane === "both" || (c.lane === "ai" ? plan.aiLane : plan.webLane));
  const robotsAt = checkList.findIndex((c) => c.id === "robots");
  const setup: SetupCheck[] = checkList.map((c, i) => {
    let st: SetupCheck["state"];
    if (t >= VALIDATE_MS) st = blocked ? (c.id === "robots" ? "failed" : i < robotsAt ? "done" : "queued") : "done";
    else {
      const done = Math.floor((checkList.length * t) / VALIDATE_MS);
      st = i < done ? "done" : i === done ? "running" : "queued";
    }
    return { id: c.id, label: c.label, state: st };
  });

  const warnings = plan.warnings.filter((w) => t >= w.atMs).map((w) => w.text);
  if (failed > 0) warnings.push(`${failed} ${failed === 1 ? "request" : "requests"} failed after retries. Failed requests are excluded from rates and never read as the brand being absent.`);

  const status: AuditStatus = finished ? plan.outcome : t < VALIDATE_MS ? "validating" : t < runStart ? "queued" : "in_progress";
  const plannedTotal = plan.jobCap + plan.pages;
  return {
    phase,
    status,
    elapsedMs: t,
    stages,
    setup,
    jobs: { planned: plan.jobs, sent, succeeded: sent - failed, failed, running: running && !jobsDone ? 1 : 0, queued: Math.max(0, plan.jobCap - sent - (running && !jobsDone ? 1 : 0)), notSent: plan.jobs - plan.jobCap },
    pages: { planned: plan.pages, crawled },
    overall: { n: sent + crawled, d: plannedTotal },
    warnings,
  };
}

/** Index of the request being sent right now (null when none). */
export const currentJobIndex = (p: RunProgress): number | null => (p.phase === "running" && p.jobs.running > 0 ? p.jobs.sent : null);

/** Slot order: prompt, then channel, then sample. */
export function slotAt(index: number, promptCount: number, channelCount: number, samples: number): { prompt: number; channel: number; sample: number } | null {
  if (promptCount <= 0 || channelCount <= 0 || samples <= 0) return null;
  const perPrompt = channelCount * samples;
  const prompt = Math.floor(index / perPrompt);
  if (prompt >= promptCount) return null;
  const rest = index % perPrompt;
  return { prompt, channel: Math.floor(rest / samples), sample: (rest % samples) + 1 };
}

/** Status of a run row at `nowMs`: the stored terminal status, or the lifecycle status from the clock. */
export function effectiveStatus(row: { status: AuditStatus; run?: RunState | null; plan?: RunPlan }, nowMs: number): AuditStatus {
  if (isTerminal(row.status) || row.status === "draft" || !row.run || !row.plan) return row.status;
  return progressAt(row.plan, elapsedOf(row.run, nowMs)).status;
}
