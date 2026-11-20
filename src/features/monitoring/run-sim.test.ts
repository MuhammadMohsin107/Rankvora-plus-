import { describe, expect, it } from "vitest";

import { ratePercent } from "@/lib/format";
import type { RunCatalog, RunDetail, RunJob, RunRec, RunSummary, ScheduleRec } from "@/types/monitoring";
import type { ResponseSample } from "@/types/shared-records";

import { advanceRun, buildAttempts, buildRunCatalog, buildRunRec, cancelRunPatch, isActiveRun, pickBasisRun, planSimulatedRun, runProgress, selectBasisJobs, simulateRunDetail } from "./run-sim";

function job(promptId: string, channelId: string, sample: number, failed = false, mention = false): RunJob {
  const response = {
    id: `resp-run-001-${promptId}-${channelId}-${sample}`,
    runId: "run-001",
    requestedAt: "2026-11-17T04:00:00Z",
    completedAt: failed ? null : "2026-11-17T04:00:20Z",
    brandMentioned: mention ? "yes" : "no",
    recommendation: mention ? "recommended" : "none",
    usage: { inputTokens: 100, outputTokens: 50, searchCalls: 1 },
  } as unknown as ResponseSample;
  return {
    id: response.id,
    promptId,
    promptText: promptId,
    promptVersion: 1,
    channelId,
    provider: channelId,
    providerShort: channelId,
    sample,
    status: failed ? "failed" : "succeeded",
    attempts: failed ? 3 : 1,
    errorClass: failed ? "timeout" : null,
    errorMessage: failed ? "Timed out" : null,
    outcome: mention ? "recommended" : "absent",
    response,
  };
}

const basis: RunJob[] = [
  job("p1", "a", 1, false, true),
  job("p1", "a", 2),
  job("p1", "b", 1, true),
  job("p2", "a", 1, false, true),
  job("p2", "b", 1),
];
const basisDetail = () =>
  ({
    run: { id: "run-001" },
    jobs: basis,
    providers: [],
    snapshot: { id: "snap-001", scheduleVersion: 1, analysisVersion: "1.2", locale: "en", samples: 2, windowMinutes: 60, maxConcurrency: 4, retry: "3 attempts", prompts: [], channels: [] },
  }) as unknown as RunDetail;
const select = { promptIds: ["p1"], channelIds: ["a", "b"], maxSample: 1 };
const schedule = { id: "sch-1", name: "Weekly", currentVersion: 2, storeId: "s", config: {} } as unknown as ScheduleRec;

describe("selectBasisJobs", () => {
  it("keeps jobs that match prompts, providers and samples", () => {
    expect(selectBasisJobs(basis, select).map((j) => j.id)).toEqual([basis[0].id, basis[2].id]);
  });

  it("never falls back to other prompts' answers", () => {
    const jobs = selectBasisJobs(basis, { promptIds: ["new-prompt"], channelIds: ["a"], maxSample: 1 });
    expect(jobs).toHaveLength(1);
    expect(jobs.every((j) => j.promptId === "new-prompt")).toBe(true);
    expect(selectBasisJobs(basis, { promptIds: ["x"], channelIds: ["zzz"], maxSample: 1 }).every((j) => j.promptId === "x")).toBe(true);
  });
});

describe("a schedule that selects a prompt with no demonstration answers", () => {
  const catalog: RunCatalog = {
    market: "United Arab Emirates",
    language: "en",
    prompts: [
      { id: "p1", text: "Best running shoes in Dubai", version: 4 },
      { id: "new-prompt", text: "Where can I buy trail shoes?", version: 2 },
    ],
    channels: ["a", "b", "c"].map((id) => ({ id, providerLabel: `Provider ${id}`, model: `model-${id}`, label: `Provider ${id} API · model-${id}`, short: `P${id}`, searchMode: "web_grounded_auto", supportsCitations: true, tone: 1 as const })),
  };
  const onlyNew = { promptIds: ["new-prompt"], channelIds: ["a", "b", "c"], maxSample: 2, catalog };

  it("creates one failed job per provider and sample, for that prompt only, at its pinned version", () => {
    const jobs = selectBasisJobs(basis, onlyNew);
    expect(jobs).toHaveLength(6); // 1 prompt x 3 providers x 2 samples
    expect(jobs.every((j) => j.promptId === "new-prompt" && j.promptText === "Where can I buy trail shoes?" && j.promptVersion === 2)).toBe(true);
    expect(jobs.every((j) => j.status === "failed" && j.attempts === 3 && j.outcome === "failed" && j.errorMessage?.startsWith("Simulated: the demonstration data has no answer"))).toBe(true);
    expect(jobs.map((j) => `${j.channelId}${j.sample}`).sort()).toEqual(["a1", "a2", "b1", "b2", "c1", "c2"]);
    expect(jobs[0]).toMatchObject({ provider: "Provider a", providerShort: "Provider a · model-a" });
    expect(jobs.every((j) => j.response.status === "failed" && j.response.brandMentioned === "uncertain" && j.response.answerText === "")).toBe(true);
  });

  it("counts them as failed requests, never as the brand being absent, with no rate", () => {
    const plan = planSimulatedRun(basis, onlyNew, 0.06);
    expect(plan).toMatchObject({ planned: 6, succeeded: 0, failed: 6, mention: { n: 0, d: 0 }, recommendation: { n: 0, d: 0 }, requests: 18 });
    expect(plan.usage.numbers).toMatchObject({ requests: 18, samples: 0, tokens: 0 });
    expect(plan.usage.byProvider.map((p) => p.channelId).sort()).toEqual(["a", "b", "c"]);
    expect(ratePercent(plan.mention.n, plan.mention.d)).toBeNull(); // N/A, not 0%
    expect(ratePercent(plan.recommendation.n, plan.recommendation.d)).toBeNull();
  });

  it("finishes as completed with warnings and lists only the selected prompt", () => {
    const plan = planSimulatedRun(basis, onlyNew, 0.06);
    const run = buildRunRec({ id: "run-demo-2", snapshotId: "snap", schedule, basisRunId: "run-001", plan, select: onlyNew, purpose: "manual", reason: "r", initiator: "You", nowIso: "2026-11-19T09:30:00Z" });
    expect(run).toMatchObject({ planned: 6, promptIds: ["new-prompt"], channelIds: ["a", "b", "c"] });
    let current: RunRec = run;
    for (let i = 0; i < 20; i += 1) {
      const patch = advanceRun(current, "2026-11-19T09:31:00Z");
      if (!patch) break;
      current = { ...current, ...patch };
    }
    expect(current).toMatchObject({ status: "completed_with_warnings", planned: 6, succeeded: 0, failed: 6, requests: 18, mention: { n: 0, d: 0 } });
  });

  it("builds a run detail whose totals, providers, jobs and snapshot agree", () => {
    const plan = planSimulatedRun(basis, onlyNew, 0.06);
    const run = { ...buildRunRec({ id: "run-demo-2", snapshotId: "snap", schedule, basisRunId: "run-001", plan, select: onlyNew, purpose: "manual", reason: "r", initiator: "You", nowIso: "2026-11-19T09:30:00Z" }), status: "completed_with_warnings" as const };
    const detail = simulateRunDetail(run, basisDetail(), 0.06);
    expect(detail.totals).toMatchObject({ planned: 6, attempted: 6, succeeded: 0, failed: 6, analysed: 0 });
    expect(detail.jobs.every((j) => j.promptId === "new-prompt" && j.response.runId === "run-demo-2")).toBe(true);
    expect(detail.providers).toHaveLength(3);
    expect(detail.providers.every((p) => p.planned === 2 && p.failed === 2 && p.mention.d === 0 && p.requests === 6)).toBe(true);
    expect(detail.providers.reduce((n, p) => n + p.costUsd, 0)).toBeCloseTo(plan.costUsd, 2);
    expect(detail.failures).toEqual([expect.objectContaining({ cls: "refusal", count: 6 })]);
    expect(detail.usage.requests).toBe(18);
    expect(detail.snapshot.prompts).toEqual([{ id: "new-prompt", text: "Where can I buy trail shoes?", version: 2 }]);
    expect(detail.snapshot.channels.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("mixed selection: answered prompts replay their answers, the new prompt fails", () => {
    const jobs = selectBasisJobs(basis, { promptIds: ["p1", "new-prompt"], channelIds: ["a"], maxSample: 1, catalog });
    expect(jobs.filter((j) => j.promptId === "p1").map((j) => [j.id, j.status])).toEqual([[basis[0].id, "succeeded"]]);
    expect(jobs.filter((j) => j.promptId === "new-prompt").map((j) => j.status)).toEqual(["failed"]);
    expect(jobs.every((j) => ["p1", "new-prompt"].includes(j.promptId))).toBe(true);
    const plan = planSimulatedRun(basis, { promptIds: ["p1", "new-prompt"], channelIds: ["a"], maxSample: 1, catalog }, 0.06);
    expect(plan).toMatchObject({ planned: 2, succeeded: 1, failed: 1, mention: { n: 1, d: 1 } });
  });

  it("never contains a prompt the schedule did not select", () => {
    for (const promptIds of [["p1"], ["p2"], ["p1", "new-prompt"], ["new-prompt"], []]) {
      const jobs = selectBasisJobs(basis, { promptIds, channelIds: ["a", "b"], maxSample: 2, catalog });
      expect(jobs.every((j) => promptIds.includes(j.promptId))).toBe(true);
    }
  });

  it("retry of a prompt that never had an answer fails again with the same reason", () => {
    const jobs = selectBasisJobs(basis, { promptIds: [], channelIds: [], maxSample: 99, onlyPairs: ["new-prompt|a", "p2|a"], retry: true, catalog });
    expect(jobs.map((j) => [j.promptId, j.status])).toEqual([["new-prompt", "failed"], ["p2", "succeeded"]]);
    expect(jobs[0]).toMatchObject({ promptText: "Where can I buy trail shoes?", promptVersion: 2, errorMessage: expect.stringContaining("no answer") });
  });
});

describe("buildRunCatalog", () => {
  const channels = [{ id: "a", providerLabel: "A", model: "m", label: "A API · m", short: "A", searchMode: "x", supportsCitations: true, tone: 1 as const }];
  const prompts = [{ id: "p1", text: "Latest text", version: 5 }];
  it("uses the pinned version when the schedule pins, else the latest", () => {
    const base = { promptIds: ["p1"], prompts, channelIds: ["a", "zzz"], channels };
    expect(buildRunCatalog({ ...base, config: { promptMode: "pinned", pinnedVersions: { p1: 3 }, market: "UK", language: "en" } }).prompts).toEqual([{ id: "p1", text: "Latest text", version: 3 }]);
    expect(buildRunCatalog({ ...base, config: { promptMode: "latest", pinnedVersions: { p1: 3 }, market: "UK", language: "en" } })).toMatchObject({ market: "UK", prompts: [{ id: "p1", version: 5 }], channels: [{ id: "a" }] });
  });
});

describe("simulated run lifecycle", () => {
  const plan = planSimulatedRun(basis, select, 0.06);
  const run = buildRunRec({ id: "run-demo-1", snapshotId: "snap-mon-demo-1", schedule, basisRunId: "run-001", plan, select, purpose: "manual", reason: "Check after update", initiator: "You", nowIso: "2026-11-19T09:30:00Z" });

  it("plans counts from the replayed jobs with numerator and denominator", () => {
    expect(plan).toMatchObject({ planned: 2, succeeded: 1, failed: 1, mention: { n: 1, d: 1 } });
    expect(plan.usage.numbers.requests).toBe(1 + 3); // the failed job used 3 attempts
  });

  it("starts queued with no results and records reason and initiator", () => {
    expect(run).toMatchObject({ status: "queued", trigger: "manual", reason: "Check after update", initiator: "You", simulated: true, succeeded: 0, mention: { n: 0, d: 0 } });
    expect(isActiveRun(run.status)).toBe(true);
  });

  it("goes queued -> running -> completed with warnings, then stops", () => {
    let current: RunRec = run;
    const seen: string[] = [current.status];
    for (let i = 0; i < 20; i += 1) {
      const patch = advanceRun(current, "2026-11-19T09:31:00Z");
      if (!patch) break;
      current = { ...current, ...patch };
      if (seen[seen.length - 1] !== current.status) seen.push(current.status);
    }
    expect(seen).toEqual(["queued", "running", "completed_with_warnings"]);
    expect(current).toMatchObject({ doneJobs: 2, succeeded: 1, failed: 1, finishedAt: "2026-11-19T09:31:00Z" });
    expect(runProgress(current)).toBe(100);
    expect(advanceRun(current, "x")).toBeNull();
  });

  it("does not touch the schedule: the run record has no next-run field", () => {
    expect("nextRunAt" in run).toBe(false);
  });

  it("can be cancelled", () => {
    expect(cancelRunPatch("t")).toEqual({ status: "cancelled", finishedAt: "t" });
  });
});

describe("pickBasisRun", () => {
  const mk = (id: string, scheduleId: string, scheduledFor: string, extra: Partial<RunSummary> = {}) => ({ id, scheduleId, scheduledFor, status: "completed", hasJobDetail: true, ...extra }) as RunSummary;
  it("prefers the latest finished run of the same schedule, never a simulated one", () => {
    const runs = [mk("r1", "s1", "2026-11-01"), mk("r2", "s1", "2026-11-08"), mk("r3", "s2", "2026-11-15"), mk("r4", "s1", "2026-11-18", { simulated: true } as Partial<RunSummary>)];
    expect(pickBasisRun(runs, "s1")?.id).toBe("r2");
    expect(pickBasisRun(runs, "s9")?.id).toBe("r3");
    expect(pickBasisRun([], "s1")).toBeNull();
  });
});

describe("buildAttempts", () => {
  it("splits a failed job into estimated attempts with backoff", () => {
    const failed = { ...basis[2], response: { ...basis[2].response, completedAt: "2026-11-17T04:02:00Z" } };
    const attempts = buildAttempts(failed, 30);
    expect(attempts).toHaveLength(3);
    expect(attempts.every((a) => a.outcome === "failed" && a.errorClass === "timeout")).toBe(true);
    expect(attempts[0].latencySeconds).toBe(20);
  });

  it("gives one succeeded attempt for a normal job", () => {
    expect(buildAttempts(basis[0], 30)).toEqual([{ n: 1, at: "2026-11-17T04:00:00.000Z", outcome: "succeeded", errorClass: null, latencySeconds: 20 }]);
  });
});

describe("retry of failed jobs", () => {
  it("replays a succeeded answer for each failed pair, or the failure again when none exists", () => {
    const jobs = selectBasisJobs(basis, { promptIds: [], channelIds: [], maxSample: 9, onlyPairs: ["p1|b", "p2|b"], retry: true });
    // p1|b has only the failed job, p2|b has a succeeded one.
    expect(jobs.map((j) => [j.promptId, j.status])).toEqual([["p1", "failed"], ["p2", "succeeded"]]);
  });
});

describe("runExtras", () => {
  it("counts competitors, sentiment and coverage over successful jobs only", async () => {
    const { runExtras } = await import("./run-sim");
    const withComp = basis.map((j, i) => ({ ...j, response: { ...j.response, competitors: [{ id: "c", name: "Brand X", mentioned: i < 2 }], sentiment: i === 0 ? "positive" : "neutral", position: i === 0 ? 2 : null } })) as RunJob[];
    const extras = runExtras(withComp, { prompts: 3, providers: 2 });
    expect(extras.competitors).toEqual([{ name: "Brand X", n: 2, d: 4 }]);
    expect(extras.positive).toEqual({ n: 1, d: 4 });
    expect(extras.position).toEqual({ average: 2, lists: 1 });
    expect(extras.coverage.prompts).toEqual({ n: 2, d: 3 });
    expect(extras.coverage.providers).toEqual({ n: 2, d: 2 });
  });
});
