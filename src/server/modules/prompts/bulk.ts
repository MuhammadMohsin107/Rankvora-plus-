/**
 * One action on many prompts. Prompts the action does not apply to are skipped with a reason; the
 * rest change in one transaction. A single statement handles any number of ids.
 */
import { z } from "zod";

import { MAX_BULK_PROMPTS, MAX_TAGS_PER_PROMPT } from "../../config/limits";
import { atomic, prepare, raw, type Statement } from "../../db/atomic";
import type { PromptStatus } from "../../db/schema";
import { versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId } from "../../ids";
import { activityPerRowStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { can } from "../../tenancy/permissions";
import { websiteActivity } from "../websites/service";
import { approveCurrentVersionsStatement } from "./versions";
import { activeLimitReached, activePromptRoom, activePromptUsage, assertGroup, groupExists, tags } from "./shared";

export const BULK_ACTIONS = ["activate", "pause", "archive", "restore", "move_to_group", "add_tags", "remove_tags"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export const bulkSchema = z
  .strictObject({
    action: z.enum(BULK_ACTIONS),
    promptIds: z
      .array(z.string().min(1).max(64))
      .min(1, "Choose at least one prompt.")
      .max(MAX_BULK_PROMPTS, `Choose up to ${MAX_BULK_PROMPTS} prompts at a time.`)
      .transform((ids) => [...new Set(ids)]),
    /** For move_to_group; null means ungrouped. */
    groupId: z.string().max(64).nullable().optional(),
    tags: tags.optional(),
  })
  .superRefine((input, context) => {
    if (input.action === "move_to_group" && input.groupId === undefined) context.addIssue({ code: "custom", path: ["groupId"], message: "Choose a group, or null for ungrouped." });
    if ((input.action === "add_tags" || input.action === "remove_tags") && !input.tags?.length) context.addIssue({ code: "custom", path: ["tags"], message: "Add at least one tag." });
  });

const STATUS_ACTIONS: Partial<Record<BulkAction, { from: PromptStatus[]; to: PromptStatus }>> = {
  activate: { from: ["draft", "paused"], to: "active" },
  pause: { from: ["active"], to: "paused" },
  archive: { from: ["draft", "active", "paused"], to: "archived" },
  restore: { from: ["archived"], to: "draft" },
};

type Row = { id: string; status: PromptStatus; groupId: string | null; approvedAt: number | null; tagText: string | null };
export type SkipReason = "not_found" | "wrong_status" | "approval_required" | "no_change" | "too_many_tags" | "changed";

type Input = z.output<typeof bulkSchema>;

/** Why this prompt would not change, or null when it will. */
export function skipReason(row: Pick<Row, "status" | "groupId" | "approvedAt" | "tagText">, input: Pick<Input, "action" | "groupId" | "tags">, mayApprove: boolean): SkipReason | null {
  const move = STATUS_ACTIONS[input.action];
  if (move) {
    if (!move.from.includes(row.status)) return "wrong_status";
    if (move.to === "active" && row.approvedAt === null && !mayApprove) return "approval_required";
    return null;
  }
  if (row.status === "archived") return "wrong_status";
  if (input.action === "move_to_group") return (row.groupId ?? null) === (input.groupId ?? null) ? "no_change" : null;
  const current = new Set(row.tagText ? row.tagText.split("\n") : []);
  const wanted = input.tags ?? [];
  if (input.action === "remove_tags") return wanted.some((tag) => current.has(tag)) ? null : "no_change";
  if (wanted.every((tag) => current.has(tag))) return "no_change";
  return new Set([...current, ...wanted]).size > MAX_TAGS_PER_PROMPT ? "too_many_tags" : null;
}

export async function bulkPrompts(context: ApiContext, scope: WebsiteScope, input: Input) {
  assertWritableWebsite(scope);
  if (input.action === "move_to_group") await assertGroup(context, scope, input.groupId ?? null);
  const mayApprove = can(scope.role, "prompt.approve");
  const { results } = await prepare(
    context.d1,
    raw(
      `select p.id as id, p.status as status, p.group_id as groupId, cv.approved_at as approvedAt,
              (select group_concat(t.tag, char(10)) from prompt_tags t where t.prompt_id = p.id) as tagText
         from prompts p join prompt_versions cv on cv.prompt_id = p.id and cv.version = p.current_version
        where p.website_id = ? and p.organization_id = ? and p.status <> 'deleted' and p.id in (select value from json_each(?))`,
      scope.websiteId,
      scope.organizationId,
      JSON.stringify(input.promptIds),
    ),
  ).all<Row>();

  const found = new Map(results.map((row) => [row.id, row]));
  const skipped: { id: string; reason: SkipReason }[] = [];
  const eligible: string[] = [];
  for (const id of input.promptIds) {
    const row = found.get(id);
    const reason = row ? skipReason(row, input, mayApprove) : "not_found";
    if (reason) skipped.push({ id, reason });
    else eligible.push(id);
  }
  if (eligible.length === 0) return { applied: [] as string[], skipped };

  const changeId = newChangeId();
  const ids = JSON.stringify(eligible);
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const target = raw(`website_id = ? and organization_id = ? and id in (select value from json_each(?)) and ${writable.sql} and ${actor.sql}`, scope.websiteId, scope.organizationId, ids, ...writable.params, ...actor.params);
  const changedRows = raw("select id from prompts where change_id = ?", changeId);
  const move = STATUS_ACTIONS[input.action];
  const statements: Statement[] = [];

  if (move) {
    const activating = move.to === "active";
    const room = activating ? activePromptRoom(scope.organizationId, eligible.length, raw("ap.id not in (select value from json_each(?))", ids)) : raw("1 = 1");
    const approvedOnly =
      activating && !mayApprove
        ? "exists (select 1 from prompt_versions v where v.prompt_id = prompts.id and v.version = prompts.current_version and v.approved_at is not null)"
        : "1 = 1";
    statements.push(
      raw(
        `update prompts set status = ?, archived_at = case when ? = 'archived' then ? else null end, version = version + 1, change_id = ?, updated_at = ?
          where ${target.sql} and status in (select value from json_each(?)) and ${approvedOnly} and ${room.sql}`,
        move.to,
        move.to,
        context.now,
        changeId,
        context.now,
        ...target.params,
        JSON.stringify(move.from),
        ...room.params,
      ),
    );
    if (activating && mayApprove) statements.push(approveCurrentVersionsStatement(context, scope, changeId));
  } else {
    const group = input.action === "move_to_group" ? groupExists(scope, input.groupId ?? null) : raw("1 = 1");
    const setGroup = input.action === "move_to_group" ? "group_id = ?, " : "";
    statements.push(
      raw(
        `update prompts set ${setGroup}version = version + 1, change_id = ?, updated_at = ? where ${target.sql} and status in ('draft', 'active', 'paused') and ${group.sql}`,
        ...(input.action === "move_to_group" ? [input.groupId ?? null] : []),
        changeId,
        context.now,
        ...target.params,
        ...group.params,
      ),
    );
    if (input.action === "add_tags") {
      statements.push(
        raw(
          `insert or ignore into prompt_tags (prompt_id, organization_id, website_id, tag, created_at)
           select p.id, p.organization_id, p.website_id, j.value, ? from prompts p, json_each(?) j where p.change_id = ?`,
          context.now,
          JSON.stringify(input.tags),
          changeId,
        ),
      );
    }
    if (input.action === "remove_tags") {
      statements.push(raw(`delete from prompt_tags where tag in (select value from json_each(?)) and prompt_id in (${changedRows.sql})`, JSON.stringify(input.tags), ...changedRows.params));
    }
  }

  const event = websiteActivity(context, scope, scope.websiteId, `prompt.${input.action}`, { bulk: true }, { type: "prompt", id: "" });
  statements.push(activityPerRowStatement(event, changedRows));
  const [updated] = await atomic(context.d1, statements);
  if (updated === 0) {
    if (move?.to === "active") {
      const usage = await activePromptUsage(context, scope.organizationId);
      if (usage.used + eligible.length > usage.limit) throw activeLimitReached();
    }
    throw versionConflict();
  }

  const changed = await prepare(context.d1, changedRows).all<{ id: string }>();
  const applied = changed.results.map((row) => row.id);
  for (const id of eligible) if (!applied.includes(id)) skipped.push({ id, reason: "changed" });
  return { applied, skipped };
}
