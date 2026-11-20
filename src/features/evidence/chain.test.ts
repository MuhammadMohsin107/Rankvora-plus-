import { describe, expect, it } from "vitest";

import {
  EVIDENCE_KINDS,
  buildEvidenceChain,
  evidenceHref,
  mergeEvidenceEvents,
  metricLabel,
  missingEvidenceKinds,
  responseHref,
  runIdOfResponse,
  type EvidenceEventLike,
} from "./chain";

const S = "runpro-pk";

const full = {
  storeId: S,
  metricId: "mention-rate",
  sourceId: "run-008",
  promptId: "p-002",
  responseId: "resp-run-008-12",
  citation: "https://brandx.example/starter",
  findingId: "fnd-004",
  taskId: "task-007",
  verificationId: "aud-003",
  observationId: "p-002|ch-gemini",
  comparisonId: "cmp-003",
};

describe("buildEvidenceChain", () => {
  it("returns the nine kinds in chain order", () => {
    const chain = buildEvidenceChain(full);
    expect(chain.map((n) => n.kind)).toEqual([...EVIDENCE_KINDS]);
  });

  it("links every node to the route that owns the record", () => {
    const hrefs = Object.fromEntries(buildEvidenceChain(full).map((n) => [n.kind, n.href]));
    expect(hrefs.metric).toBe("/stores/runpro-pk/monitoring/runs/run-008");
    expect(hrefs.prompt).toBe("/stores/runpro-pk/prompts/p-002");
    expect(hrefs.response).toBe("/stores/runpro-pk/monitoring/runs/run-008?response=resp-run-008-12");
    expect(hrefs.citation).toBe("/stores/runpro-pk/monitoring/runs/run-008?response=resp-run-008-12&citation=https%3A%2F%2Fbrandx.example%2Fstarter");
    expect(hrefs.finding).toBe("/stores/runpro-pk/fixes/findings/fnd-004");
    expect(hrefs.fix).toBe("/stores/runpro-pk/fixes/tasks/task-007");
    expect(hrefs.verification).toBe("/stores/runpro-pk/audits/aud-003");
    expect(hrefs.observation).toBe("/stores/runpro-pk/monitoring/observations");
    expect(hrefs.comparison).toBe("/stores/runpro-pk/comparisons/cmp-003");
  });

  it("skips ids that do not exist and keeps the order", () => {
    const chain = buildEvidenceChain({ storeId: S, findingId: "fnd-001", taskId: "task-001", promptId: "p-005" });
    expect(chain.map((n) => n.kind)).toEqual(["prompt", "finding", "fix"]);
  });

  it("returns an empty chain when nothing is known and ignores blank ids", () => {
    expect(buildEvidenceChain({ storeId: S })).toEqual([]);
    expect(buildEvidenceChain({ storeId: S, promptId: "  " })).toEqual([]);
  });

  it("uses a readable default label, and a label override wins", () => {
    const chain = buildEvidenceChain({ ...full, labels: { prompt: "Best running shoes under 15,000" } });
    const byKind = Object.fromEntries(chain.map((n) => [n.kind, n.label]));
    expect(byKind.metric).toBe("Mention rate");
    expect(byKind.citation).toBe("brandx.example");
    expect(byKind.observation).toBe("p-002");
    expect(byKind.prompt).toBe("Best running shoes under 15,000");
    expect(byKind.finding).toBe("fnd-004");
  });

  it("is pure: the same ids give the same chain", () => {
    expect(buildEvidenceChain(full)).toEqual(buildEvidenceChain({ ...full }));
  });

  it("links a metric from an audit to that audit and from nowhere to the dashboard", () => {
    expect(evidenceHref("metric", "mention-rate", { storeId: S, sourceId: "aud-002" })).toBe("/stores/runpro-pk/audits/aud-002");
    expect(evidenceHref("metric", "mention-rate", { storeId: S })).toBe("/stores/runpro-pk");
  });

  it("links a response from an audit to its AI visibility page", () => {
    expect(responseHref(S, "resp-aud-002-4")).toBe("/stores/runpro-pk/audits/aud-002/ai-visibility?response=resp-aud-002-4");
  });

  it("falls back to the task when the verification id is not a run or audit", () => {
    expect(evidenceHref("verification", "manual", { storeId: S, taskId: "task-001" })).toBe("/stores/runpro-pk/fixes/tasks/task-001");
  });

  it("encodes ids so a hostile id cannot add path segments", () => {
    expect(evidenceHref("finding", "../x?y", { storeId: S })).toBe("/stores/runpro-pk/fixes/findings/..%2Fx%3Fy");
  });
});

describe("helpers", () => {
  it("parses the run id from a response id", () => {
    expect(runIdOfResponse("resp-run-ae-006-3")).toBe("run-ae-006");
    expect(runIdOfResponse("resp-aud-002-14")).toBe("aud-002");
    expect(runIdOfResponse("nope")).toBeNull();
  });

  it("names metrics", () => {
    expect(metricLabel("recommendation-rate")).toBe("Recommendation rate");
    expect(metricLabel("share_of_voice")).toBe("Share of voice");
  });

  it("lists the kinds a chain still lacks", () => {
    expect(missingEvidenceKinds({ storeId: S, findingId: "f", taskId: "t" })).toEqual(["metric", "prompt", "response", "citation", "verification", "observation", "comparison"]);
  });
});

const evt = (id: number, kind: string, refs: EvidenceEventLike["refs"], at = `2026-11-19T10:0${id}:00Z`): EvidenceEventLike => ({ id: `demo-evt-${id}`, at, kind, label: kind, refs });

describe("mergeEvidenceEvents", () => {
  const base = { storeId: S, findingId: "fnd-004", promptId: "p-002", sourceId: "run-008" };

  it("adds the task created locally for the finding", () => {
    const merged = mergeEvidenceEvents(base, [evt(1, "task.created", { findingId: "fnd-004", taskId: "demo-tasks-3", websiteId: S })]);
    expect(merged.ids.taskId).toBe("demo-tasks-3");
    expect(merged.localTaskIds).toEqual(["demo-tasks-3"]);
    expect(buildEvidenceChain(merged.ids).map((n) => n.kind)).toContain("fix");
  });

  it("keeps the seeded task id and follows later events by task id", () => {
    const ids = { ...base, taskId: "task-007" };
    const merged = mergeEvidenceEvents(ids, [
      evt(1, "task.created", { findingId: "fnd-004", taskId: "demo-tasks-3", websiteId: S }),
      evt(2, "task.verified", { taskId: "task-007", runId: "run-009", websiteId: S }),
      evt(3, "comparison.annotated", { taskId: "task-007", comparisonId: "cmp-001", websiteId: S }),
    ]);
    expect(merged.ids.taskId).toBe("task-007");
    expect(merged.ids.verificationId).toBe("run-009");
    expect(merged.ids.comparisonId).toBe("cmp-001");
    expect(merged.events.map((e) => e.kind)).toEqual(["task.created", "task.verified", "comparison.annotated"]);
  });

  it("never replaces an id the chain already has", () => {
    const merged = mergeEvidenceEvents({ ...base, verificationId: "aud-003" }, [evt(1, "task.verified", { findingId: "fnd-004", auditId: "aud-009", websiteId: S })]);
    expect(merged.ids.verificationId).toBe("aud-003");
  });

  it("ignores other findings and other websites", () => {
    const merged = mergeEvidenceEvents(base, [
      evt(1, "task.created", { findingId: "fnd-009", taskId: "demo-tasks-1", websiteId: S }),
      evt(2, "task.created", { findingId: "fnd-004", taskId: "demo-tasks-2", websiteId: "runpro-ae" }),
    ]);
    expect(merged.ids.taskId).toBeUndefined();
    expect(merged.events).toEqual([]);
  });

  it("orders events oldest first and does not mutate its input", () => {
    const events = [evt(2, "task.approved", { findingId: "fnd-004" }, "2026-11-19T10:05:00Z"), evt(1, "task.created", { findingId: "fnd-004", taskId: "demo-tasks-1" }, "2026-11-19T10:01:00Z")];
    const copy = JSON.stringify(events);
    const merged = mergeEvidenceEvents(base, events);
    expect(merged.events.map((e) => e.id)).toEqual(["demo-evt-1", "demo-evt-2"]);
    expect(JSON.stringify(events)).toBe(copy);
  });

  it("takes the run of a started run as the observation", () => {
    const merged = mergeEvidenceEvents({ ...base, taskId: "task-007" }, [evt(1, "run.started", { taskId: "task-007", runId: "demo-runs-2" })]);
    expect(merged.ids.observationId).toBe("demo-runs-2");
  });
});
