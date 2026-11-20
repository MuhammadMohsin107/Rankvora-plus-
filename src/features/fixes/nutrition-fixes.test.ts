import { describe, expect, it } from "vitest";

import { FINDING_EXTRAS, RECOMMENDATIONS, TASK_DETAILS, TASK_SUMMARY_EXTRAS } from "@/demo/fixes";
import { REGISTRY_NU_TASKS } from "@/demo/registry";
import { buildRunResponses, DEMO_FINDINGS } from "@/demo/shared-records";

const NOW = Date.parse("2026-11-19T09:00:00Z");
const MEMBERS = ["Sana Iqbal", "Omar Farooq", "Hira Malik", "Bilal Ahmed", "Zoya Khan"];
const findings = DEMO_FINDINGS.filter((f) => f.storeId === "nutrition");

describe("nutrition fixes data", () => {
  it("has a detail record and a recommendation for every registry task", () => {
    expect(REGISTRY_NU_TASKS).toHaveLength(8);
    for (const task of REGISTRY_NU_TASKS) {
      const detail = TASK_DETAILS[task.id];
      expect(detail, task.id).toBeTruthy();
      const finding = findings.find((f) => f.id === task.findingId);
      expect(finding, `${task.id} finding`).toBeTruthy();
      expect(finding?.taskIds).toContain(task.id);
      expect(FINDING_EXTRAS[task.findingId], `${task.findingId} extras`).toBeTruthy();
      const rec = RECOMMENDATIONS.find((r) => r.id === detail.recommendationId);
      expect(rec, `${task.id} recommendation`).toBeTruthy();
      expect(rec?.findingId).toBe(task.findingId);
      expect(rec?.taskId).toBe(task.id);
      expect(TASK_SUMMARY_EXTRAS[task.id], `${task.id} blockers`).toBeTruthy();
    }
  });

  it("resolves every evidence reference to a real page, prompt or response", () => {
    for (const finding of findings) {
      const extras = FINDING_EXTRAS[finding.id];
      expect(extras.evidence.length, finding.id).toBeGreaterThan(0);
      for (const spec of extras.evidence) {
        if (spec.kind === "response") {
          const runId = spec.responseId.replace(/^resp-/, "").replace(/-\d+$/, "");
          expect(buildRunResponses(runId).some((r) => r.id === spec.responseId), spec.responseId).toBe(true);
        }
        if (spec.kind === "prompt") expect(spec.promptId).toMatch(/^p-nu-00\d$/);
        if (spec.kind === "page") expect(spec.url.startsWith("https://nutrition.example")).toBe(true);
      }
      const ids = new Set(extras.evidence.map((e) => e.id));
      for (const rec of RECOMMENDATIONS.filter((r) => r.findingId === finding.id)) for (const id of rec.evidenceIds) expect(ids.has(id), `${rec.id} ${id}`).toBe(true);
    }
  });

  it("keeps every date inside the story timeline and in order", () => {
    for (const task of REGISTRY_NU_TASKS) {
      const detail = TASK_DETAILS[task.id];
      const finding = findings.find((f) => f.id === task.findingId)!;
      const first = Date.parse(finding.firstDetectedAt);
      const stamps = detail.history.map((h) => Date.parse(h.at));
      expect(stamps, task.id).toEqual([...stamps].sort((a, b) => a - b));
      for (const at of stamps) {
        expect(at, task.id).toBeLessThanOrEqual(NOW);
        expect(at, task.id).toBeGreaterThanOrEqual(first);
      }
      const e = detail.execution;
      for (const at of [e.completedAt, e.stagedAt, e.appliedAt, e.publishedAt, e.remote?.checkedAt, detail.approval.requestedAt, detail.approval.decidedAt, detail.verification.outcome?.ranAt]) {
        if (!at) continue;
        expect(Date.parse(at), `${task.id} ${at}`).toBeLessThanOrEqual(NOW);
        expect(Date.parse(at), `${task.id} ${at}`).toBeGreaterThanOrEqual(first);
      }
      for (const ob of FINDING_EXTRAS[finding.id].observations) {
        expect(Date.parse(ob.at), `${finding.id} ${ob.id}`).toBeGreaterThanOrEqual(first);
        expect(Date.parse(ob.at), `${finding.id} ${ob.id}`).toBeLessThanOrEqual(NOW);
      }
      // write stages are ordered: staged <= applied <= published <= verification
      const order = [e.stagedAt, e.appliedAt, e.publishedAt, detail.verification.outcome?.ranAt].filter((x): x is string => Boolean(x)).map((x) => Date.parse(x));
      expect(order, task.id).toEqual([...order].sort((a, b) => a - b));
      // people are existing members
      for (const name of [task.assignee, detail.createdBy, detail.approval.requestedBy, detail.approval.decidedBy].filter(Boolean)) expect(MEMBERS).toContain(name);
    }
  });

  it("shows only the stages each task status implies", () => {
    const d = (id: string) => TASK_DETAILS[id];
    const stage = (id: string) => ({ staged: d(id).execution.stagedAt, applied: d(id).execution.appliedAt, published: d(id).execution.publishedAt, outcome: d(id).verification.outcome });

    // draft ready, pending approval, suggested, cancelled: nothing written
    for (const id of ["task-nu-001", "task-nu-002", "task-nu-006", "task-nu-008"]) {
      expect(stage(id), id).toEqual({ staged: null, applied: null, published: null, outcome: null });
    }
    expect(d("task-nu-002").approval.state).toBe("pending");
    expect(d("task-nu-002").approval.decidedAt).toBeUndefined();
    expect(d("task-nu-001").approval.state).toBe("not_required");

    // applied, not published, not verified
    const t7 = stage("task-nu-007");
    expect(t7.applied).toBeTruthy();
    expect(t7.published).toBeNull();
    expect(t7.outcome).toBeNull();
    expect(d("task-nu-007").execution.cmsState).toBe("applied");

    // published, awaiting verification
    const t5 = stage("task-nu-005");
    expect(t5.published).toBe("2026-11-17T02:25:00Z");
    expect(t5.outcome).toBeNull();

    // applied -> published -> verified success by aud-nu-004 on 16 Nov
    const t3 = stage("task-nu-003");
    expect(Date.parse(t3.applied!)).toBeLessThan(Date.parse(t3.published!));
    expect(t3.outcome?.result).toBe("verified_success");
    expect(t3.outcome?.sourceHref).toBe("audits/aud-nu-004");
    expect(t3.outcome?.ranAt.startsWith("2026-11-16")).toBe(true);
    expect(d("task-nu-003").approval.state).toBe("approved");
    expect(d("task-nu-003").approval.diffHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("task-nu-004 is partially verified: 4 of 6 pages, two failures with reasons", () => {
    const detail = TASK_DETAILS["task-nu-004"];
    const outcome = detail.verification.outcome!;
    expect(outcome.result).toBe("partially_verified");
    expect(outcome.checks).toHaveLength(6);
    expect(outcome.checks.filter((c) => c.after.status === "pass")).toHaveLength(4);
    const failed = outcome.checks.filter((c) => c.after.status === "fail");
    expect(failed).toHaveLength(2);
    for (const c of failed) expect(c.after.detail.length).toBeGreaterThan(20);
    expect(detail.draft.kind === "batch" && detail.draft.items.length).toBe(6);
  });

  it("task-nu-008 is cancelled with a reason; task-nu-006 is guidance only and unassigned", () => {
    expect(TASK_DETAILS["task-nu-008"].cancellation?.reason.length).toBeGreaterThan(20);
    const t6 = TASK_DETAILS["task-nu-006"];
    expect(t6.draft.kind).toBe("guidance");
    expect(t6.execution.cmsState).toBe("guidance");
    expect(t6.execution.fields).toEqual([]);
    expect(REGISTRY_NU_TASKS.find((t) => t.id === "task-nu-006")?.assignee).toBeNull();
  });

  it("uses generic CMS wording and no Shopify copy", () => {
    const text = JSON.stringify([
      REGISTRY_NU_TASKS.map((t) => TASK_DETAILS[t.id]),
      findings.map((f) => FINDING_EXTRAS[f.id]),
      RECOMMENDATIONS.filter((r) => r.findingId.startsWith("fnd-nu-")),
    ]);
    expect(text).not.toMatch(/shopify|myshopify|liquid|woocommerce/i);
    for (const t of REGISTRY_NU_TASKS) {
      const c = TASK_DETAILS[t.id].execution.connector;
      if (c) {
        expect(c.site).toBe("nutrition.example");
        expect(c.scopesRequired.every((s) => c.scopesGranted.includes(s))).toBe(true);
      }
    }
  });
});
