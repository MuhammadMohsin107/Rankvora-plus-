import { and, asc, eq, isNull, ne } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { promptTemplates, prompts, type PromptTemplate } from "@/db/schema";
import type { Actor } from "@/lib/tenancy/actor";
import { recordActivity } from "@/lib/tenancy/activity";
import { requireOrgAccess } from "@/lib/tenancy/access";
import { conflict, isUniqueViolation, notFound } from "@/lib/tenancy/errors";
import { parseInput } from "@/lib/tenancy/validation";

import {
  assertGroupInStore,
  insertPromptRow,
  lockStoreForPromptWrite,
  type PromptWithText,
} from "./prompts";
import { hashPromptText } from "./text";
import { copyTemplateInput, createTemplateInput } from "./validation";

export async function createPromptTemplate(
  dbx: DbOrTx,
  actor: Actor,
  rawInput: unknown,
): Promise<PromptTemplate> {
  const input = parseInput(createTemplateInput, rawInput);

  return dbx.transaction(async (tx) => {
    const { organization } = await requireOrgAccess(
      tx,
      actor,
      input.organizationId,
      "prompt:edit",
    );

    const [template] = await tx
      .insert(promptTemplates)
      .values({
        organizationId: organization.id,
        text: input.text,
        intent: input.intent,
        topic: input.topic ?? null,
        language: input.language,
        createdByUserId: actor.userId,
      })
      .returning();

    await recordActivity(tx, actor, {
      organizationId: organization.id,
      action: "prompt_template.created",
      resourceType: "prompt_template",
      resourceId: template.id,
      details: { intent: template.intent },
    });
    return template;
  });
}

export async function listPromptTemplates(
  dbx: DbOrTx,
  actor: Actor,
  organizationId: string,
  options: { includeArchived?: boolean } = {},
): Promise<PromptTemplate[]> {
  const { organization } = await requireOrgAccess(
    dbx,
    actor,
    organizationId,
    "store:read",
  );
  return dbx
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.organizationId, organization.id),
        ...(options.includeArchived
          ? []
          : [isNull(promptTemplates.archivedAt)]),
      ),
    )
    .orderBy(asc(promptTemplates.text));
}

/** Archives a template. Prompts already copied from it are unaffected. */
export async function archivePromptTemplate(
  dbx: DbOrTx,
  actor: Actor,
  templateId: string,
): Promise<PromptTemplate> {
  return dbx.transaction(async (tx) => {
    const [template] = await tx
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, templateId));
    if (!template) throw notFound("Prompt template");
    // Fails with "not found" if the actor is not in the template's organization.
    await requireOrgAccess(tx, actor, template.organizationId, "prompt:edit");

    if (template.archivedAt) return template;

    const [archived] = await tx
      .update(promptTemplates)
      .set({ archivedAt: new Date() })
      .where(eq(promptTemplates.id, template.id))
      .returning();

    await recordActivity(tx, actor, {
      organizationId: template.organizationId,
      action: "prompt_template.archived",
      resourceType: "prompt_template",
      resourceId: template.id,
    });
    return archived;
  });
}

/**
 * Copies a template into a store as that store's own prompt. The new prompt is
 * independent: editing or archiving the template never changes it.
 */
export async function copyTemplateToStore(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  templateId: string,
  rawInput: unknown = {},
): Promise<PromptWithText> {
  const input = parseInput(copyTemplateInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockStoreForPromptWrite(tx, actor, storeId);

      // A template from another organization is reported as missing.
      const [template] = await tx
        .select()
        .from(promptTemplates)
        .where(
          and(
            eq(promptTemplates.id, templateId),
            eq(promptTemplates.organizationId, store.organizationId),
            isNull(promptTemplates.archivedAt),
          ),
        );
      if (!template) throw notFound("Prompt template");

      if (input.groupId) await assertGroupInStore(tx, store.id, input.groupId);

      const country = input.country ?? store.market;
      const [duplicate] = await tx
        .select({ id: prompts.id })
        .from(prompts)
        .where(
          and(
            eq(prompts.storeId, store.id),
            eq(prompts.language, template.language),
            eq(prompts.country, country),
            eq(prompts.textHash, hashPromptText(template.text)),
            ne(prompts.status, "archived"),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw conflict(
          "This store already has a prompt with the same wording.",
        );
      }

      const prompt = await insertPromptRow(tx, actor, store, {
        text: template.text,
        intent: template.intent,
        topic: template.topic,
        groupId: input.groupId ?? null,
        language: template.language,
        country,
        isCore: false,
        creationSource: "template",
        sourceTemplateId: template.id,
        status: input.status,
        trackingScope: input.trackingScope,
      });

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "prompt.created",
        resourceType: "prompt",
        resourceId: prompt.id,
        details: { source: "template", templateId: template.id },
      });
      return prompt;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("This store already has a prompt with the same wording.");
    }
    throw error;
  }
}
