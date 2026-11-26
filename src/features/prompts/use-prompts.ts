"use client";

/**
 * Prompts for every module: the static demo prompts merged with the ones created or edited in this browser.
 *
 * Other modules (Monitoring schedules, the Audit wizard, Comparison scopes) receive their static prompts from a
 * server component as props and call
 *
 *     const { prompts } = usePrompts(storeId, staticPrompts);   // PromptBase-compatible rows
 *     const active = selectActivePrompts(prompts);
 *
 * `prompts` equals `staticPrompts` on the server and on the first client render, then includes local changes
 * (new prompts, edited wording, status, group). `staticPrompts` must keep the same reference between renders
 * (pass the server prop straight through). The pure `mergePrompts` does the same merge without React.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { demoNow, demoStore, useDemoCollection, useDemoSettings } from "@/demo-state";
import type { PromptBase, PromptGroup, PromptStatus } from "@/types/core";
import type { ExistingPrompt, PromptContext, PromptTemplate, StoreContext, StoredPrompt, WebsiteOption } from "@/types/prompts";

import {
  buildPromptRow,
  mergePrompts,
  selectActivePrompts,
  canChangeStatus,
  configChanges,
  configPatch,
  groupPatch,
  statusPatch,
  wordingPatch,
  type ConfigDraft,
  type NewPromptInput,
  type OpContext,
} from "./prompt-ops";

export { mergePrompts, selectActivePrompts };

export function usePrompts<T extends PromptBase = StoredPrompt>(storeId: string, base: readonly T[]) {
  const { rows, isDemoCreated } = useDemoCollection<T>("prompts", base);
  const prompts = useMemo(() => rows.filter((p) => p.storeId === storeId), [rows, storeId]);
  return { prompts, isLocal: isDemoCreated };
}

// ---------------------------------------------------------------------------
// Groups (one saved list per website)
// ---------------------------------------------------------------------------

export function usePromptGroups(storeId: string, baseGroups: PromptGroup[]) {
  const setting = useDemoSettings<PromptGroup[]>(`prompts.groups.${storeId}`, baseGroups);
  const groups = setting.value;
  const save = setting.save;

  const create = useCallback(
    (name: string): PromptGroup => {
      const group: PromptGroup = { id: demoStore.nextId("group"), storeId, name };
      save([...groups, group], { kind: "settings.saved", label: "Prompt group created", refs: { websiteId: storeId } });
      return group;
    },
    [groups, save, storeId],
  );
  const rename = useCallback((id: string, name: string) => save(groups.map((g) => (g.id === id ? { ...g, name } : g))), [groups, save]);
  const remove = useCallback((id: string) => save(groups.filter((g) => g.id !== id)), [groups, save]);
  /** Adds groups by name that do not exist yet and returns name -> id for all of them. */
  const ensure = useCallback(
    (names: string[]): Map<string, string> => {
      const next = [...groups];
      for (const name of names) {
        if (!next.some((g) => g.name.toLowerCase() === name.toLowerCase())) next.push({ id: demoStore.nextId("group"), storeId, name });
      }
      if (next.length !== groups.length) save(next);
      return new Map(next.map((g) => [g.name.toLowerCase(), g.id]));
    },
    [groups, save, storeId],
  );
  return { groups, create, rename, remove, ensure };
}

// ---------------------------------------------------------------------------
// Templates saved in this browser (organization templates stay static)
// ---------------------------------------------------------------------------

const NO_TEMPLATES: PromptTemplate[] = [];

export function useSavedTemplates() {
  const setting = useDemoSettings<PromptTemplate[]>("prompts.templates", NO_TEMPLATES);
  const { value, save } = setting;
  const add = useCallback(
    (template: Omit<PromptTemplate, "id">) => {
      const created: PromptTemplate = { ...template, id: demoStore.nextId("template") };
      save([...value, created], { kind: "settings.saved", label: "Prompt template saved" });
      return created;
    },
    [value, save],
  );
  return { templates: value, add };
}

// ---------------------------------------------------------------------------
// Website context (websites created in this browser are not known to the server)
// ---------------------------------------------------------------------------

type WebsiteRow = { id: string } & Record<string, unknown>;
const NO_WEBSITES: WebsiteRow[] = [];

const str = (value: unknown, fallback = ""): string => (typeof value === "string" && value.trim() !== "" ? value : fallback);

/** Builds the website fields from a locally created website row. Tolerates missing fields. */
export function storeContextFromWebsite(row: WebsiteRow): StoreContext {
  const market = str(row.market, "").toUpperCase();
  const channelIds = Array.isArray(row.channelIds) ? row.channelIds.length : 0;
  return {
    id: row.id,
    name: str(row.name, "Website"),
    brandName: str(row.brandName, str(row.name)),
    market,
    marketName: str(row.marketName, market),
    language: str(row.language, "en").toLowerCase(),
    channelCount: channelIds,
    resolved: true,
  };
}

/** The server context, completed from the local website when the server does not know the website. */
export function usePromptContext(base: PromptContext): { context: PromptContext; known: boolean } {
  const websites = useDemoCollection<WebsiteRow>("websites", NO_WEBSITES).rows;
  const storeId = base.store.id;
  const { groups } = usePromptGroups(storeId, base.groups);
  const existingRows = useDemoCollection<ExistingPrompt>("prompts", base.existing).rows;
  const prompts = useMemo(() => existingRows.filter((p) => p.storeId === storeId), [existingRows, storeId]);
  const { templates: saved } = useSavedTemplates();
  const local = base.store.resolved === false ? websites.find((w) => w.id === storeId) : undefined;
  const known = base.store.resolved !== false || local !== undefined;

  const store = useMemo(() => (local ? storeContextFromWebsite(local) : base.store), [local, base.store]);
  const profile = useMemo(() => (local ? { ...base.profile, brand: store.brandName, market: store.marketName } : base.profile), [local, base.profile, store]);
  const existing = useMemo(() => prompts.map((p) => ({ id: p.id, storeId, text: p.text, status: p.status })), [prompts, storeId]);
  const templates = useMemo(() => [...base.templates, ...saved], [base.templates, saved]);
  const otherWebsites = useMemo<WebsiteOption[]>(
    () => [...base.otherWebsites, ...websites.filter((w) => w.id !== storeId && !base.otherWebsites.some((o) => o.id === w.id)).map((w) => ({ id: w.id, name: str(w.name, "Website"), texts: [] }))],
    [base.otherWebsites, websites, storeId],
  );
  const context = useMemo<PromptContext>(
    () => ({ ...base, store, profile, groups, existing, templates, otherWebsites }),
    [base, store, profile, groups, existing, templates, otherWebsites],
  );
  return { context, known };
}

const NOOP_SUBSCRIBE = () => () => {};

/** False on the server and during hydration, true afterwards. Local data is only reliable once true. */
export function useHydrated(): boolean {
  return useSyncExternalStore(NOOP_SUBSCRIBE, () => true, () => false);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type Row = StoredPrompt;

/**
 * Create, edit, change status, move and copy prompts. Every change is stored in the local demo state with an
 * evidence event, so the library, the detail, schedules and the audit wizard all see it.
 */
export function usePromptActions<T extends Row>(storeId: string, base: readonly T[], who: { brand: string; actor: string }) {
  const { rows, create, update } = useDemoCollection<T>("prompts", base);
  const { brand, actor } = who;

  const ctx = useCallback((): OpContext => ({ brand, actor, at: demoNow() }), [brand, actor]);
  const find = useCallback((id: string) => rows.find((r) => r.id === id), [rows]);

  const add = useCallback(
    (input: NewPromptInput): T => {
      const row = buildPromptRow(storeId, input, ctx());
      return create(row as unknown as Omit<T, "id">, (created) => ({ kind: "prompt.created", label: "Prompt created", refs: { promptId: created.id, websiteId: storeId } }));
    },
    [create, ctx, storeId],
  );

  const addMany = useCallback((inputs: NewPromptInput[]): T[] => inputs.map((input) => add(input)), [add]);

  const patch = useCallback(
    (id: string, change: Partial<Row>, label: string) => update(id, change as Partial<T>, { kind: "prompt.updated", label, refs: { promptId: id, websiteId: storeId } }),
    [update, storeId],
  );

  /** Returns the ids that changed and the number skipped (already in that status, or archived). */
  const setStatus = useCallback(
    (ids: string[], status: PromptStatus): { changed: string[]; skipped: number } => {
      const c = ctx();
      const changed: string[] = [];
      for (const id of ids) {
        const prompt = find(id);
        if (!prompt || !canChangeStatus(prompt.status, status)) continue;
        patch(id, statusPatch(prompt, status, c), `Prompt ${status === "draft" ? "restored" : status === "active" ? "activated" : status}`);
        changed.push(id);
      }
      return { changed, skipped: ids.length - changed.length };
    },
    [ctx, find, patch],
  );

  const moveToGroup = useCallback(
    (ids: string[], groupId: string | null, groupName: string | null) => {
      const c = ctx();
      for (const id of ids) {
        const prompt = find(id);
        if (prompt) patch(id, groupPatch(prompt, groupId, groupName, c), "Prompt moved");
      }
    },
    [ctx, find, patch],
  );

  /** Clears the group on every prompt that uses it (used when a group is deleted). */
  const clearGroup = useCallback(
    (groupId: string) => {
      const c = ctx();
      for (const prompt of rows) if (prompt.storeId === storeId && prompt.groupId === groupId) patch(prompt.id, groupPatch(prompt, null, null, c), "Prompt group removed");
    },
    [ctx, patch, rows, storeId],
  );

  /** New wording creates version n + 1; earlier versions and their run counts stay. */
  const editWording = useCallback(
    (id: string, text: string, note: string | null = null) => {
      const prompt = find(id);
      if (!prompt) return null;
      const change = wordingPatch(prompt, text, note, ctx());
      patch(id, change, `Prompt wording saved as v${change.version}`);
      return change.version ?? null;
    },
    [ctx, find, patch],
  );

  const saveConfig = useCallback(
    (id: string, draft: ConfigDraft) => {
      const prompt = find(id);
      if (!prompt) return [];
      patch(id, configPatch(prompt, draft, ctx()), "Prompt tracking saved");
      return configChanges(prompt, draft);
    },
    [ctx, find, patch],
  );

  /**
   * Copies prompts to another website as drafts (a prompt belongs to one website). Skips wording the target already has,
   * among its static prompts (`knownTexts`) and the ones created locally.
   */
  const copyTo = useCallback(
    (ids: string[], targetId: string, knownTexts: string[], targetMarket: { market: string; language: string }) => {
      const c = ctx();
      const snap = demoStore.getSnapshot().prompts.created as unknown as { storeId?: string; text?: string }[];
      const seen = new Set([...knownTexts, ...snap.filter((p) => p.storeId === targetId).map((p) => p.text ?? "")].map((t) => t.trim().toLowerCase()));
      let copied = 0;
      for (const id of ids) {
        const prompt = find(id);
        if (!prompt || seen.has(prompt.text.trim().toLowerCase())) continue;
        seen.add(prompt.text.trim().toLowerCase());
        const row = buildPromptRow(
          targetId,
          { text: prompt.text, intent: prompt.intent, topic: prompt.topic, groupId: null, market: targetMarket.market || prompt.market, language: targetMarket.language || prompt.language, scope: prompt.scope, status: "draft", productIds: [], isCore: false, source: "template" },
          c,
        );
        create(row as unknown as Omit<T, "id">, (created) => ({ kind: "prompt.created", label: "Prompt copied", refs: { promptId: created.id, websiteId: targetId } }));
        copied += 1;
      }
      return { copied, skipped: ids.length - copied };
    },
    [create, ctx, find],
  );

  return { rows, add, addMany, setStatus, moveToGroup, clearGroup, editWording, saveConfig, copyTo };
}
