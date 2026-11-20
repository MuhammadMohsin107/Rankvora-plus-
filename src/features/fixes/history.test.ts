import { describe, expect, it } from "vitest";

import { eventLabel, historyKindOf, splitLabel, toHistoryEvent } from "./history";

describe("fixes history", () => {
  it("round-trips a label with detail", () => {
    expect(splitLabel(eventLabel("Approval rejected", "Wrong resource"))).toEqual({ title: "Approval rejected", detail: "Wrong resource" });
    expect(splitLabel("Task created")).toEqual({ title: "Task created" });
  });

  it("maps event kinds to history kinds", () => {
    expect(historyKindOf({ kind: "task.created", label: "x" })).toBe("created");
    expect(historyKindOf({ kind: "task.rolled_back", label: "x" })).toBe("rollback");
    expect(historyKindOf({ kind: "task.verified", label: "x" })).toBe("verification");
    expect(historyKindOf({ kind: "task.updated", label: "Draft v2 saved" })).toBe("draft");
    expect(historyKindOf({ kind: "task.updated", label: "Approval requested" })).toBe("approval");
    expect(historyKindOf({ kind: "task.updated", label: "Cancelled · reason" })).toBe("status");
  });

  it("builds a history entry", () => {
    const entry = toHistoryEvent({ id: "e1", at: "2026-11-19T09:00:00Z", kind: "task.applied", label: "Marked applied · done" }, "You");
    expect(entry).toMatchObject({ title: "Marked applied", detail: "done", kind: "execution", actor: "You" });
  });
});
