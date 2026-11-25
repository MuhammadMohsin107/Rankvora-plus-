import { describe, expect, it } from "vitest";

import { STORE_PROFILES } from "@/demo/prompts";
import { createDemoStore } from "@/demo-state/store";
import { profileSuggestionBatches } from "@/features/prompts/suggestions";

import { allowedMoves, currentTask, draftHeaderAction, draftReadyBlocker, nextLocalTaskId } from "./fixes-logic";

describe("the current task of a finding", () => {
  it("is the open task, even when an older finished one comes first", () => {
    expect(currentTask([{ id: "task-009", status: "cancelled" }, { id: "task-new-1", status: "suggested" }] as const)?.id).toBe("task-new-1");
  });

  it("is the open task even when a finished one was created after it", () => {
    expect(currentTask([{ id: "a", status: "in_progress" }, { id: "b", status: "cancelled" }] as const)?.id).toBe("a");
  });

  it("is the newest task once none is open, so a verified fix replaces the cancelled one", () => {
    expect(currentTask([{ id: "task-009", status: "cancelled" }, { id: "task-new-1", status: "verified_success" }] as const)?.id).toBe("task-new-1");
  });

  it("is nothing when there is no task", () => {
    expect(currentTask([])).toBeUndefined();
  });
});

describe("a drafted fix in progress", () => {
  it("offers to open the draft until it has been seen or saved", () => {
    expect(draftHeaderAction(false, false)).toBe("open_draft");
  });

  it("never offers 'Open draft' on the Draft tab", () => {
    expect(draftHeaderAction(true, false)).toBe("mark_ready");
    expect(draftHeaderAction(true, true)).toBe("mark_ready");
  });

  it("keeps offering 'Mark draft ready' on other tabs after a save", () => {
    expect(draftHeaderAction(false, true)).toBe("mark_ready");
  });

  it("blocks while generating, with unsaved edits, or with an empty draft", () => {
    expect(draftReadyBlocker({ generating: true, dirty: false, hasContent: true })).not.toBeNull();
    expect(draftReadyBlocker({ generating: false, dirty: true, hasContent: true })).toBe("Save the draft first.");
    expect(draftReadyBlocker({ generating: false, dirty: false, hasContent: false })).not.toBeNull();
    expect(draftReadyBlocker({ generating: false, dirty: false, hasContent: true })).toBeNull();
  });

  it("can reach Applied in every drafting mode once the draft is ready", () => {
    for (const mode of ["ai_draft", "cms_staged", "approved_apply"] as const) {
      expect(allowedMoves("in_progress", mode)).toContain("draft_ready");
    }
    expect(allowedMoves("draft_ready", "ai_draft")).toContain("applied");
  });
});

describe("ids of tasks made here", () => {
  it("starts at 1 and ignores other ids", () => {
    expect(nextLocalTaskId([])).toBe("task-new-1");
    expect(nextLocalTaskId(["task-001", "demo-tasks-8", "task-ae-002"])).toBe("task-new-1");
  });

  it("goes past the highest number ever used", () => {
    expect(nextLocalTaskId(["task-new-1", "task-new-10", "task-new-2"])).toBe("task-new-11");
  });

  it("gives each task of a bulk create its own id when read from the live store", () => {
    const store = createDemoStore({ storage: null, target: null });
    for (let i = 0; i < 3; i += 1) {
      const id = nextLocalTaskId(store.getSnapshot().tasks.created.map((row) => row.id));
      store.create("tasks", { id, title: `Task ${i}` });
    }
    expect(store.getSnapshot().tasks.created.map((row) => row.id)).toEqual(["task-new-1", "task-new-2", "task-new-3"]);
  });

  it("does not reuse the number of a task that only history still names", () => {
    const store = createDemoStore({ storage: null, target: null });
    store.create("tasks", { id: "task-new-1" }, { kind: "task.created", label: "Task created", refs: { taskId: "task-new-1" } });
    store.remove("tasks", "task-new-1");
    const state = store.getSnapshot();
    expect(nextLocalTaskId([...state.tasks.created.map((row) => row.id), ...state.events.flatMap((e) => (e.refs.taskId ? [e.refs.taskId] : []))])).toBe("task-new-2");
  });
});

describe("prompt suggestion wording", () => {
  it("says 'running shoe brands' for both RunPro websites", () => {
    for (const id of ["runpro-pk", "runpro-ae"] as const) {
      const profile = STORE_PROFILES[id];
      const texts = profileSuggestionBatches({ brand: "RunPro", competitor: "Brand X", market: "Pakistan", category: profile.category, brands: profile.brands ?? `${profile.category} brands`, item: profile.item, city: profile.city, need: profile.need })
        .flat()
        .map((s) => s.text);
      expect(texts.join(" ")).toContain("running shoe brands");
      expect(texts.join(" ")).not.toContain("shoes brands");
    }
  });
});
