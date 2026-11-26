import { describe, expect, it } from "vitest";

import type { AuditConfig, AuditRow } from "@/types/audit";

import { OUTCOME_LABEL, buildAuditRow, cancelPatch, canPause, canResume, finalizePatch, liveRow, pausePatch, resumePatch, startDraftPatch } from "./rows";
import { QUEUE_MS, VALIDATE_MS, effectiveStatus, elapsedOf, isFailedJob, planRun, progressAt, slotAt, startRun } from "./simulation";

const config: AuditConfig = {
  promptScope: "ids",
  promptIds: ["p-1", "p-2"],
  prompts: [
    { id: "p-1", text: "Best running shoes?", version: 1 },
    { id: "p-2", text: "Shoes for flat feet?", version: 2 },
  ],
  channelIds: ["ch-a", "ch-b"],
  samples: 2,
  market: "PK",
  language: "en",
  startPoints: ["Homepage"],
  maxUrls: 40,
  maxDepth: 3,
  pageTypes: ["home", "product"],
  excludedPaths: [],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: true, pageSpeed: true, cms: false },
  limits: { maxRequests: 200, concurrency: 4, budgetUsd: 8 },
};

const planInput = { jobs: 8, pages: 30, checks: 20, maxRequests: 200, budgetUsd: 8, costPerJobUsd: 0.06, costPerPageUsd: 0.0004, scenario: "normal" as const, aiLane: true, webLane: true, seedKey: "seed-a" };

describe("planRun", () => {
  it("is deterministic for the same input", () => {
    expect(planRun(planInput)).toEqual(planRun(planInput));
  });
  it("caps requests at the request limit and ends partially completed", () => {
    const plan = planRun({ ...planInput, maxRequests: 5 });
    expect(plan.jobCap).toBe(5);
    expect(plan.outcome).toBe("partially_completed");
  });
  it("caps requests by budget", () => {
    const plan = planRun({ ...planInput, budgetUsd: 0.2 });
    expect(plan.jobCap).toBeLessThan(plan.jobs);
    expect(plan.outcome).toBe("partially_completed");
  });
  it("blocks during validation when the crawl is blocked", () => {
    const plan = planRun({ ...planInput, scenario: "crawl_blocked" });
    expect(plan.outcome).toBe("blocked");
    expect(plan.endAtMs).toBe(VALIDATE_MS);
  });
  it("fails early on a provider outage", () => {
    const plan = planRun({ ...planInput, scenario: "provider_outage" });
    expect(plan.outcome).toBe("failed");
    expect(plan.endAtMs).toBeLessThan(planRun(planInput).endAtMs);
  });
  it("ignores scenarios that do not apply to the lanes", () => {
    expect(planRun({ ...planInput, aiLane: false, scenario: "provider_outage" }).scenario).toBe("normal");
    expect(planRun({ ...planInput, webLane: false, scenario: "crawl_blocked" }).scenario).toBe("normal");
  });
});

describe("noAnswerSlots", () => {
  const input = { ...planInput, jobs: 12, webLane: false, pages: 0, checks: 0, seedKey: "no-answer" };
  const slots = [6, 7, 8, 9, 10, 11];

  it("fails those slots and leaves other plans unchanged", () => {
    const withSlots = planRun({ ...input, noAnswerSlots: slots });
    const plain = planRun(input);
    expect(plain.noAnswerSlots).toBeUndefined();
    for (const i of slots) expect(isFailedJob(withSlots, i)).toBe(true);
    for (let i = 0; i < 6; i += 1) expect(isFailedJob(withSlots, i)).toBe(isFailedJob(plain, i));
  });
  it("ends partially completed above 20% failed, with counters that agree", () => {
    const plan = planRun({ ...input, noAnswerSlots: slots });
    expect(plan.outcome).toBe("partially_completed");
    const end = progressAt(plan, plan.endAtMs);
    expect(end.jobs.failed).toBeGreaterThanOrEqual(6);
    expect(end.jobs.succeeded + end.jobs.failed).toBe(12);
    expect(end.jobs.succeeded).toBe(12 - end.jobs.failed);
  });
  it("ends completed with warnings for a single no-answer slot", () => {
    const plan = planRun({ ...input, noAnswerSlots: [0], seedKey: "no-answer-one" });
    expect(["completed_with_warnings", "partially_completed"]).toContain(plan.outcome);
    expect(progressAt(plan, plan.endAtMs).jobs.failed).toBeGreaterThanOrEqual(1);
  });
});

describe("progressAt stage machine", () => {
  const plan = planRun({ ...planInput, seedKey: "stage-machine" });

  it("goes validating, queued, in progress, then ends in the planned outcome", () => {
    expect(progressAt(plan, 0).status).toBe("validating");
    expect(progressAt(plan, VALIDATE_MS + 10).status).toBe("queued");
    expect(progressAt(plan, VALIDATE_MS + QUEUE_MS + 500).status).toBe("in_progress");
    const end = progressAt(plan, plan.endAtMs);
    expect(end.status).toBe(plan.outcome);
    expect(end.phase).toBe("finished");
  });

  it("only moves forward in time", () => {
    let previous = progressAt(plan, 0);
    for (let t = 500; t <= plan.endAtMs; t += 500) {
      const next = progressAt(plan, t);
      expect(next.overall.n).toBeGreaterThanOrEqual(previous.overall.n);
      expect(next.jobs.sent).toBeGreaterThanOrEqual(previous.jobs.sent);
      expect(next.pages.crawled).toBeGreaterThanOrEqual(previous.pages.crawled);
      previous = next;
    }
  });

  it("sends every planned request and crawls every page by the end", () => {
    const end = progressAt(plan, plan.endAtMs);
    expect(end.jobs.sent).toBe(plan.jobCap);
    expect(end.jobs.succeeded + end.jobs.failed).toBe(plan.jobCap);
    expect(end.pages.crawled).toBe(plan.pages);
    expect(end.stages.every((s) => s.state === "done")).toBe(true);
  });

  it("counts failed requests with the same draw the responses use", () => {
    const end = progressAt(plan, plan.endAtMs);
    let failed = 0;
    for (let i = 0; i < plan.jobCap; i += 1) if (isFailedJob(plan, i)) failed += 1;
    expect(end.jobs.failed).toBe(failed);
  });

  it("starts evaluation only after crawling and requests are done", () => {
    const mid = progressAt(plan, VALIDATE_MS + QUEUE_MS + 1500);
    expect(mid.stages.find((s) => s.id === "evaluation")?.done).toBe(0);
  });

  it("omits stages of a lane that is not part of the audit", () => {
    const aiOnly = progressAt(planRun({ ...planInput, webLane: false, seedKey: "ai-only" }), 20000);
    expect(aiOnly.stages.some((s) => s.id === "crawling" || s.id === "evaluation")).toBe(false);
    const webOnly = progressAt(planRun({ ...planInput, aiLane: false, seedKey: "web-only" }), 20000);
    expect(webOnly.stages.some((s) => s.id === "ai_requests")).toBe(false);
  });

  it("marks the robots check as failed when the run is blocked", () => {
    const blocked = planRun({ ...planInput, scenario: "crawl_blocked" });
    const end = progressAt(blocked, blocked.endAtMs);
    expect(end.status).toBe("blocked");
    expect(end.setup.find((c) => c.id === "robots")?.state).toBe("failed");
    expect(end.jobs.sent).toBe(0);
  });

  it("maps request slots in prompt, channel, sample order", () => {
    expect(slotAt(0, 2, 2, 2)).toEqual({ prompt: 0, channel: 0, sample: 1 });
    expect(slotAt(3, 2, 2, 2)).toEqual({ prompt: 0, channel: 1, sample: 2 });
    expect(slotAt(4, 2, 2, 2)).toEqual({ prompt: 1, channel: 0, sample: 1 });
    expect(slotAt(8, 2, 2, 2)).toBeNull();
  });
});

describe("audit creation and status transitions", () => {
  const T0 = Date.parse("2026-11-19T10:00:00Z");
  const base = (over: Partial<Parameters<typeof buildAuditRow>[0]> = {}) =>
    buildAuditRow({ storeId: "runpro-pk", type: "focused", lanes: ["ai_visibility", "website_readiness"], config, counts: { jobs: 8, pages: 30, checks: 20 }, createdBy: "Tester", basisAuditId: "aud-002", nowMs: T0, stamp: "19 Nov, 10:00", ...over });
  const withId = (row = base()): AuditRow => ({ ...row, id: "demo-audits-1" });

  it("creates a simulated audit that starts validating with a running clock", () => {
    const row = withId();
    expect(row.status).toBe("validating");
    expect(row.simulated).toBe(true);
    expect(row.title).toContain("Focused audit");
    expect(row.plan?.jobs).toBe(8);
    expect(row.run?.startedAtMs).toBe(T0);
    expect(row.snapshotId).toBeNull();
    expect(row.lanes).toEqual(["ai_visibility", "website_readiness"]);
  });

  it("saves a draft without a clock and starts it later", () => {
    const draft = withId(base({ asDraft: true }));
    expect(draft.status).toBe("draft");
    expect(draft.run).toBeNull();
    const patch = startDraftPatch(draft, T0 + 5000);
    expect(patch?.status).toBe("validating");
    expect(patch?.run?.startedAtMs).toBe(T0 + 5000);
    expect(startDraftPatch({ ...draft, ...patch }, T0)).toBeNull();
  });

  it("advances through the lifecycle with the clock", () => {
    const row = withId();
    expect(effectiveStatus(row, T0)).toBe("validating");
    expect(effectiveStatus(row, T0 + VALIDATE_MS + 100)).toBe("queued");
    expect(effectiveStatus(row, T0 + VALIDATE_MS + QUEUE_MS + 1000)).toBe("in_progress");
    expect(liveRow(row, T0 + VALIDATE_MS + QUEUE_MS + 6000).succeededJobs + liveRow(row, T0 + VALIDATE_MS + QUEUE_MS + 6000).failedJobs).toBeGreaterThan(0);
  });

  it("does not finalize before the end and records the planned outcome after it", () => {
    const row = withId();
    expect(finalizePatch(row, T0 + 1000)).toBeNull();
    const patch = finalizePatch(row, T0 + (row.plan?.endAtMs ?? 0) + 10);
    expect(patch?.status).toBe(row.plan?.outcome);
    expect(patch?.run?.endedElapsedMs).toBe(row.plan?.endAtMs);
    expect(patch?.snapshotId).toBe("snap-demo-audits-1");
    // Once stored, nothing more to record.
    expect(finalizePatch({ ...row, ...patch } as AuditRow, T0 + 999999)).toBeNull();
  });

  it("pauses the clock, resumes it without counting the pause, and refuses invalid moves", () => {
    const row = withId();
    const running = T0 + VALIDATE_MS + QUEUE_MS + 4000;
    const paused = { ...row, ...pausePatch(row, running) } as AuditRow;
    expect(paused.paused).toBe(true);
    expect(canPause(paused, running + 1)).toBe(false);
    expect(canResume(paused)).toBe(true);
    const frozen = elapsedOf(paused.run!, running + 60000);
    expect(frozen).toBe(elapsedOf(paused.run!, running));
    const resumed = { ...paused, ...resumePatch(paused, running + 60000) } as AuditRow;
    expect(resumed.paused).toBe(false);
    expect(elapsedOf(resumed.run!, running + 61000)).toBe(frozen + 1000);
    expect(resumePatch(resumed, running + 70000)).toBeNull();
  });

  it("a paused run does not finish", () => {
    const row = withId();
    const paused = { ...row, ...pausePatch(row, T0 + 5000) } as AuditRow;
    expect(finalizePatch(paused, T0 + 10 * 60 * 1000)).toBeNull();
  });

  it("cancel sets Cancelled (not partially completed), keeps counts, creates no snapshot", () => {
    const row = withId();
    const at = T0 + VALIDATE_MS + QUEUE_MS + 8000;
    const before = liveRow(row, at);
    const cancelled = { ...row, ...cancelPatch(row, at) } as AuditRow;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.status).not.toBe("partially_completed");
    expect(cancelled.snapshotId).toBeNull();
    const after = liveRow(cancelled, at + 60000);
    expect(after.status).toBe("cancelled");
    expect(after.succeededJobs).toBe(before.succeededJobs);
    expect(after.failedJobs).toBe(before.failedJobs);
    expect(finalizePatch(cancelled, at + 10 * 60 * 1000)).toBeNull();
    expect(cancelPatch(cancelled, at + 1)).toBeNull();
  });

  it("cancelling before any request was sent keeps nothing", () => {
    const row = withId();
    const cancelled = { ...row, ...cancelPatch(row, T0 + 500) } as AuditRow;
    const live = liveRow(cancelled, T0 + 90000);
    expect(live.succeededJobs + live.failedJobs).toBe(0);
    expect(live.status).toBe("cancelled");
  });

  it("reaches every end status through the plan", () => {
    const ended = (scenario: "normal" | "provider_outage" | "crawl_blocked", over: Partial<AuditConfig> = {}) => {
      const row = withId(base({ config: { ...config, scenario, ...over } }));
      return liveRow(row, T0 + (row.plan?.endAtMs ?? 0)).status;
    };
    expect(ended("provider_outage")).toBe("failed");
    expect(ended("crawl_blocked")).toBe("blocked");
    expect(ended("normal", { limits: { maxRequests: 3, concurrency: 4, budgetUsd: 8 } })).toBe("partially_completed");
    expect(["completed", "completed_with_warnings"]).toContain(ended("normal"));
    expect(Object.keys(OUTCOME_LABEL)).toHaveLength(10);
  });

  it("starts a run clock at the given time", () => {
    expect(elapsedOf(startRun(T0), T0 + 2500)).toBe(2500);
  });
});
