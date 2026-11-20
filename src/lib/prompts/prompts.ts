import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  ne,
} from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  promptGroups,
  promptProducts,
  prompts,
  promptVersions,
  productsServices,
  stores,
  type Prompt,
  type PromptIntent,
  type PromptSource,
  type PromptStatus,
  type PromptTrackingScope,
  type PromptVersion,
  type Store,
} from "@/db/schema";
import type { Actor } from "@/lib/tenancy/actor";
import { changedFields, recordActivity } from "@/lib/tenancy/activity";
import { assertStoreWritable, requireStoreAccess } from "@/lib/tenancy/access";
import { conflict, isUniqueViolation, notFound } from "@/lib/tenancy/errors";
import { parseInput } from "@/lib/tenancy/validation";

import { findSimilarPrompts, hashPromptText, type SimilarPrompt } from "./text";
import {
  createPromptInput,
  listPromptsInput,
  promptStatusInput,
  updatePromptInput,
} from "./validation";

export type PromptWithText = Prompt & { text: string };

const promptColumns = {
  ...getTableColumns(prompts),
  text: promptVersions.text,
};

/** The current wording of a prompt is the text of its current version. */
function selectPromptsWithText(dbx: DbOrTx) {
  return dbx
    .select(promptColumns)
    .from(prompts)
    .innerJoin(
      promptVersions,
      and(
        eq(promptVersions.promptId, prompts.id),
        eq(promptVersions.version, prompts.currentVersion),
      ),
    );
}

// ---------------------------------------------------------------------------
// Shared helpers (also used by templates and CSV import)
// ---------------------------------------------------------------------------

/** Authorizes a prompt write and locks the store row so edits apply in order. */
export async function lockStoreForPromptWrite(
  tx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<Store> {
  await requireStoreAccess(tx, actor, storeId, "prompt:edit");
  const [store] = await tx
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .for("update");
  assertStoreWritable(store);
  return store;
}

export async function assertGroupInStore(
  tx: DbOrTx,
  storeId: string,
  groupId: string,
): Promise<void> {
  const [group] = await tx
    .select({ id: promptGroups.id })
    .from(promptGroups)
    .where(
      and(eq(promptGroups.id, groupId), eq(promptGroups.storeId, storeId)),
    );
  if (!group) throw notFound("Prompt group");
}

async function assertProductsInStore(
  tx: DbOrTx,
  storeId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;
  const found = await tx
    .select({ id: productsServices.id })
    .from(productsServices)
    .where(
      and(
        eq(productsServices.storeId, storeId),
        inArray(productsServices.id, productIds),
      ),
    );
  if (found.length !== productIds.length) throw notFound("Product or service");
}

async function replacePromptProducts(
  tx: DbOrTx,
  store: Store,
  promptId: string,
  productIds: string[],
): Promise<void> {
  await assertProductsInStore(tx, store.id, productIds);
  await tx.delete(promptProducts).where(eq(promptProducts.promptId, promptId));
  if (productIds.length > 0) {
    await tx.insert(promptProducts).values(
      productIds.map((productServiceId) => ({
        organizationId: store.organizationId,
        storeId: store.id,
        promptId,
        productServiceId,
      })),
    );
  }
}

async function findDuplicate(
  tx: DbOrTx,
  storeId: string,
  language: string,
  country: string,
  hash: string,
  excludePromptId?: string,
): Promise<string | null> {
  const [existing] = await tx
    .select({ id: prompts.id })
    .from(prompts)
    .where(
      and(
        eq(prompts.storeId, storeId),
        eq(prompts.language, language),
        eq(prompts.country, country),
        eq(prompts.textHash, hash),
        ne(prompts.status, "archived"),
        ...(excludePromptId ? [ne(prompts.id, excludePromptId)] : []),
      ),
    )
    .limit(1);
  return existing?.id ?? null;
}

async function loadStoreTexts(
  tx: DbOrTx,
  storeId: string,
): Promise<{ id: string; text: string }[]> {
  return tx
    .select({ id: prompts.id, text: promptVersions.text })
    .from(prompts)
    .innerJoin(
      promptVersions,
      and(
        eq(promptVersions.promptId, prompts.id),
        eq(promptVersions.version, prompts.currentVersion),
      ),
    )
    .where(and(eq(prompts.storeId, storeId), ne(prompts.status, "archived")));
}

export type NewPromptValues = {
  text: string;
  intent: PromptIntent;
  topic: string | null;
  groupId: string | null;
  language: string;
  country: string;
  isCore: boolean;
  creationSource: PromptSource;
  sourceTemplateId?: string | null;
  status: PromptStatus;
  trackingScope: PromptTrackingScope;
};

/**
 * Inserts a prompt and its version 1. Callers must already hold the store
 * lock and must have checked for duplicates and group ownership.
 */
export async function insertPromptRow(
  tx: DbOrTx,
  actor: Actor,
  store: Store,
  values: NewPromptValues,
): Promise<PromptWithText> {
  const textHash = hashPromptText(values.text);

  const [prompt] = await tx
    .insert(prompts)
    .values({
      organizationId: store.organizationId,
      storeId: store.id,
      groupId: values.groupId,
      topic: values.topic,
      intent: values.intent,
      language: values.language,
      country: values.country,
      currentVersion: 1,
      textHash,
      isCore: values.isCore,
      creationSource: values.creationSource,
      sourceTemplateId: values.sourceTemplateId ?? null,
      status: values.status,
      trackingScope: values.trackingScope,
      createdByUserId: actor.userId,
    })
    .returning();

  await tx.insert(promptVersions).values({
    organizationId: store.organizationId,
    storeId: store.id,
    promptId: prompt.id,
    version: 1,
    text: values.text,
    textHash,
    language: values.language,
    country: values.country,
    createdByUserId: actor.userId,
  });

  return { ...prompt, text: values.text };
}

const DUPLICATE_MESSAGE =
  "This prompt already exists for this website and market (ignoring case and punctuation).";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createPrompt(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<{ prompt: PromptWithText; similar: SimilarPrompt[] }> {
  const input = parseInput(createPromptInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockStoreForPromptWrite(tx, actor, storeId);
      const language = input.language ?? store.language;
      const country = input.country ?? store.market;

      if (input.groupId) await assertGroupInStore(tx, store.id, input.groupId);
      await assertProductsInStore(tx, store.id, input.productIds ?? []);

      const duplicateId = await findDuplicate(
        tx,
        store.id,
        language,
        country,
        hashPromptText(input.text),
      );
      if (duplicateId) {
        throw conflict(`${DUPLICATE_MESSAGE} Existing prompt: ${duplicateId}.`);
      }

      const similar = findSimilarPrompts(
        input.text,
        await loadStoreTexts(tx, store.id),
      );

      const prompt = await insertPromptRow(tx, actor, store, {
        text: input.text,
        intent: input.intent,
        topic: input.topic ?? null,
        groupId: input.groupId ?? null,
        language,
        country,
        isCore: input.isCore,
        creationSource: input.creationSource,
        status: input.status,
        trackingScope: input.trackingScope,
      });
      await replacePromptProducts(tx, store, prompt.id, input.productIds ?? []);

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "prompt.created",
        resourceType: "prompt",
        resourceId: prompt.id,
        details: {
          intent: prompt.intent,
          source: prompt.creationSource,
          status: prompt.status,
        },
      });

      return { prompt, similar };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE_MESSAGE);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getPrompt(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  promptId: string,
): Promise<{ prompt: PromptWithText; productIds: string[] }> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  const [prompt] = await selectPromptsWithText(dbx).where(
    and(eq(prompts.id, promptId), eq(prompts.storeId, store.id)),
  );
  if (!prompt) throw notFound("Prompt");

  const links = await dbx
    .select({ id: promptProducts.productServiceId })
    .from(promptProducts)
    .where(eq(promptProducts.promptId, prompt.id));
  return { prompt, productIds: links.map((link) => link.id) };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export async function listPrompts(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawFilter: unknown = {},
): Promise<{ items: PromptWithText[]; total: number }> {
  const filter = parseInput(listPromptsInput, rawFilter);
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");

  const conditions = [
    eq(prompts.storeId, store.id),
    eq(prompts.organizationId, store.organizationId),
    // Archived prompts are hidden unless explicitly requested.
    filter.status
      ? inArray(prompts.status, filter.status)
      : ne(prompts.status, "archived"),
  ];
  if (filter.intent) conditions.push(eq(prompts.intent, filter.intent));
  if (filter.groupId === null) conditions.push(isNull(prompts.groupId));
  else if (filter.groupId) conditions.push(eq(prompts.groupId, filter.groupId));
  if (filter.trackingScope) {
    conditions.push(eq(prompts.trackingScope, filter.trackingScope));
  }
  if (filter.isCore !== undefined)
    conditions.push(eq(prompts.isCore, filter.isCore));
  if (filter.search) {
    conditions.push(
      ilike(promptVersions.text, `%${escapeLike(filter.search)}%`),
    );
  }
  const where = and(...conditions);

  const [items, [{ total }]] = await Promise.all([
    selectPromptsWithText(dbx)
      .where(where)
      .orderBy(desc(prompts.createdAt), desc(prompts.id))
      .limit(filter.limit)
      .offset(filter.offset),
    dbx
      .select({ total: count() })
      .from(prompts)
      .innerJoin(
        promptVersions,
        and(
          eq(promptVersions.promptId, prompts.id),
          eq(promptVersions.version, prompts.currentVersion),
        ),
      )
      .where(where),
  ]);

  return { items, total };
}

export async function listPromptVersions(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  promptId: string,
): Promise<PromptVersion[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  const [owner] = await dbx
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.storeId, store.id)));
  if (!owner) throw notFound("Prompt");

  return dbx
    .select()
    .from(promptVersions)
    .where(
      and(
        eq(promptVersions.promptId, promptId),
        eq(promptVersions.storeId, store.id),
      ),
    )
    .orderBy(desc(promptVersions.version));
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

async function lockPrompt(
  tx: DbOrTx,
  storeId: string,
  promptId: string,
): Promise<Prompt> {
  const [prompt] = await tx
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.storeId, storeId)))
    .for("update");
  // A prompt id from another store is reported as missing.
  if (!prompt) throw notFound("Prompt");
  return prompt;
}

/**
 * Edits a prompt. A change to the wording, language or country creates a NEW
 * immutable version (earlier runs keep pointing at the old one); changes to
 * topic, intent, group, scope, core flag or product links do not.
 */
export async function updatePrompt(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  promptId: string,
  rawInput: unknown,
): Promise<{
  prompt: PromptWithText;
  versionCreated: boolean;
  similar: SimilarPrompt[];
}> {
  const input = parseInput(updatePromptInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockStoreForPromptWrite(tx, actor, storeId);
      const current = await lockPrompt(tx, store.id, promptId);
      if (current.status === "archived") {
        throw conflict("This prompt is archived. Restore it before editing.");
      }

      const [currentVersion] = await tx
        .select()
        .from(promptVersions)
        .where(
          and(
            eq(promptVersions.promptId, current.id),
            eq(promptVersions.version, current.currentVersion),
          ),
        );

      const text = input.text ?? currentVersion.text;
      const language = input.language ?? current.language;
      const country = input.country ?? current.country;
      const wordingChanged =
        text !== currentVersion.text ||
        language !== current.language ||
        country !== current.country;

      if (input.groupId) await assertGroupInStore(tx, store.id, input.groupId);

      const patch: Partial<Prompt> = {};
      if (input.intent !== undefined) patch.intent = input.intent;
      if (input.topic !== undefined) patch.topic = input.topic;
      if (input.groupId !== undefined) patch.groupId = input.groupId;
      if (input.isCore !== undefined) patch.isCore = input.isCore;
      if (input.trackingScope !== undefined) {
        patch.trackingScope = input.trackingScope;
      }

      let similar: SimilarPrompt[] = [];
      if (wordingChanged) {
        const textHash = hashPromptText(text);
        const duplicateId = await findDuplicate(
          tx,
          store.id,
          language,
          country,
          textHash,
          current.id,
        );
        if (duplicateId) {
          throw conflict(
            `${DUPLICATE_MESSAGE} Existing prompt: ${duplicateId}.`,
          );
        }
        similar = findSimilarPrompts(
          text,
          (await loadStoreTexts(tx, store.id)).filter(
            (item) => item.id !== current.id,
          ),
        );

        const nextVersion = current.currentVersion + 1;
        await tx.insert(promptVersions).values({
          organizationId: store.organizationId,
          storeId: store.id,
          promptId: current.id,
          version: nextVersion,
          text,
          textHash,
          language,
          country,
          createdByUserId: actor.userId,
        });
        Object.assign(patch, {
          currentVersion: nextVersion,
          textHash,
          language,
          country,
        });
      }

      if (input.productIds !== undefined) {
        await replacePromptProducts(tx, store, current.id, input.productIds);
      }

      const changes = changedFields(current, patch);
      if (wordingChanged) {
        changes.text = { from: currentVersion.text, to: text };
      }
      if (input.productIds !== undefined) {
        changes.productIds = { from: undefined, to: input.productIds };
      }

      let updated: Prompt = current;
      if (Object.keys(patch).length > 0) {
        [updated] = await tx
          .update(prompts)
          .set(patch)
          .where(eq(prompts.id, current.id))
          .returning();
      }

      if (Object.keys(changes).length > 0) {
        await recordActivity(tx, actor, {
          organizationId: store.organizationId,
          storeId: store.id,
          action: "prompt.updated",
          resourceType: "prompt",
          resourceId: current.id,
          details: {
            changes,
            newVersion: wordingChanged ? updated.currentVersion : null,
          },
        });
      }

      return {
        prompt: { ...updated, text },
        versionCreated: wordingChanged,
        similar,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE_MESSAGE);
    throw error;
  }
}

/**
 * Moves a prompt between draft, active, paused and archived. Archived prompts
 * keep all history; restoring one brings it back as paused.
 */
export async function setPromptStatus(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  promptId: string,
  rawStatus: unknown,
): Promise<Prompt> {
  const to = parseInput(promptStatusInput, rawStatus);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockStoreForPromptWrite(tx, actor, storeId);
      const current = await lockPrompt(tx, store.id, promptId);

      if (current.status === to) return current;
      if (current.status === "archived") {
        if (to !== "paused") {
          throw conflict("An archived prompt can only be restored as paused.");
        }
        const duplicateId = await findDuplicate(
          tx,
          store.id,
          current.language,
          current.country,
          current.textHash,
          current.id,
        );
        if (duplicateId) {
          throw conflict(
            `Another prompt now uses this wording, so it cannot be restored. ${duplicateId}`,
          );
        }
      }

      const [updated] = await tx
        .update(prompts)
        .set({ status: to })
        .where(eq(prompts.id, current.id))
        .returning();

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "prompt.status_changed",
        resourceType: "prompt",
        resourceId: current.id,
        details: { from: current.status, to },
      });
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw conflict(DUPLICATE_MESSAGE);
    throw error;
  }
}
