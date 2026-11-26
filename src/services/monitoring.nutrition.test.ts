import { describe, expect, it } from "vitest";

import { EVENT_SPECS } from "@/demo/monitoring";
import { buildRunResponses } from "@/demo/shared-records";
import { getUsage, listEvents, listRuns, listSchedules } from "@/services/monitoring";

const NU = "nutrition";

const slot = (ref: { runId: string; promptId: string; channelId: string; sample: number }) =>
  buildRunResponses(ref.runId).find((r) => r.promptId === ref.promptId && r.channelId === ref.channelId && r.sample === ref.sample)!;
const mentioned = (r: ReturnType<typeof slot>) => r.status === "succeeded" && r.brandMentioned === "yes";
const owned = (r: ReturnType<typeof slot>) => r.status === "succeeded" && r.citations.some((c) => c.source === "owned");

describe("nutrition monitoring events are true against the generated responses", () => {
  const specs = EVENT_SPECS.filter((s) => s.storeId === NU);

  it("has an event for every shared nutrition alert (al-025 … al-033)", () => {
    const ids = specs.map((s) => s.headlineId).filter(Boolean).sort();
    expect(ids).toEqual(["al-025", "al-026", "al-027", "al-028", "al-029", "al-030", "al-031", "al-032", "al-033"]);
  });

  it("references slots whose previous and current samples really differ the way the event says", () => {
    for (const spec of specs) {
      if (!spec.previous || !spec.current) continue;
      const prev = slot(spec.previous);
      const cur = slot(spec.current);
      expect(prev.status, spec.id).toBe("succeeded");
      expect(cur.status, spec.id).toBe("succeeded");
      if (spec.type === "new_mention") {
        expect(mentioned(prev), spec.id).toBe(false);
        expect(mentioned(cur), spec.id).toBe(true);
      }
      if (spec.type === "new_recommendation" || spec.type === "sentiment_shift") {
        expect(prev.outcome, spec.id).toBe("mentioned");
        expect(cur.outcome, spec.id).toBe("recommended");
      }
      if (spec.type === "owned_citation_gained") {
        expect(owned(prev), spec.id).toBe(false);
        expect(owned(cur), spec.id).toBe(true);
      }
      expect(cur.promptId, spec.id).toBe(prev.promptId);
      expect(cur.channelId, spec.id).toBe(prev.channelId);
    }
  });

  it("matches run-level events to the failed counts of the run", async () => {
    const runs = await listRuns(NU);
    for (const spec of specs.filter((s) => s.metric === "run_incomplete")) {
      const run = runs.find((r) => r.id === spec.runId)!;
      const failed = buildRunResponses(spec.runId).filter((r) => r.status === "failed").length;
      expect(failed, spec.id).toBe(run.failed);
      expect(failed, spec.id).toBeGreaterThan(0);
    }
    expect(runs.map((r) => r.failed).reverse()).toEqual([4, 2, 5, 1, 2, 0]);
  });

  it("returns every event with evidence and keeps open alerts at al-025 … al-027", async () => {
    const events = await listEvents(NU);
    expect(events).toHaveLength(specs.length);
    expect(events.filter((e) => e.alert?.status === "new").map((e) => e.alert!.id).sort()).toEqual(["al-025", "al-026", "al-027"]);
  });
});

describe("nutrition schedules and usage", () => {
  it("shows the paused schedule, the stale pinned prompt and the active weekly schedule", async () => {
    const rows = await listSchedules(NU);
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["sch-nu-001", "active"],
      ["sch-nu-002", "paused"],
      ["sch-nu-003", "needs_attention"],
    ]);
    expect(rows[0].jobsPerRun).toBe(42);
    expect(rows[2].config.pinnedVersions["p-nu-003"]).toBe(1);
    expect(rows[2].statusReason).toContain("v2");
  });

  it("derives November usage from the runs and stays inside the budget and the plan", async () => {
    const usage = (await getUsage(NU))!;
    expect(usage.estimated).toBe(false);
    const current = usage.periods[0];
    // 3 weekly runs: 42 + 2 retries per failed job (1 and 2 failed jobs).
    expect(current.total.requests).toBe(42 + 2 + 42 + 4 + 42);
    expect(usage.storeRequests).toEqual({ used: 198, cap: 450 });
    expect(usage.projected.requests).toBeLessThanOrEqual(usage.caps.requests);
    expect(usage.projected.requests).toBeLessThanOrEqual(usage.storeRequests!.cap);
  });
});
