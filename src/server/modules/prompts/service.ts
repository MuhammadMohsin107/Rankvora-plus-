/** The prompt library: create, search, organise, change status and delete. */
import { z } from "zod";

import { normalisePrompt } from "@/lib/prompt-text";

import { MAX_PROMPTS_PER_WEBSITE } from "../../config/limits";
import { appliedClause, atomic, prepare, raw, type Statement } from "../../db/atomic";
import { PROMPT_INTENTS, PROMPT_SCOPES, SEARCH_MODES, type PromptStatus } from "../../db/schema";
import { conflict, invalid, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { decodeCursor, toPage } from "../../pagination";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type PromptAccess, type WebsiteScope } from "../../tenancy/guard";
import { can } from "../../tenancy/permissions";
import { language, market, pageQuery, version } from "../../validation";
import { brandNames } from "../brand/profile";
import { listAssignments } from "./assignments";
import { approveCurrentVersionsStatement, listVersions } from "./versions";
import {
  activeLimitReached,
  activePromptRoom,
  activePromptUsage,
  approvalRequired,
  assertGroup,
  assertProducts,
  changeSummary,
  decoratePrompts,
  duplicatePrompt,
  findExactWording,
  groupExists,
  insertProductLinksStatement,
  insertTagsStatement,
  loadPromptRow,
  nearDuplicates,
  productIds,
  PROMPT_SELECT,
  promptActivity,
  promptText,
  rethrowDuplicate,
  tags,
  topic,
  type PromptRow,
} from "./shared";

export const createPromptSchema = z.strictObject({
  text: promptText,
  intent: z.enum(PROMPT_INTENTS, { error: "Choose an intent." }),
  topic: topic.nullish(),
  groupId: z.string().max(64).nullish(),
  /** Default to the website's market and language. */
  market: market.optional(),
  language: language.optional(),
  searchMode: z.enum(SEARCH_MODES).default("web_grounded_auto"),
  scope: z.enum(PROMPT_SCOPES).default("both"),
  status: z.enum(["draft", "active", "paused"]).default("draft"),
  isCore: z.boolean().default(false),
  /** "imported" is set by the import; "ai_generated" by AI suggestions (Phase 3). */
  source: z.enum(["manual", "template", "research_derived"]).default("manual"),
  tags: tags.default([]),
  productIds: productIds.default([]),
  changeSummary: changeSummary.nullish(),
  approve: z.boolean().default(false),
});

export const listPromptsSchema = pageQuery.extend({
  q: z.string().trim().max(200).optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
  intent: z.enum(PROMPT_INTENTS).optional(),
  scope: z.enum(PROMPT_SCOPES).optional(),
  /** A group id, or "none" for ungrouped prompts. */
  groupId: z.string().max(64).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  isCore: z.enum(["true", "false"]).optional(),
});

export const updatePromptSchema = z
  .strictObject({
    version,
    intent: z.enum(PROMPT_INTENTS).optional(),
    topic: topic.nullable().optional(),
    groupId: z.string().max(64).nullable().optional(),
    scope: z.enum(PROMPT_SCOPES).optional(),
    isCore: z.boolean().optional(),
    tags: tags.optional(),
    productIds: productIds.optional(),
  })
  .refine((input) => Object.keys(input).length > 1, { message: "Nothing to change.", path: ["intent"] });

export const PROMPT_ACTIONS = ["activate", "pause", "resume", "archive", "restore"] as const;
export type PromptAction = (typeof PROMPT_ACTIONS)[number];
export const promptStatusSchema = z.strictObject({ version, action: z.enum(PROMPT_ACTIONS) });
export const deletePromptSchema = z.strictObject({ version });

const TRANSITIONS: Record<PromptAction, { from: readonly PromptStatus[]; to: PromptStatus }> = {
  activate: { from: ["draft"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  resume: { from: ["paused"], to: "active" },
  archive: { from: ["draft", "active", "paused"], to: "archived" },
  // A restored prompt never runs by itself.
  restore: { from: ["archived"], to: "draft" },
};

/** The status after the action, or null when it is not allowed from here. */
export function nextPromptStatus(current: PromptStatus, action: PromptAction): PromptStatus | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

function filters(scope: WebsiteScope, query: z.output<typeof listPromptsSchema>): Statement {
  const clauses = ["p.website_id = ?", "p.organization_id = ?", "p.status <> 'deleted'"];
  const params: unknown[] = [scope.websiteId, scope.organizationId];
  const add = (clause: string, ...values: unknown[]) => {
    clauses.push(clause);
    params.push(...values);
  };
  if (query.status) add("p.status = ?", query.status);
  if (query.intent) add("p.intent = ?", query.intent);
  if (query.scope) add("p.scope = ?", query.scope);
  if (query.groupId === "none") add("p.group_id is null");
  else if (query.groupId) add("p.group_id = ?", query.groupId);
  if (query.tag) add("exists (select 1 from prompt_tags t where t.prompt_id = p.id and t.tag = ?)", query.tag);
  if (query.isCore) add("p.is_core = ?", query.isCore === "true");
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    add("(p.text like ? escape '\\' or p.topic like ? escape '\\')", pattern, pattern);
  }
  return raw(clauses.join(" and "), ...params);
}

export async function listPrompts(context: ApiContext, scope: WebsiteScope, query: z.output<typeof listPromptsSchema>) {
  const where = filters(scope, query);
  const after = query.cursor ? decodeCursor(query.cursor) : null;
  const [rows, counts] = await context.d1.batch([
    prepare(
      context.d1,
      raw(
        `${PROMPT_SELECT} where ${where.sql}${after ? " and (p.created_at < ? or (p.created_at = ? and p.id < ?))" : ""} order by p.created_at desc, p.id desc limit ?`,
        ...where.params,
        ...(after ? [after.at, after.at, after.id] : []),
        query.limit + 1,
      ),
    ),
    prepare(context.d1, raw(`select status as status, count(*) as total from prompts where website_id = ? and status <> 'deleted' group by status`, scope.websiteId)),
  ]);
  const { items, nextCursor } = toPage(rows.results as PromptRow[], query.limit);
  const summary = { draft: 0, active: 0, paused: 0, archived: 0 };
  for (const row of counts.results as { status: keyof typeof summary; total: number }[]) summary[row.status] = row.total;
  return {
    items: await decoratePrompts(context, items, await brandNames(context, scope)),
    nextCursor,
    summary,
    activeLimit: await activePromptUsage(context, scope.organizationId),
  };
}

async function loadDto(context: ApiContext, scope: WebsiteScope, promptId: string) {
  const [dto] = await decoratePrompts(context, [await loadPromptRow(context, scope, promptId)], await brandNames(context, scope));
  return dto;
}

export async function createPrompt(context: ApiContext, scope: WebsiteScope, input: z.output<typeof createPromptSchema>) {
  assertWritableWebsite(scope);
  const activating = input.status === "active";
  if ((activating || input.approve) && !can(scope.role, "prompt.approve")) throw approvalRequired();
  const approved = activating || input.approve;

  const website = await prepare(context.d1, raw(`select market as market, language as language from websites where id = ?`, scope.websiteId)).first<{ market: string; language: string }>();
  const wording = { market: input.market ?? website?.market ?? "", language: input.language ?? website?.language ?? "" };
  const normalized = normalisePrompt(input.text);
  const existing = await findExactWording(context, scope.websiteId, wording.market, wording.language, normalized);
  if (existing) throw duplicatePrompt(existing.id);
  const groupId = input.groupId ?? null;
  await assertGroup(context, scope, groupId);
  await assertProducts(context, scope, input.productIds);

  const id = newId("prm");
  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompts", id, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const group = groupExists(scope, groupId);
  const room = activating ? activePromptRoom(scope.organizationId, 1, raw("ap.id <> ?", id)) : raw("1 = 1");
  const { now } = context;
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into prompts (id, organization_id, website_id, group_id, intent, topic, scope, is_core, source, status, current_version, text,
           normalized_text, market, language, search_mode, version, created_by_user_id, created_by_name, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?
          where (select count(*) from prompts where website_id = ? and status <> 'deleted') < ?
            and ${room.sql} and ${group.sql} and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        groupId,
        input.intent,
        input.topic ?? null,
        input.scope,
        input.isCore,
        input.source,
        input.status,
        input.text,
        normalized,
        wording.market,
        wording.language,
        input.searchMode,
        scope.userId,
        scope.userName,
        changeId,
        now,
        now,
        scope.websiteId,
        MAX_PROMPTS_PER_WEBSITE,
        ...room.params,
        ...group.params,
        ...writable.params,
        ...actor.params,
      ),
      raw(
        `insert into prompt_versions (id, organization_id, website_id, prompt_id, version, text, normalized_text, market, language, search_mode,
           change_summary, created_by_user_id, created_by_name, approved_at, approved_by_user_id, approved_by_name, change_id, created_at)
         select ?, organization_id, website_id, id, 1, text, normalized_text, market, language, search_mode, ?, ?, ?, ?, ?, ?, ?, ?
           from prompts where id = ? and change_id = ?`,
        newId("pmv"),
        input.changeSummary ?? null,
        scope.userId,
        scope.userName,
        approved ? now : null,
        approved ? scope.userId : null,
        approved ? scope.userName : null,
        changeId,
        now,
        id,
        changeId,
      ),
      insertTagsStatement(context, scope, id, input.tags, guard),
      insertProductLinksStatement(context, scope, id, input.productIds, guard),
      activityStatement(promptActivity(context, scope, "prompt.created", id, { status: input.status, source: input.source, approved }), guard),
    ]);
  } catch (error) {
    rethrowDuplicate(error);
  }
  if (inserted === 0) {
    const usage = await activePromptUsage(context, scope.organizationId);
    if (activating && usage.used >= usage.limit) throw activeLimitReached();
    throw conflict("prompt_not_added", `The prompt was not added. A website can have up to ${MAX_PROMPTS_PER_WEBSITE} prompts; reload and try again.`);
  }
  context.commit();
  return {
    prompt: await loadDto(context, scope, id),
    nearDuplicates: await nearDuplicates(context, scope.websiteId, wording.market, wording.language, input.text, id),
  };
}

export async function getPrompt(context: ApiContext, scope: PromptAccess) {
  return {
    prompt: await loadDto(context, scope, scope.promptId),
    versions: await listVersions(context, scope),
    assignments: await listAssignments(context, scope),
  };
}

/** Organisation and tracking settings. Wording changes go through a new version instead. */
export async function updatePrompt(context: ApiContext, scope: PromptAccess, input: z.output<typeof updatePromptSchema>) {
  assertWritableWebsite(scope);
  const current = await loadDto(context, scope, scope.promptId);
  const next = {
    intent: input.intent ?? current.intent,
    topic: input.topic === undefined ? current.topic : input.topic,
    groupId: input.groupId === undefined ? current.groupId : input.groupId,
    scope: input.scope ?? current.scope,
    isCore: input.isCore ?? current.isCore,
    tags: input.tags ? [...input.tags].sort() : current.tags,
    productIds: input.productIds ? [...input.productIds].sort() : current.productIds,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((field) => JSON.stringify(next[field]) !== JSON.stringify(current[field]));
  if (changed.length === 0) throw invalid({ intent: "Nothing changed." });
  if (current.status === "archived") throw conflict("prompt_archived", "Restore the prompt before changing it.");
  await assertGroup(context, scope, next.groupId);
  if (changed.includes("productIds")) await assertProducts(context, scope, next.productIds);

  const blocked = await prepare(
    context.d1,
    raw(`select purpose as purpose from prompt_assignments where prompt_id = ? and removed_at is null and ? not in ('both', purpose) limit 1`, scope.promptId, next.scope),
  ).first<{ purpose: string }>();
  if (blocked) throw conflict("assignment_conflict", `Remove the ${blocked.purpose} assignment before limiting this prompt to ${next.scope}.`);

  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompts", id: scope.promptId, changeId });
  const group = groupExists(scope, next.groupId);
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const statements: Statement[] = [
    raw(
      `update prompts set intent = ?, topic = ?, group_id = ?, scope = ?, is_core = ?, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and website_id = ? and version = ? and status in ('draft', 'active', 'paused')
          and not exists (select 1 from prompt_assignments a where a.prompt_id = prompts.id and a.removed_at is null and ? not in ('both', a.purpose))
          and ${group.sql} and ${writable.sql} and ${actor.sql}`,
      next.intent,
      next.topic,
      next.groupId,
      next.scope,
      next.isCore,
      changeId,
      context.now,
      scope.promptId,
      scope.websiteId,
      input.version,
      next.scope,
      ...group.params,
      ...writable.params,
      ...actor.params,
    ),
  ];
  if (changed.includes("tags")) {
    statements.push(raw(`delete from prompt_tags where prompt_id = ? and ${guard.sql}`, scope.promptId, ...guard.params));
    statements.push(insertTagsStatement(context, scope, scope.promptId, next.tags, guard));
  }
  if (changed.includes("productIds")) {
    statements.push(raw(`delete from prompt_products where prompt_id = ? and ${guard.sql}`, scope.promptId, ...guard.params));
    statements.push(insertProductLinksStatement(context, scope, scope.promptId, next.productIds, guard));
  }
  statements.push(activityStatement(promptActivity(context, scope, "prompt.updated", scope.promptId, { fields: changed.join(",") }), guard));
  const [updated] = await atomic(context.d1, statements);
  if (updated === 0) throw versionConflict();
  return loadDto(context, scope, scope.promptId);
}

export async function changePromptStatus(context: ApiContext, scope: PromptAccess, input: z.output<typeof promptStatusSchema>) {
  assertWritableWebsite(scope);
  const current = await loadPromptRow(context, scope, scope.promptId);
  const target = nextPromptStatus(current.status, input.action);
  if (!target) throw conflict("invalid_transition", `You cannot ${input.action} a prompt that is ${current.status}.`);
  const activating = target === "active";
  const mayApprove = can(scope.role, "prompt.approve");
  if (activating && current.currentApprovedAt === null && !mayApprove) throw approvalRequired();

  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompts", id: scope.promptId, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const room = activating ? activePromptRoom(scope.organizationId, 1, raw("ap.id <> ?", scope.promptId)) : raw("1 = 1");
  // Without the right to approve, the wording that is current at the moment of the write must already be approved.
  const approvedWording =
    activating && !mayApprove
      ? "exists (select 1 from prompt_versions v where v.prompt_id = prompts.id and v.version = prompts.current_version and v.approved_at is not null)"
      : "1 = 1";
  const statements: Statement[] = [
    raw(
      `update prompts set status = ?, archived_at = case when ? = 'archived' then ? else null end, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and website_id = ? and version = ? and status = ? and ${approvedWording} and ${room.sql} and ${writable.sql} and ${actor.sql}`,
      target,
      target,
      context.now,
      changeId,
      context.now,
      scope.promptId,
      scope.websiteId,
      input.version,
      current.status,
      ...room.params,
      ...writable.params,
      ...actor.params,
    ),
  ];
  if (activating && mayApprove) statements.push(approveCurrentVersionsStatement(context, scope, changeId));
  statements.push(activityStatement(promptActivity(context, scope, `prompt.${input.action}`, scope.promptId, { from: current.status, to: target }), guard));
  const [updated] = await atomic(context.d1, statements);
  if (updated === 0) {
    if (activating) {
      const usage = await activePromptUsage(context, scope.organizationId);
      if (usage.used >= usage.limit) throw activeLimitReached();
    }
    throw versionConflict();
  }
  return loadDto(context, scope, scope.promptId);
}

/** A soft delete of an archived prompt. Its versions and history stay for anything that used them. */
export async function deletePrompt(context: ApiContext, scope: PromptAccess, input: z.output<typeof deletePromptSchema>) {
  assertWritableWebsite(scope);
  const current = await loadPromptRow(context, scope, scope.promptId);
  if (current.status !== "archived") throw conflict("not_archived", "Archive the prompt before deleting it.");

  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompts", id: scope.promptId, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [deleted] = await atomic(context.d1, [
    raw(
      `update prompts set status = 'deleted', deleted_at = ?, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and website_id = ? and version = ? and status = 'archived' and ${writable.sql} and ${actor.sql}`,
      context.now,
      changeId,
      context.now,
      scope.promptId,
      scope.websiteId,
      input.version,
      ...writable.params,
      ...actor.params,
    ),
    raw(`update prompt_assignments set removed_at = ?, updated_at = ? where prompt_id = ? and removed_at is null and ${guard.sql}`, context.now, context.now, scope.promptId, ...guard.params),
    activityStatement(promptActivity(context, scope, "prompt.deleted", scope.promptId), guard),
  ]);
  if (deleted === 0) throw versionConflict();
  return { id: scope.promptId, deleted: true as const };
}

/** What happened to one prompt, with who did it. */
export async function promptHistory(context: ApiContext, scope: PromptAccess) {
  const { results } = await prepare(
    context.d1,
    raw(
      `select id as id, action as action, actor_name as actorName, metadata as metadata, created_at as createdAt from activity_logs
        where organization_id = ? and website_id = ? and target_type = 'prompt' and target_id = ? order by created_at desc, id desc limit 200`,
      scope.organizationId,
      scope.websiteId,
      scope.promptId,
    ),
  ).all<{ id: string; action: string; actorName: string | null; metadata: string | null; createdAt: number }>();
  return results.map((row) => ({
    ...row,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {},
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}
