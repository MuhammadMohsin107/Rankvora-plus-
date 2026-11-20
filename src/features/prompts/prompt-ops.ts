/**
 * Pure prompt operations for the local demo state: build a new prompt, edit wording (new version),
 * change status or tracking, merge versions and activity, summarise a library. No React, no clock:
 * callers pass `at` (an ISO time taken inside an event handler).
 */
import { applyOverlay } from "@/demo-state/merge";
import type { CollectionOverlay } from "@/demo-state/types";
import type { PromptBase, PromptIntent, PromptScope, PromptSource, PromptStatus } from "@/types/core";
import type { PromptActivityItem, PromptVersion, StoredPrompt } from "@/types/prompts";

import type { ImportRow } from "./import-parse";
import { namesBrand } from "./text";

/** What the create flows collect. Everything else is derived. */
export type NewPromptInput = {
  text: string;
  intent: PromptIntent;
  topic: string;
  groupId: string | null;
  market: string;
  language: string;
  scope: PromptScope;
  status: Extract<PromptStatus, "draft" | "active" | "paused">;
  productIds: string[];
  isCore: boolean;
  source: PromptSource;
};

export type OpContext = { brand: string; actor: string; at: string };

const activity = (prompt: Pick<StoredPrompt, "id" | "localActivity">, ctx: OpContext, title: string, kind: PromptActivityItem["kind"], detail?: string): PromptActivityItem => ({
  id: `${prompt.id}-local-${(prompt.localActivity?.length ?? 0) + 1}`,
  at: ctx.at,
  actor: ctx.actor,
  title,
  kind,
  detail,
});

/** A new prompt row (without id). Version 1, brand-specific flag derived from the wording. */
export function buildPromptRow(storeId: string, input: NewPromptInput, ctx: OpContext): Omit<StoredPrompt, "id"> {
  const text = input.text.trim();
  const base = {
    storeId,
    text,
    intent: input.intent,
    topic: input.topic.trim(),
    groupId: input.groupId,
    status: input.status,
    scope: input.scope,
    source: input.source,
    version: 1,
    isCore: input.isCore,
    mentionsBrand: namesBrand(text, ctx.brand),
    updatedAt: ctx.at,
    market: input.market,
    language: input.language,
    productIds: input.productIds,
    createdAt: ctx.at,
    createdBy: ctx.actor,
  };
  const created: PromptActivityItem = { id: "created", at: ctx.at, actor: ctx.actor, title: input.source === "manual" ? "Created" : `Added · ${SOURCE_ACTIVITY[input.source]}`, kind: "created" };
  const versions: PromptVersion[] = [{ version: 1, text, changedBy: ctx.actor, changedAt: ctx.at, note: null, runs: 0 }];
  return { ...base, localVersions: versions, localActivity: [created] };
}

const SOURCE_ACTIVITY: Record<PromptSource, string> = {
  manual: "Manual",
  ai_generated: "Demo suggestion",
  imported: "CSV import",
  research_derived: "Research",
  template: "Template",
};

/** The fields to patch when the wording changes: a new version, the previous ones stay. */
export function wordingPatch(prompt: StoredPrompt, text: string, note: string | null, ctx: OpContext): Partial<StoredPrompt> {
  const next = prompt.version + 1;
  const trimmed = text.trim();
  const version: PromptVersion = { version: next, text: trimmed, changedBy: ctx.actor, changedAt: ctx.at, note, runs: 0 };
  return {
    text: trimmed,
    version: next,
    mentionsBrand: namesBrand(trimmed, ctx.brand),
    updatedAt: ctx.at,
    localVersions: [version, ...(prompt.localVersions ?? [])],
    localActivity: [...(prompt.localActivity ?? []), activity(prompt, ctx, `Wording changed · v${next}`, "version", note ?? undefined)],
  };
}

const STATUS_LOG: Record<PromptStatus, string> = { active: "Activated", paused: "Paused", draft: "Restored as draft", archived: "Archived" };

/** A prompt can move to any status except its own; an archived prompt can only be restored as a draft. */
export function canChangeStatus(current: PromptStatus, next: PromptStatus): boolean {
  if (current === next) return false;
  return current !== "archived" || next === "draft";
}

export function statusPatch(prompt: StoredPrompt, status: PromptStatus, ctx: OpContext): Partial<StoredPrompt> {
  return { status, updatedAt: ctx.at, localActivity: [...(prompt.localActivity ?? []), activity(prompt, ctx, STATUS_LOG[status], "status")] };
}

export function groupPatch(prompt: StoredPrompt, groupId: string | null, groupName: string | null, ctx: OpContext): Partial<StoredPrompt> {
  return {
    groupId,
    updatedAt: ctx.at,
    localActivity: [...(prompt.localActivity ?? []), activity(prompt, ctx, groupName ? `Moved to ${groupName}` : "Removed from group", "config")],
  };
}

export type ConfigDraft = {
  intent: PromptIntent;
  topic: string;
  scope: PromptScope;
  market: string;
  language: string;
  groupId: string;
  isCore: boolean;
  productIds: string[];
};

/** Names of the tracking fields that differ, for the log line and the toast. */
export function configChanges(prompt: StoredPrompt, draft: ConfigDraft): string[] {
  const changed: string[] = [];
  if (draft.intent !== prompt.intent) changed.push("intent");
  if (draft.topic !== prompt.topic) changed.push("topic");
  if (draft.scope !== prompt.scope) changed.push("scope");
  if (draft.market !== prompt.market || draft.language !== prompt.language) changed.push("market and language");
  if (draft.groupId !== (prompt.groupId ?? "")) changed.push("group");
  if (draft.isCore !== prompt.isCore) changed.push("core set");
  if (JSON.stringify(draft.productIds) !== JSON.stringify(prompt.productIds)) changed.push("offerings");
  return changed;
}

export function configPatch(prompt: StoredPrompt, draft: ConfigDraft, ctx: OpContext): Partial<StoredPrompt> {
  const changed = configChanges(prompt, draft);
  return {
    intent: draft.intent,
    topic: draft.topic.trim(),
    scope: draft.scope,
    market: draft.market,
    language: draft.language,
    groupId: draft.groupId || null,
    isCore: draft.isCore,
    productIds: draft.productIds,
    updatedAt: ctx.at,
    localActivity: [...(prompt.localActivity ?? []), activity(prompt, ctx, "Tracking changed", "config", changed.join(", ") || undefined)],
  };
}

/** Static versions plus the ones created in this browser, newest first. A local entry replaces a static one with the same number. */
export function combineVersions(staticVersions: PromptVersion[], local: PromptVersion[] | undefined): PromptVersion[] {
  const byNumber = new Map<number, PromptVersion>();
  for (const v of staticVersions) byNumber.set(v.version, v);
  for (const v of local ?? []) byNumber.set(v.version, v);
  return [...byNumber.values()].sort((a, b) => b.version - a.version);
}

/** Static activity plus the local log, newest first. */
export function combineActivity(staticItems: PromptActivityItem[], local: PromptActivityItem[] | undefined): PromptActivityItem[] {
  return [...staticItems, ...(local ?? [])].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ---------------------------------------------------------------------------
// CSV import -> prompts
// ---------------------------------------------------------------------------

export type ImportPlan = {
  /** Group names in the file that do not exist yet (one entry per distinct name, in file order). */
  newGroups: string[];
  inputs: (NewPromptInput & { groupName: string })[];
};

/** Turns the "Will create" rows of a dry run into prompts to add. Duplicates and invalid rows are never included. */
export function planImport(rows: ImportRow[], groups: { id: string; name: string }[], defaults: { market: string; language: string }): ImportPlan {
  const newGroups: string[] = [];
  const known = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]));
  const inputs: ImportPlan["inputs"] = [];
  for (const row of rows) {
    if (row.result !== "create") continue;
    const name = row.groupName.trim();
    if (name && !known.has(name.toLowerCase()) && !newGroups.some((g) => g.toLowerCase() === name.toLowerCase())) newGroups.push(name);
    inputs.push({
      text: row.text,
      intent: row.intent as PromptIntent,
      topic: row.topic,
      groupId: name ? (known.get(name.toLowerCase()) ?? null) : null,
      groupName: name,
      market: row.market || defaults.market,
      language: row.language || defaults.language,
      scope: row.scope as PromptScope,
      status: row.status as NewPromptInput["status"],
      productIds: [],
      isCore: row.isCore,
      source: "imported",
    });
  }
  return { newGroups, inputs };
}

// ---------------------------------------------------------------------------
// Summary for the overview strip
// ---------------------------------------------------------------------------

export type LibrarySummary = {
  total: number;
  active: number;
  draft: number;
  paused: number;
  archived: number;
  /** Among active prompts. */
  neutral: number;
  brandSpecific: number;
  core: number;
};

export function summarize(prompts: Pick<StoredPrompt, "status" | "mentionsBrand" | "isCore">[]): LibrarySummary {
  const s: LibrarySummary = { total: prompts.length, active: 0, draft: 0, paused: 0, archived: 0, neutral: 0, brandSpecific: 0, core: 0 };
  for (const p of prompts) {
    s[p.status] += 1;
    if (p.status !== "active") continue;
    if (p.mentionsBrand) s.brandSpecific += 1;
    else s.neutral += 1;
    if (p.isCore) s.core += 1;
  }
  return s;
}

/** Distinct topics with counts, most used first. Empty topics are left out. */
export function topicCounts(prompts: Pick<StoredPrompt, "topic">[]): { topic: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of prompts) {
    const topic = p.topic.trim();
    if (topic) map.set(topic, (map.get(topic) ?? 0) + 1);
  }
  return [...map].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

/** Demo plan limit for active prompts in one website. The billing page shows the organization total. */
export const PLAN_ACTIVE_PROMPT_LIMIT = 150;
/** Show the near-limit warning from this share of the limit. */
export const PLAN_WARN_SHARE = 0.85;

export type PlanState = { state: "ok" | "near" | "full"; active: number; limit: number };

export function planState(active: number, limit = PLAN_ACTIVE_PROMPT_LIMIT): PlanState {
  return { state: active >= limit ? "full" : active >= Math.ceil(limit * PLAN_WARN_SHARE) ? "near" : "ok", active, limit };
}

// ---------------------------------------------------------------------------
// Selector shared with other modules (see use-prompts.ts)
// ---------------------------------------------------------------------------

/** Static rows plus local changes (created, patched, removed) for one website. Pure. */
export function mergePrompts<T extends PromptBase>(base: readonly T[], overlay: CollectionOverlay<T> | undefined, storeId: string): T[] {
  return applyOverlay(base, overlay, (row) => row.id).filter((p) => p.storeId === storeId);
}

/** Prompts that run in audits and monitoring. */
export function selectActivePrompts<T extends Pick<PromptBase, "status">>(prompts: readonly T[]): T[] {
  return prompts.filter((p) => p.status === "active");
}
