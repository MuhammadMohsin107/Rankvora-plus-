import { describe, expect, it } from "vitest";

import type { DemoEvent } from "@/demo-state";
import type { ActivityItem } from "@/types/core";

import { mergeActivity } from "./activity";

const authored: ActivityItem[] = [
  { id: "act-2", title: "Weekly run completed", detail: "run-008", at: "2026-11-17T05:12:00Z", tone: "warning", icon: "monitoring", websiteId: "runpro-pk" },
  { id: "act-ae-1", title: "Weekly run completed", detail: "run-ae-006", at: "2026-11-18T05:22:00Z", tone: "success", icon: "monitoring", websiteId: "runpro-ae" },
];
const ev = (id: string, kind: DemoEvent["kind"], at: string, refs: DemoEvent["refs"]): DemoEvent => ({ id, kind, label: kind, at, refs, simulated: true });

describe("mergeActivity", () => {
  it("orders authored and local items together, newest first", () => {
    const events = [ev("e1", "website.created", "2026-11-19T10:00:00Z", { websiteId: "demo-websites-1" })];
    expect(mergeActivity(authored, events).map((i) => i.id)).toEqual(["e1", "act-ae-1", "act-2"]);
  });

  it("filters to one website and finds the website through a task id", () => {
    const events = [
      ev("e1", "task.created", "2026-11-19T10:00:00Z", { websiteId: "runpro-pk", taskId: "demo-tasks-9" }),
      ev("e2", "task.approved", "2026-11-19T10:05:00Z", { taskId: "demo-tasks-9" }),
      ev("e3", "alert.read", "2026-11-19T10:06:00Z", { websiteId: "runpro-pk" }),
    ];
    const items = mergeActivity(authored, events, { websiteId: "runpro-pk" });
    expect(items.map((i) => i.id)).toEqual(["e2", "e1", "act-2"]);
  });
});
