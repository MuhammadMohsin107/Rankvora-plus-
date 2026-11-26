/**
 * Cross-data validity of the demonstration data, checked for every website.
 * Not a test of any screen: it asserts that the registry, findings, tasks, alerts, prompts, schedules,
 * comparisons, reports and the generated responses never contradict each other.
 */
import { describe, expect, it } from "vitest";

import { OPEN_FINDING_STATUSES, OPEN_TASK_STATUSES } from "@/lib/record-status";
import { getStore } from "@/services/core";
import { getDashboardData } from "@/services/dashboard";
import { registry } from "@/services/records";
import { listReports } from "@/services/reports";
import type { Rate } from "@/types/core";

import { REGISTRY_STORE_IDS, registryFor } from "./registry";
import { ALL_GROUPS, ALL_PROMPTS, DEMO_ALERTS, DEMO_COMPETITORS, DEMO_PRODUCTS, DEMO_STORES, DEMO_USAGE } from "./shared";
import { DEMO_FINDINGS, buildRunResponses } from "./shared-records";
import { DEMO_USAGE_SEEDS } from "./settings";

const STORES = ["runpro-pk", "runpro-ae", "homefit-uk", "nutrition", "threadly"] as const;
const rateOk = (r: Rate | null | undefined) => r == null || (Number.isInteger(r.n) && Number.isInteger(r.d) && r.n >= 0 && r.n <= r.d);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("websites", () => {
  it("are the five demonstration websites", () => {
    expect(DEMO_STORES.map((s) => s.id).sort()).toEqual([...STORES].sort());
  });

  it("have unique ids across every record type", () => {
    const groups: Record<string, string[]> = {
      stores: DEMO_STORES.map((s) => s.id),
      prompts: ALL_PROMPTS.map((p) => p.id),
      groups: ALL_GROUPS.map((g) => g.id),
      competitors: DEMO_COMPETITORS.map((c) => c.id),
      products: DEMO_PRODUCTS.map((p) => p.id),
      alerts: DEMO_ALERTS.map((a) => a.id),
      findings: DEMO_FINDINGS.map((f) => f.id),
      audits: STORES.flatMap((s) => registryFor(s).audits.map((a) => a.id)),
      runs: STORES.flatMap((s) => registryFor(s).runs.map((r) => r.id)),
      schedules: STORES.flatMap((s) => registryFor(s).schedules.map((x) => x.id)),
      comparisons: STORES.flatMap((s) => registryFor(s).comparisons.map((c) => c.id)),
      tasks: STORES.flatMap((s) => registryFor(s).tasks.map((t) => t.id)),
      reports: STORES.flatMap((s) => registryFor(s).reports.map((r) => r.id)),
      snapshots: STORES.flatMap((s) => [...registryFor(s).audits.map((a) => a.snapshotId), ...registryFor(s).runs.map((r) => r.snapshotId)].filter((x): x is string => !!x)),
    };
    for (const [kind, ids] of Object.entries(groups)) {
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes, `duplicate ${kind} ids`).toEqual([]);
    }
  });

  it("registry knows every website that has data", () => {
    for (const id of REGISTRY_STORE_IDS) expect(STORES).toContain(id);
  });
});

describe("prompts", () => {
  it("match the website summary and the prompt records", async () => {
    for (const storeId of STORES) {
      const store = await getStore(storeId);
      const own = ALL_PROMPTS.filter((p) => p.storeId === storeId);
      const active = own.filter((p) => p.status === "active").length;
      if (store?.summary) expect(store.summary.activePrompts, storeId).toBe(active);
      expect(new Set(own.map((p) => p.id)).size, storeId).toBe(own.length);
      for (const p of own) {
        if (p.groupId) expect(ALL_GROUPS.find((g) => g.id === p.groupId)?.storeId, `${p.id} group`).toBe(storeId);
      }
    }
  });

  it("are the prompts a schedule and a run refer to", () => {
    for (const storeId of STORES) {
      const ids = new Set(ALL_PROMPTS.filter((p) => p.storeId === storeId).map((p) => p.id));
      const reg = registryFor(storeId);
      for (const run of [...reg.runs.map((r) => r.id), ...reg.audits.map((a) => a.id)]) {
        for (const r of buildRunResponses(run).filter((x) => x.storeId === storeId)) expect(ids.has(r.promptId), `${run} ${r.promptId}`).toBe(true);
      }
    }
  });
});

describe("findings and tasks", () => {
  it("point to an audit or run of the same website", () => {
    for (const storeId of STORES) {
      const reg = registryFor(storeId);
      const sources = new Set([...reg.audits.map((a) => a.id), ...reg.runs.map((r) => r.id)]);
      for (const f of DEMO_FINDINGS.filter((x) => x.storeId === storeId)) expect(sources.has(f.auditId), `${f.id} -> ${f.auditId}`).toBe(true);
    }
  });

  it("link tasks and findings both ways inside one website", () => {
    for (const storeId of STORES) {
      const findings = DEMO_FINDINGS.filter((f) => f.storeId === storeId);
      const tasks = registryFor(storeId).tasks;
      for (const t of tasks) {
        const f = findings.find((x) => x.id === t.findingId);
        expect(f, `${t.id} -> ${t.findingId}`).toBeDefined();
        expect(f!.taskIds, `${t.findingId} lists ${t.id}`).toContain(t.id);
      }
      for (const f of findings) for (const id of f.taskIds) expect(tasks.some((t) => t.id === id), `${f.id} lists ${id}`).toBe(true);
    }
  });

  it("agree with the website summary", async () => {
    for (const storeId of STORES) {
      const store = await getStore(storeId);
      const open = DEMO_FINDINGS.filter((f) => f.storeId === storeId && OPEN_FINDING_STATUSES.has(f.status)).length;
      const pending = registryFor(storeId).tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status)).length;
      const unread = DEMO_ALERTS.filter((a) => a.storeId === storeId && !a.read).length;
      if (store?.summary) {
        expect(store.summary.openFindings, `${storeId} findings`).toBe(open);
        expect(store.summary.pendingTasks, `${storeId} tasks`).toBe(pending);
        expect(store.summary.openAlerts, `${storeId} alerts`).toBe(unread);
      } else {
        expect([open, pending, unread], `${storeId} has no summary`).toEqual([0, 0, 0]);
      }
    }
  });

  it("count findings created by each audit", () => {
    for (const storeId of STORES) {
      for (const a of registryFor(storeId).audits) {
        const created = DEMO_FINDINGS.filter((f) => f.storeId === storeId && f.auditId === a.id).length;
        expect(created, `${a.id} findingsCreated`).toBeLessThanOrEqual(a.findingsCreated);
      }
    }
  });
});

describe("schedules, runs and alerts", () => {
  it("give every run an existing schedule of the same website", () => {
    for (const storeId of STORES) {
      const reg = registryFor(storeId);
      for (const run of reg.runs) expect(reg.schedules.some((s) => s.id === run.scheduleId), `${run.id} -> ${run.scheduleId}`).toBe(true);
    }
  });

  it("keep every alert on an existing website", () => {
    const ids = new Set(DEMO_STORES.map((s) => s.id));
    for (const a of DEMO_ALERTS) expect(ids.has(a.storeId), `${a.id} -> ${a.storeId}`).toBe(true);
  });

  it("keep runs in time order, one planned size per website", () => {
    for (const storeId of STORES) {
      const { runs, plannedJobsPerRun } = registryFor(storeId);
      const dates = runs.map((r) => r.scheduledFor);
      expect([...dates].sort(), storeId).toEqual(dates);
      for (const r of runs) {
        expect(r.succeededJobs + r.failedJobs, r.id).toBeLessThanOrEqual(r.plannedJobs);
        expect(r.plannedJobs, r.id).toBe(plannedJobsPerRun);
      }
    }
  });
});

describe("generated responses equal the registry", () => {
  const sources = STORES.flatMap((storeId) => [
    ...registryFor(storeId).runs.map((r) => ({ storeId, id: r.id, planned: r.plannedJobs, ok: r.succeededJobs, failed: r.failedJobs, mention: r.mention, recommendation: r.recommendation, complete: true })),
    ...registryFor(storeId).audits
      .filter((a) => a.lanes.includes("ai_visibility"))
      .map((a) => ({ storeId, id: a.id, planned: a.plannedJobs, ok: a.succeededJobs, failed: a.failedJobs, mention: a.mention, recommendation: a.recommendation, complete: a.status !== "in_progress" })),
  ]);

  it("have the succeeded and failed counts of each run and audit", () => {
    for (const s of sources.filter((x) => x.complete)) {
      const responses = buildRunResponses(s.id).filter((r) => r.storeId === s.storeId);
      expect(responses.filter((r) => r.status === "succeeded").length, `${s.id} succeeded`).toBe(s.ok);
      expect(responses.filter((r) => r.status === "failed").length, `${s.id} failed`).toBe(s.failed);
      expect(responses.length, `${s.id} requests`).toBe(s.ok + s.failed);
    }
  });

  it("have the mention and recommendation counts of each run and audit", () => {
    for (const s of sources.filter((x) => x.complete)) {
      const ok = buildRunResponses(s.id).filter((r) => r.storeId === s.storeId && r.status === "succeeded");
      if (s.mention) expect({ n: ok.filter((r) => r.brandMentioned === "yes").length, d: ok.length }, `${s.id} mention`).toEqual(s.mention);
      if (s.recommendation) expect({ n: ok.filter((r) => r.recommendation === "recommended").length, d: ok.length }, `${s.id} recommendation`).toEqual(s.recommendation);
    }
  });

  it("never classify a failed request as brand absent", () => {
    for (const s of sources) {
      for (const r of buildRunResponses(s.id).filter((x) => x.storeId === s.storeId && x.status === "failed")) {
        expect(r.outcome, r.id).toBe("failed");
        expect(r.brandMentioned, r.id).not.toBe("no");
        expect(r.failure, r.id).toBeDefined();
      }
    }
  });

  it("keep every rate whole with a numerator not above its denominator", async () => {
    for (const s of sources) {
      expect(rateOk(s.mention), `${s.id} mention`).toBe(true);
      expect(rateOk(s.recommendation), `${s.id} recommendation`).toBe(true);
    }
    for (const storeId of STORES) {
      const reg = registryFor(storeId);
      for (const a of reg.audits) expect(rateOk(a.pages), `${a.id} pages`).toBe(true);
      const summary = (await getStore(storeId))?.summary;
      if (summary) for (const r of [summary.mention, summary.mentionPrevious, summary.recommendation, summary.recommendationPrevious, summary.ownedCitation, summary.ownedCitationPrevious]) expect(rateOk(r), storeId).toBe(true);
      const dash = await getDashboardData(storeId);
      if (dash) {
        for (const t of dash.trend) expect(rateOk(t.mention) && rateOk(t.recommendation), `${storeId} ${t.runId}`).toBe(true);
        for (const c of dash.competitors) expect(rateOk({ n: c.n, d: c.d }), `${storeId} ${c.id}`).toBe(true);
      }
    }
  });

  it("show the latest run on the website summary", async () => {
    for (const storeId of STORES) {
      const runs = registryFor(storeId).runs;
      const summary = (await getStore(storeId))?.summary;
      if (!summary || runs.length === 0) continue;
      expect(summary.mention, storeId).toEqual(runs[runs.length - 1].mention);
      expect(summary.lastRunAt, storeId).toBe(runs[runs.length - 1].scheduledFor);
    }
  });
});

describe("comparisons and reports", () => {
  it("refer to snapshots that exist", () => {
    for (const storeId of STORES) {
      const reg = registryFor(storeId);
      const snapshots = new Set([...reg.audits.map((a) => a.snapshotId), ...reg.runs.map((r) => r.snapshotId)]);
      for (const c of reg.comparisons.filter((x) => x.type !== "period_vs_period")) {
        expect(snapshots.has(c.baseline), `${c.id} baseline ${c.baseline}`).toBe(true);
        expect(snapshots.has(c.current), `${c.id} current ${c.current}`).toBe(true);
      }
    }
  });

  it("have report sources that exist in the same website", async () => {
    for (const storeId of STORES) {
      const reg = registryFor(storeId);
      for (const r of registry.reports(storeId)) {
        const pool = r.type === "audit" ? reg.audits.map((a) => a.id) : r.type === "monitoring" ? reg.runs.map((x) => x.id) : reg.comparisons.map((c) => c.id);
        expect(pool, `${r.id} -> ${r.sourceId}`).toContain(r.sourceId);
      }
      const listed = await listReports(storeId);
      expect(listed.map((r) => r.id).sort(), storeId).toEqual(reg.reports.map((r) => r.id).sort());
    }
  });
});

describe("organization usage", () => {
  it("adds website usage up to the organization total and the billing seeds", () => {
    expect(sum(DEMO_USAGE.perStore.map((p) => p.requests))).toBe(DEMO_USAGE.requests);
    for (const row of DEMO_USAGE.perStore) {
      const seed = DEMO_USAGE_SEEDS.find((s) => s.websiteId === row.storeId);
      expect(sum(Object.values(seed?.requests ?? {})), row.storeId).toBe(row.requests);
      expect(row.requests, row.storeId).toBeLessThanOrEqual(row.cap);
    }
    expect(DEMO_USAGE.requests).toBeLessThanOrEqual(DEMO_USAGE.requestCap);
  });
});

describe("test coverage guard", () => {
  it("really checks the nutrition website", () => {
    const reg = registryFor("nutrition");
    expect(reg.runs).toHaveLength(6);
    expect(reg.audits).toHaveLength(5);
    expect(buildRunResponses("run-nu-006").length).toBe(42);
    expect(buildRunResponses("aud-nu-005").filter((r) => r.status === "failed")).toHaveLength(3);
  });
});

describe("nutrition dashboard", () => {
  it("has every part the Dashboard needs", async () => {
    const d = await getDashboardData("nutrition");
    expect(d).not.toBeNull();
    expect(d!.trend).toHaveLength(6);
    expect(d!.competitors.map((c) => c.name).sort()).toEqual(["BalancedBite", "GreenFork Guide", "NourishWell", "VitaPlate"]);
    expect(d!.alerts).toHaveLength(9);
    expect(d!.activity).toHaveLength(5);
    expect(d!.comparison).not.toBeNull();
    expect(d!.lastRun).toMatchObject({ id: "run-nu-006", succeededJobs: 42, plannedJobs: 42 });
    expect(d!.channelCount).toBe(3);
    expect(d!.prompts.filter((p) => p.status === "active")).toHaveLength(7);
    const times = d!.activity.map((a) => a.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});

describe("threadly coverage guard", () => {
  it("really checks the threadly website", () => {
    const reg = registryFor("threadly");
    expect(reg.runs).toHaveLength(6);
    expect(reg.audits).toHaveLength(5);
    expect(buildRunResponses("run-th-006").length).toBe(42);
    expect(buildRunResponses("aud-th-005").filter((r) => r.status === "failed")).toHaveLength(3);
  });
});

describe("threadly dashboard", () => {
  it("has every part the Dashboard needs", async () => {
    const d = await getDashboardData("threadly");
    expect(d).not.toBeNull();
    expect(d!.trend).toHaveLength(6);
    expect(d!.competitors.map((c) => c.name).sort()).toEqual(["Fieldstone Apparel", "Maison Alder", "Oakline", "Ravel & Co"]);
    expect(d!.alerts).toHaveLength(9);
    expect(d!.activity).toHaveLength(5);
    expect(d!.comparison).not.toBeNull();
    expect(d!.lastRun).toMatchObject({ id: "run-th-006", succeededJobs: 42, plannedJobs: 42 });
    expect(d!.channelCount).toBe(3);
    expect(d!.prompts.filter((p) => p.status === "active")).toHaveLength(7);
    const times = d!.activity.map((a) => a.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
