/**
 * Audit rows created in this browser: creation, pause, resume, cancel, start and completion as pure functions.
 * They return field patches for the demo-state "audits" collection. No React, no clock reads (callers pass `nowMs`).
 */
import type { AuditConfig, AuditLane, AuditRow, AuditStatus, AuditType, RunPlan, SimScenario } from "@/types/audit";

import { AUDIT_TYPE_LABEL } from "./labels";
import { APPROX_COST_PER_JOB_USD, APPROX_COST_PER_PAGE_USD } from "./lanes";
import { effectiveStatus, elapsedOf, endRun, hasSnapshot, isPaused, isTerminal, pauseRun, planRun, progressAt, resumeRun, slotAt, startRun } from "./simulation";

export type NewAuditInput = {
  storeId: string;
  type: AuditType;
  lanes: AuditLane[];
  config: AuditConfig;
  counts: { jobs: number; pages: number; checks: number };
  createdBy: string;
  basisAuditId: string;
  asDraft?: boolean;
  nowMs: number;
  /** Local timestamp text for the title, for example "19 Nov, 14:05". */
  stamp: string;
};

/** Request indexes whose prompt has no demonstration answer. Tolerates a partial config (the wizard estimate). */
function noAnswerSlotsOf(config: AuditConfig): number[] {
  const missing = new Set(config.noAnswerPromptIds ?? []);
  const prompts = config.prompts ?? [];
  const channelCount = config.channelIds?.length ?? 0;
  const samples = config.samples ?? 0;
  if (missing.size === 0 || prompts.length === 0 || channelCount === 0 || samples <= 0) return [];
  const out: number[] = [];
  for (let i = 0; i < prompts.length * channelCount * samples; i += 1) {
    const slot = slotAt(i, prompts.length, channelCount, samples);
    if (slot && missing.has(prompts[slot.prompt].id)) out.push(i);
  }
  return out;
}

export function planFor(input: Pick<NewAuditInput, "lanes" | "config" | "counts">, seedKey: string, scenario: SimScenario = input.config.scenario ?? "normal"): RunPlan {
  return planRun({
    noAnswerSlots: noAnswerSlotsOf(input.config),
    jobs: input.counts.jobs,
    pages: input.counts.pages,
    checks: input.counts.checks,
    maxRequests: input.config.limits.maxRequests,
    budgetUsd: input.config.limits.budgetUsd,
    costPerJobUsd: APPROX_COST_PER_JOB_USD,
    costPerPageUsd: APPROX_COST_PER_PAGE_USD,
    scenario,
    aiLane: input.lanes.includes("ai_visibility"),
    webLane: input.lanes.includes("website_readiness"),
    seedKey,
  });
}

/** The row to pass to `create()`. A draft has no clock yet; otherwise the run starts now (Validating, then Queued, then In progress). */
export function buildAuditRow(input: NewAuditInput): Omit<AuditRow, "id"> {
  const iso = new Date(input.nowMs).toISOString();
  const plan = planFor(input, `${input.storeId}|${input.type}|${input.nowMs}`);
  const draft = Boolean(input.asDraft);
  return {
    storeId: input.storeId,
    title: `${AUDIT_TYPE_LABEL[input.type]} audit — ${input.stamp}`,
    type: input.type,
    lanes: input.lanes,
    status: draft ? "draft" : "validating",
    startedAt: iso,
    completedAt: null,
    durationSeconds: 0,
    snapshotId: null,
    createdBy: input.createdBy,
    plannedJobs: plan.jobs,
    succeededJobs: 0,
    failedJobs: 0,
    findingsCreated: 0,
    mention: null,
    recommendation: null,
    pages: input.lanes.includes("website_readiness") ? { n: 0, d: plan.pages } : null,
    provisional: !draft,
    reportId: null,
    reportStatus: null,
    reportVersion: null,
    paused: false,
    config: input.config,
    plan,
    run: draft ? null : startRun(input.nowMs),
    basisAuditId: input.basisAuditId,
    endedAt: null,
    createdAt: iso,
    simulated: true,
  };
}

const isoAt = (ms: number) => new Date(ms).toISOString();

/** Row values for display: status, counts and duration at `nowMs`. Seeded rows come back unchanged. */
export function liveRow(row: AuditRow, nowMs: number): AuditRow {
  if (!row.plan) return row;
  const elapsed = row.run ? elapsedOf(row.run, nowMs) : 0;
  const progress = progressAt(row.plan, elapsed);
  const status: AuditStatus = effectiveStatus(row, nowMs);
  const finished = isTerminal(status);
  return {
    ...row,
    status,
    provisional: !finished && status !== "draft",
    durationSeconds: Math.round(elapsed / 1000),
    plannedJobs: row.plan.jobs,
    succeededJobs: progress.jobs.succeeded,
    failedJobs: progress.jobs.failed,
    pages: row.plan.webLane ? { n: progress.pages.crawled, d: row.plan.pages } : null,
    snapshotId: row.snapshotId ?? null,
    completedAt: finished && status !== "cancelled" ? (row.endedAt ?? row.completedAt) : row.completedAt,
  };
}

export const canPause = (row: AuditRow, nowMs: number) => Boolean(row.run && row.plan) && !isTerminal(effectiveStatus(row, nowMs)) && !isPaused(row.run!);
export const canResume = (row: AuditRow) => Boolean(row.run) && row.status !== "draft" && isPaused(row.run!) && !isTerminal(row.status);

export function pausePatch(row: AuditRow, nowMs: number): Partial<AuditRow> | null {
  if (!row.run || !canPause(row, nowMs)) return null;
  return { paused: true, run: pauseRun(row.run, nowMs) };
}

export function resumePatch(row: AuditRow, nowMs: number): Partial<AuditRow> | null {
  if (!row.run || !canResume(row)) return null;
  return { paused: false, run: resumeRun(row.run, nowMs) };
}

/** Cancel keeps what was completed, stops the clock and creates no snapshot. The status is Cancelled, never "partially completed". */
export function cancelPatch(row: AuditRow, nowMs: number): Partial<AuditRow> | null {
  const status = effectiveStatus(row, nowMs);
  if (isTerminal(status)) return null;
  if (!row.run || !row.plan) return { status: "cancelled", paused: false, endedAt: isoAt(nowMs), provisional: false };
  const run = endRun(row.run, nowMs);
  return { status: "cancelled", paused: false, run, endedAt: isoAt(nowMs), provisional: false, snapshotId: null };
}

/** The patch that records a finished run once the clock reached its end. Null while it is still running or already stored. */
export function finalizePatch(row: AuditRow, nowMs: number): Partial<AuditRow> | null {
  if (!row.plan || !row.run || isTerminal(row.status) || row.status === "draft") return null;
  if (elapsedOf(row.run, nowMs) < row.plan.endAtMs) return null;
  const outcome = row.plan.outcome;
  const run = endRun(row.run, nowMs, row.plan.endAtMs);
  const endedAt = isoAt(row.run.startedAtMs + row.run.pausedMs + row.plan.endAtMs);
  return {
    status: outcome,
    run,
    paused: false,
    endedAt,
    completedAt: outcome === "blocked" || outcome === "failed" ? null : endedAt,
    snapshotId: hasSnapshot(outcome) ? `snap-${row.id}` : null,
    provisional: false,
  };
}

/** Starts a saved draft now. */
export function startDraftPatch(row: AuditRow, nowMs: number): Partial<AuditRow> | null {
  if (row.status !== "draft") return null;
  return { status: "validating", run: startRun(nowMs), startedAt: isoAt(nowMs), provisional: true, paused: false };
}

export const OUTCOME_LABEL: Record<AuditStatus, string> = {
  draft: "Draft",
  validating: "Validating",
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  completed_with_warnings: "Completed with warnings",
  partially_completed: "Partially completed",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
};
