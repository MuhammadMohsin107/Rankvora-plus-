import { describe, expect, it } from "vitest";

import { createDemoStore } from "@/demo-state/store";
import type { PromptBase } from "@/types/core";
import type { StoredPrompt } from "@/types/prompts";

import { previewImport } from "./import-parse";
import {
  buildPromptRow,
  canChangeStatus,
  combineVersions,
  mergePrompts,
  planImport,
  planState,
  selectActivePrompts,
  statusPatch,
  summarize,
  wordingPatch,
} from "./prompt-ops";

const AT = "2026-11-19T10:00:00Z";
const ctx = { brand: "RunPro", actor: "Sana Iqbal", at: AT };

const staticPrompt = (id: string, extra: Partial<PromptBase> = {}): StoredPrompt => ({
  id,
  storeId: "runpro-pk",
  text: `What are the best running shoes (${id})?`,
  intent: "discovery",
  topic: "Category",
  groupId: null,
  status: "active",
  scope: "both",
  source: "manual",
  version: 1,
  isCore: false,
  mentionsBrand: false,
  updatedAt: "2026-08-06T08:30:00Z",
  market: "PK",
  language: "en",
  productIds: [],
  createdAt: "2026-08-06T08:30:00Z",
  createdBy: "Sana Iqbal",
  ...extra,
});

const input = { text: "Which running shoes suit flat feet?", intent: "recommendation" as const, topic: "Fit", groupId: null, market: "PK", language: "en", scope: "both" as const, status: "draft" as const, productIds: [], isCore: false, source: "manual" as const };

describe("merge of static and local prompts", () => {
  it("returns the static prompts while nothing changed", () => {
    const base = [staticPrompt("p-001"), staticPrompt("p-002")];
    const store = createDemoStore({ storage: null, target: null, now: () => AT });
    expect(mergePrompts(base, store.getSnapshot().prompts as never, "runpro-pk")).toEqual(base);
  });

  it("appends created prompts, applies patches and keeps websites apart", () => {
    const base = [staticPrompt("p-001"), staticPrompt("p-002")];
    const store = createDemoStore({ storage: null, target: null, now: () => AT });
    const mine = store.create("prompts", buildPromptRow("runpro-pk", input, ctx));
    store.create("prompts", buildPromptRow("runpro-ae", { ...input, text: "Another website prompt about shoes" }, ctx));
    store.update("prompts", "p-002", { status: "paused" });
    const merged = mergePrompts(base, store.getSnapshot().prompts as never, "runpro-pk");
    expect(merged.map((p) => p.id)).toEqual(["p-001", "p-002", mine.id]);
    expect(merged.find((p) => p.id === "p-002")?.status).toBe("paused");
    expect(mine.id).toMatch(/^demo-prompts-\d+$/);
    expect(selectActivePrompts(merged).map((p) => p.id)).toEqual(["p-001"]);
  });

  it("hides a removed static prompt", () => {
    const base = [staticPrompt("p-001"), staticPrompt("p-002")];
    const store = createDemoStore({ storage: null, target: null, now: () => AT });
    store.remove("prompts", "p-001");
    expect(mergePrompts(base, store.getSnapshot().prompts as never, "runpro-pk").map((p) => p.id)).toEqual(["p-002"]);
  });
});

describe("new prompts", () => {
  it("starts at version 1 with the brand flag derived from the wording", () => {
    const row = buildPromptRow("runpro-pk", { ...input, text: "Is RunPro good for beginners?" }, ctx);
    expect(row.version).toBe(1);
    expect(row.mentionsBrand).toBe(true);
    expect(row.localVersions).toHaveLength(1);
    expect(row.createdBy).toBe("Sana Iqbal");
    expect(buildPromptRow("runpro-pk", input, ctx).mentionsBrand).toBe(false);
  });
});

describe("version bump on edit", () => {
  it("creates version n + 1 and keeps the earlier ones", () => {
    const row = { ...staticPrompt("p-003", { version: 3 }), localVersions: undefined };
    const patch = wordingPatch(row, "  Is RunPro better for beginners? ", "Clarified", ctx);
    expect(patch.version).toBe(4);
    expect(patch.text).toBe("Is RunPro better for beginners?");
    expect(patch.mentionsBrand).toBe(true);
    expect(patch.localVersions?.[0]).toMatchObject({ version: 4, note: "Clarified", changedBy: "Sana Iqbal", runs: 0 });

    const second = wordingPatch({ ...row, ...patch } as StoredPrompt, "Is RunPro better for new runners?", null, ctx);
    expect(second.version).toBe(5);
    expect(second.localVersions?.map((v) => v.version)).toEqual([5, 4]);

    const staticVersions = [3, 2, 1].map((version) => ({ version, text: `v${version}`, changedBy: "x", changedAt: AT, note: null, runs: 1 }));
    expect(combineVersions(staticVersions, second.localVersions).map((v) => v.version)).toEqual([5, 4, 3, 2, 1]);
  });

  it("logs status changes and only allows restoring archived prompts as drafts", () => {
    const row = staticPrompt("p-004");
    expect(statusPatch(row, "paused", ctx)).toMatchObject({ status: "paused", updatedAt: AT });
    expect(canChangeStatus("active", "active")).toBe(false);
    expect(canChangeStatus("archived", "active")).toBe(false);
    expect(canChangeStatus("archived", "draft")).toBe(true);
    expect(canChangeStatus("paused", "active")).toBe(true);
  });
});

describe("CSV import parsing", () => {
  const defaults = { language: "en", market: "PK", groups: [{ id: "g-1", name: "Discovery" }], existing: [{ id: "p-001", text: "What are the best running shoe brands?" }] };
  const csv = [
    "prompt_text,intent,topic,group,language,country,status,tracking_scope,is_core",
    '"Which running shoes suit flat feet?",recommendation,Fit,Discovery,en,PK,draft,both,true',
    '"What are the best running shoe brands?",discovery,,,,,,,',
    '"Compare RunPro and Brand X for marathons",comparison,Marathon,Marathon plans,en,,active,monitoring,false',
    '"Too short",banana,,,,,,,',
  ].join("\n");

  it("sorts rows into create, duplicate and invalid", () => {
    const preview = previewImport(csv, defaults);
    expect(preview.fileError).toBeNull();
    expect(preview.rows.map((r) => r.result)).toEqual(["create", "duplicate", "create", "invalid"]);
    expect(preview.rows[3].notes.join(" ")).toMatch(/Unknown intent/);
  });

  it("plans only the rows that will be created, with new groups", () => {
    const plan = planImport(previewImport(csv, defaults).rows, defaults.groups, { market: "PK", language: "en" });
    expect(plan.inputs).toHaveLength(2);
    expect(plan.newGroups).toEqual(["Marathon plans"]);
    expect(plan.inputs[0]).toMatchObject({ groupId: "g-1", isCore: true, market: "PK", source: "imported", status: "draft" });
    expect(plan.inputs[1]).toMatchObject({ groupId: null, groupName: "Marathon plans", scope: "monitoring", status: "active" });
  });

  it("rejects a file without the prompt_text column", () => {
    expect(previewImport("text\nhello there friend", defaults).fileError).toMatch(/prompt_text/);
  });
});

describe("library summary", () => {
  it("counts statuses and neutral coverage among active prompts", () => {
    const s = summarize([
      { status: "active", mentionsBrand: false, isCore: true },
      { status: "active", mentionsBrand: true, isCore: false },
      { status: "paused", mentionsBrand: false, isCore: true },
      { status: "draft", mentionsBrand: false, isCore: false },
    ]);
    expect(s).toMatchObject({ total: 4, active: 2, paused: 1, draft: 1, archived: 0, neutral: 1, brandSpecific: 1, core: 1 });
    expect(planState(10).state).toBe("ok");
    expect(planState(128).state).toBe("near");
    expect(planState(150).state).toBe("full");
  });
});
