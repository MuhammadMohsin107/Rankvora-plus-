/** Prompt groups. Deleting a group leaves its prompts ungrouped. */
import { z } from "zod";

import { MAX_PROMPT_GROUPS_PER_WEBSITE } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { version } from "../../validation";
import { websiteActivity } from "../websites/service";
import { groupName } from "./shared";

export const createGroupSchema = z.strictObject({ name: groupName });
export const renameGroupSchema = z.strictObject({ version, name: groupName });
export const removeGroupSchema = z.strictObject({ version });

type Row = { id: string; name: string; version: number; prompts: number };

const exists = () => conflict("group_exists", "A group with this name already exists.");

export async function listGroups(context: ApiContext, scope: WebsiteScope) {
  const { results } = await prepare(
    context.d1,
    raw(
      `select g.id as id, g.name as name, g.version as version,
              (select count(*) from prompts p where p.group_id = g.id and p.status <> 'deleted') as prompts
         from prompt_groups g where g.website_id = ? and g.organization_id = ? and g.removed_at is null order by g.name_key limit ?`,
      scope.websiteId,
      scope.organizationId,
      MAX_PROMPT_GROUPS_PER_WEBSITE,
    ),
  ).all<Row>();
  return results;
}

const activity = (context: ApiContext, scope: WebsiteScope, action: string, groupId: string, name: string) =>
  websiteActivity(context, scope, scope.websiteId, action, { name }, { type: "prompt_group", id: groupId });

async function findGroup(context: ApiContext, scope: WebsiteScope, groupId: string) {
  const row = await prepare(
    context.d1,
    raw(`select id as id, name as name, version as version from prompt_groups where id = ? and website_id = ? and organization_id = ? and removed_at is null`, groupId, scope.websiteId, scope.organizationId),
  ).first<{ id: string; name: string; version: number }>();
  if (!row) throw notFound();
  return row;
}

export async function createGroup(context: ApiContext, scope: WebsiteScope, input: z.output<typeof createGroupSchema>) {
  assertWritableWebsite(scope);
  const id = newId("pgr");
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into prompt_groups (id, organization_id, website_id, name, name_key, version, created_by_user_id, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, 1, ?, ?, ?, ?
          where (select count(*) from prompt_groups where website_id = ? and removed_at is null) < ? and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        input.name,
        input.name.toLowerCase(),
        scope.userId,
        changeId,
        context.now,
        context.now,
        scope.websiteId,
        MAX_PROMPT_GROUPS_PER_WEBSITE,
        ...writable.params,
        ...actor.params,
      ),
      activityStatement(activity(context, scope, "prompt_group.created", id, input.name), appliedClause({ table: "prompt_groups", id, changeId })),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "prompt_groups.website_id", "prompt_groups.name_key")) throw exists();
    throw error;
  }
  if (inserted === 0) throw conflict("group_limit_reached", `A website can have up to ${MAX_PROMPT_GROUPS_PER_WEBSITE} groups. Reload and try again.`);
  context.commit();
  return listGroups(context, scope);
}

export async function renameGroup(context: ApiContext, scope: WebsiteScope, groupId: string, input: z.output<typeof renameGroupSchema>) {
  assertWritableWebsite(scope);
  const group = await findGroup(context, scope, groupId);
  if (group.name === input.name) throw invalid({ name: "Nothing changed." });
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  let updated: number;
  try {
    [updated] = await atomic(context.d1, [
      raw(
        `update prompt_groups set name = ?, name_key = ?, version = version + 1, change_id = ?, updated_at = ?
          where id = ? and website_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
        input.name,
        input.name.toLowerCase(),
        changeId,
        context.now,
        groupId,
        scope.websiteId,
        input.version,
        ...writable.params,
        ...actor.params,
      ),
      activityStatement(activity(context, scope, "prompt_group.renamed", groupId, input.name), appliedClause({ table: "prompt_groups", id: groupId, changeId })),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "prompt_groups.website_id", "prompt_groups.name_key")) throw exists();
    throw error;
  }
  if (updated === 0) throw versionConflict();
  return listGroups(context, scope);
}

export async function removeGroup(context: ApiContext, scope: WebsiteScope, groupId: string, input: z.output<typeof removeGroupSchema>) {
  assertWritableWebsite(scope);
  const group = await findGroup(context, scope, groupId);
  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompt_groups", id: groupId, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [removed] = await atomic(context.d1, [
    raw(
      `update prompt_groups set removed_at = ?, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and website_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
      context.now,
      changeId,
      context.now,
      groupId,
      scope.websiteId,
      input.version,
      ...writable.params,
      ...actor.params,
    ),
    raw(`update prompts set group_id = null, updated_at = ? where group_id = ? and website_id = ? and ${guard.sql}`, context.now, groupId, scope.websiteId, ...guard.params),
    activityStatement(activity(context, scope, "prompt_group.removed", groupId, group.name), guard),
  ]);
  if (removed === 0) throw versionConflict();
  return listGroups(context, scope);
}
