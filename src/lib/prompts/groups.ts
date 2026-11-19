import { and, asc, count, eq, ne, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { promptGroups, prompts, type PromptGroup } from "@/db/schema";
import type { Actor } from "@/lib/tenancy/actor";
import { changedFields, recordActivity } from "@/lib/tenancy/activity";
import { requireStoreAccess } from "@/lib/tenancy/access";
import { conflict, isUniqueViolation, notFound } from "@/lib/tenancy/errors";
import { parseInput } from "@/lib/tenancy/validation";

import { lockStoreForPromptWrite } from "./prompts";
import { promptGroupInput, updatePromptGroupInput } from "./validation";

async function assertNameAvailable(
  tx: DbOrTx,
  storeId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const [existing] = await tx
    .select({ id: promptGroups.id })
    .from(promptGroups)
    .where(
      and(
        eq(promptGroups.storeId, storeId),
        sql`lower(${promptGroups.name}) = lower(${name})`,
        ...(excludeId ? [ne(promptGroups.id, excludeId)] : []),
      ),
    )
    .limit(1);
  if (existing)
    throw conflict(`A prompt group named "${name}" already exists.`);
}

async function loadGroup(
  tx: DbOrTx,
  storeId: string,
  groupId: string,
): Promise<PromptGroup> {
  const [group] = await tx
    .select()
    .from(promptGroups)
    .where(
      and(eq(promptGroups.id, groupId), eq(promptGroups.storeId, storeId)),
    );
  if (!group) throw notFound("Prompt group");
  return group;
}

export async function listPromptGroups(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<(PromptGroup & { promptCount: number })[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  const rows = await dbx
    .select({ group: promptGroups, promptCount: count(prompts.id) })
    .from(promptGroups)
    .leftJoin(
      prompts,
      and(eq(prompts.groupId, promptGroups.id), ne(prompts.status, "archived")),
    )
    .where(eq(promptGroups.storeId, store.id))
    .groupBy(promptGroups.id)
    .orderBy(asc(promptGroups.name));
  return rows.map((row) => ({ ...row.group, promptCount: row.promptCount }));
}

export async function createPromptGroup(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<PromptGroup> {
  const input = parseInput(promptGroupInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockStoreForPromptWrite(tx, actor, storeId);
      await assertNameAvailable(tx, store.id, input.name);

      const [group] = await tx
        .insert(promptGroups)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          name: input.name,
          description: input.description ?? null,
        })
        .returning();

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "prompt_group.created",
        resourceType: "prompt_group",
        resourceId: group.id,
        details: { name: group.name },
      });
      return group;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A prompt group named "${input.name}" already exists.`);
    }
    throw error;
  }
}

export async function updatePromptGroup(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  groupId: string,
  rawInput: unknown,
): Promise<PromptGroup> {
  const input = parseInput(updatePromptGroupInput, rawInput);

  return dbx.transaction(async (tx) => {
    const store = await lockStoreForPromptWrite(tx, actor, storeId);
    const current = await loadGroup(tx, store.id, groupId);
    if (input.name !== undefined) {
      await assertNameAvailable(tx, store.id, input.name, current.id);
    }

    const patch: Partial<PromptGroup> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    const changes = changedFields(current, patch);
    if (Object.keys(changes).length === 0) return current;

    const [updated] = await tx
      .update(promptGroups)
      .set(patch)
      .where(eq(promptGroups.id, current.id))
      .returning();

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "prompt_group.updated",
      resourceType: "prompt_group",
      resourceId: current.id,
      details: { changes },
    });
    return updated;
  });
}

/** Deletes a group. Its prompts are kept and become ungrouped. */
export async function deletePromptGroup(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  groupId: string,
): Promise<{ ungroupedPrompts: number }> {
  return dbx.transaction(async (tx) => {
    const store = await lockStoreForPromptWrite(tx, actor, storeId);
    const group = await loadGroup(tx, store.id, groupId);

    const ungrouped = await tx
      .update(prompts)
      .set({ groupId: null })
      .where(and(eq(prompts.groupId, group.id), eq(prompts.storeId, store.id)))
      .returning({ id: prompts.id });

    await tx.delete(promptGroups).where(eq(promptGroups.id, group.id));

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "prompt_group.deleted",
      resourceType: "prompt_group",
      resourceId: group.id,
      details: { name: group.name, ungroupedPrompts: ungrouped.length },
    });
    return { ungroupedPrompts: ungrouped.length };
  });
}
