import { describe, expect, it } from "vitest";

import { TASK_STATUSES } from "@/types/fixes";

import {
  allowedMoves,
  applyFindingReview,
  canCreateTask,
  deriveVerification,
  findingReviewActions,
  findingStatusForTask,
  needsReason,
  reachableStatuses,
  simulateApply,
} from "./fixes-logic";

describe("task transitions", () => {
  it("has exactly 18 statuses", () => {
    expect(TASK_STATUSES).toHaveLength(18);
    expect(new Set(TASK_STATUSES).size).toBe(18);
  });

  it("reaches every status from suggested", () => {
    const reached = reachableStatuses("suggested");
    for (const status of TASK_STATUSES) expect(reached.has(status), status).toBe(true);
  });

  it("never lets a person set a verification outcome by hand", () => {
    for (const status of TASK_STATUSES) {
      for (const mode of ["guidance", "ai_draft", "cms_staged", "approved_apply"] as const) {
        const moves = allowedMoves(status, mode);
        expect(moves).not.toContain("verified_success");
        expect(moves).not.toContain("partially_verified");
        expect(moves).not.toContain("failed");
      }
    }
  });

  it("allows cancel and supersede before work is written, not after", () => {
    expect(allowedMoves("in_progress", "approved_apply")).toEqual(expect.arrayContaining(["cancelled", "superseded"]));
    expect(allowedMoves("applied", "approved_apply")).not.toContain("cancelled");
    expect(allowedMoves("published", "approved_apply")).not.toContain("superseded");
    expect(allowedMoves("applied", "approved_apply")).toContain("rolled_back");
  });

  it("keeps verified and superseded terminal and lets cancelled reopen", () => {
    expect(allowedMoves("verified_success", "ai_draft")).toEqual([]);
    expect(allowedMoves("superseded", "ai_draft")).toEqual([]);
    expect(allowedMoves("cancelled", "ai_draft")).toEqual(["suggested"]);
  });

  it("filters moves by execution mode", () => {
    expect(allowedMoves("in_progress", "guidance")).toContain("applied");
    expect(allowedMoves("in_progress", "guidance")).not.toContain("draft_ready");
    expect(allowedMoves("draft_ready", "ai_draft")).toContain("applied");
    expect(allowedMoves("draft_ready", "ai_draft")).not.toContain("staged");
  });

  it("asks for a reason on reject, cancel, supersede and rollback", () => {
    for (const s of ["rejected", "cancelled", "superseded", "rolled_back"] as const) expect(needsReason(s)).toBe(true);
    expect(needsReason("approved")).toBe(false);
  });
});

describe("finding status machine", () => {
  it("offers review actions by status", () => {
    expect(findingReviewActions("new")).toEqual(["confirm", "false_positive", "accept_risk"]);
    expect(findingReviewActions("false_positive")).toEqual(["reopen"]);
    expect(findingReviewActions("verified_resolved")).toEqual(["reopen"]);
    expect(findingReviewActions("awaiting_verification")).toEqual([]);
  });

  it("applies and refuses review actions", () => {
    expect(applyFindingReview("new", "confirm")).toBe("confirmed");
    expect(applyFindingReview("confirmed", "false_positive")).toBe("false_positive");
    expect(applyFindingReview("accepted_risk", "reopen")).toBe("reopened");
    expect(applyFindingReview("confirmed", "reopen")).toBeNull();
    expect(applyFindingReview("verified_resolved", "confirm")).toBeNull();
  });

  it("allows a task only while the finding is open", () => {
    expect(canCreateTask("confirmed")).toBe(true);
    expect(canCreateTask("reopened")).toBe(true);
    expect(canCreateTask("false_positive")).toBe(false);
    expect(canCreateTask("verified_resolved")).toBe(false);
  });

  it("follows the task: applied is awaiting verification, never resolved", () => {
    const base = { cause: "write", otherOpenTask: false } as const;
    expect(findingStatusForTask({ ...base, finding: "confirmed", task: "suggested" })).toBe("in_remediation");
    expect(findingStatusForTask({ ...base, finding: "in_remediation", task: "applied" })).toBe("awaiting_verification");
    expect(findingStatusForTask({ ...base, finding: "in_remediation", task: "published" })).toBe("awaiting_verification");
    expect(findingStatusForTask({ ...base, finding: "awaiting_verification", task: "rolled_back" })).toBe("in_remediation");
  });

  it("verification outcomes set the finding", () => {
    const base = { cause: "verification", otherOpenTask: false } as const;
    expect(findingStatusForTask({ ...base, finding: "awaiting_verification", task: "verified_success" })).toBe("verified_resolved");
    expect(findingStatusForTask({ ...base, finding: "awaiting_verification", task: "partially_verified" })).toBe("in_remediation");
    expect(findingStatusForTask({ ...base, finding: "awaiting_verification", task: "failed" })).toBe("reopened");
  });

  it("a failed write does not reopen the finding", () => {
    expect(findingStatusForTask({ finding: "in_remediation", task: "failed", cause: "write", otherOpenTask: false })).toBeNull();
  });

  it("cancelling the only open task returns the finding to confirmed", () => {
    expect(findingStatusForTask({ finding: "in_remediation", task: "cancelled", cause: "write", otherOpenTask: false })).toBe("confirmed");
    expect(findingStatusForTask({ finding: "in_remediation", task: "cancelled", cause: "write", otherOpenTask: true })).toBeNull();
  });

  it("does not touch a finding a person closed", () => {
    expect(findingStatusForTask({ finding: "false_positive", task: "applied", cause: "write", otherOpenTask: false })).toBeNull();
  });
});

describe("simulated apply", () => {
  const items = [
    { id: "a", result: "ready" as const },
    { id: "b", result: "ready" as const },
    { id: "c", result: "excluded" as const },
    { id: "d", result: "conflict" as const },
  ];

  it("fails the last ready item on the first attempt", () => {
    const r = simulateApply(items, 0);
    expect(r.results).toEqual({ a: "applied", b: "failed", c: "excluded", d: "conflict" });
    expect(r.failed).toEqual(["b"]);
  });

  it("applies a single ready item", () => {
    expect(simulateApply([{ id: "a", result: "ready" }], 0).results.a).toBe("applied");
  });

  it("retries only the failed item", () => {
    const retry = simulateApply([{ id: "a", result: "applied" }, { id: "b", result: "failed" }], 1);
    expect(retry.results).toEqual({ a: "applied", b: "applied" });
  });
});

describe("simulated verification", () => {
  const planned = [
    { id: "c1", label: "One", expect: "Present" },
    { id: "c2", label: "Two", expect: "Present" },
    { id: "c3", label: "Three", expect: "Present" },
  ];
  const base = { planned, category: "technical" as const, ranAt: "2026-11-19T09:00:00Z", sourceLabel: "Simulated re-check" };

  it("success passes every check", () => {
    const o = deriveVerification({ ...base, result: "verified_success" });
    expect(o.checks.every((c) => c.after.status === "pass")).toBe(true);
  });

  it("partial passes the first half and leaves the rest inconclusive", () => {
    const o = deriveVerification({ ...base, result: "partially_verified" });
    expect(o.checks.map((c) => c.after.status)).toEqual(["pass", "pass", "inconclusive"]);
  });

  it("failed fails every check", () => {
    const o = deriveVerification({ ...base, result: "failed" });
    expect(o.checks.every((c) => c.after.status === "fail")).toBe(true);
    expect(o.findingEffect).toMatch(/reopened/i);
  });
});
