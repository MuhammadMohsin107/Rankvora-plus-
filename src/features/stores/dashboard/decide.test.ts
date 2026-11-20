import { describe, expect, it } from "vitest";

import { biggestProblem, changeInWindow, nextAction, runsInWindow, type FindingLike, type TaskLike, type TrendRun } from "./decide";

const run = (id: string, date: string, m: [number, number], r: [number, number]): TrendRun => ({ runId: id, date: `${date}T04:00:00Z`, mention: { n: m[0], d: m[1] }, recommendation: { n: r[0], d: r[1] } });
const RUNS = [
  run("run-001", "2026-09-29", [19, 46], [7, 46]),
  run("run-004", "2026-10-20", [22, 48], [9, 48]),
  run("run-007", "2026-11-10", [24, 48], [10, 48]),
  run("run-008", "2026-11-17", [25, 48], [11, 48]),
];

describe("dashboard date window", () => {
  it("filters the trend to the selected days", () => {
    expect(runsInWindow(RUNS, "2026-11-13", "2026-11-19").map((r) => r.runId)).toEqual(["run-008"]);
    expect(runsInWindow(RUNS, "2026-10-21", "2026-11-19").map((r) => r.runId)).toEqual(["run-007", "run-008"]);
    expect(runsInWindow(RUNS, "2026-08-01", "2026-11-19")).toHaveLength(4);
  });

  it("compares the latest run in the window with the last run before it", () => {
    const change = changeInWindow(RUNS, "2026-10-21", "2026-11-19");
    expect(change?.basis).toBe("before");
    expect(change?.baseline.runId).toBe("run-004");
    expect(change?.current.runId).toBe("run-008");
  });

  it("falls back to the first run in the window, and to nothing for a single run", () => {
    expect(changeInWindow(RUNS, "2026-08-01", "2026-11-19")).toMatchObject({ basis: "first", baseline: { runId: "run-001" } });
    expect(changeInWindow([RUNS[0]], "2026-08-01", "2026-11-19")).toBeNull();
    expect(changeInWindow(RUNS, "2026-12-01", "2026-12-31")).toBeNull();
  });
});

const f = (id: string, priority: FindingLike["priority"], severity: FindingLike["severity"], status = "confirmed"): FindingLike => ({ id, title: id, priority, severity, status });

describe("biggest problem and next action", () => {
  it("picks the open finding with the highest priority, then severity, and ignores closed ones", () => {
    const list = [f("a", "P2", "high"), f("b", "P1", "medium"), f("c", "P1", "high"), f("d", "P0", "critical", "verified_resolved")];
    expect(biggestProblem(list)?.id).toBe("c");
    expect(biggestProblem([f("d", "P0", "critical", "verified_resolved")])).toBeNull();
  });

  it("asks for a waiting approval first, then failed fixes, then a finding without a task", () => {
    const base = "/stores/x";
    const findings = [f("fnd-1", "P1", "high"), f("fnd-2", "P2", "low")];
    const tasks: TaskLike[] = [
      { id: "t1", title: "Fix one", status: "pending_approval", findingId: "fnd-1", priority: "P1" },
      { id: "t2", title: "Fix two", status: "failed", findingId: "fnd-2", priority: "P0" },
    ];
    expect(nextAction({ base, findings, tasks, auditInProgress: null })).toMatchObject({ kind: "approve", href: "/stores/x/fixes/tasks/t1" });
    expect(nextAction({ base, findings, tasks: [tasks[1]], auditInProgress: null }).kind).toBe("failed");
    expect(nextAction({ base, findings, tasks: [], auditInProgress: null })).toMatchObject({ kind: "finding", href: "/stores/x/fixes/findings/fnd-1" });
    expect(nextAction({ base, findings: [], tasks: [], auditInProgress: { id: "aud-4", title: "Full audit" } }).kind).toBe("audit");
    expect(nextAction({ base, findings: [], tasks: [], auditInProgress: null }).kind).toBe("none");
  });
});
