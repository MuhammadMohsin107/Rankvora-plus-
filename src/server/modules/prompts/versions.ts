/**
 * Prompt versions. Every change to the wording, market, language or search mode makes a new version;
 * earlier ones never change. A version runs only once someone allowed to has approved it.
 */
import { z } from "zod";

import { normalisePrompt } from "@/lib/prompt-text";

import { appliedClause, atomic, prepare, raw, type Statement } from "../../db/atomic";
import { SEARCH_MODES, type SearchMode } from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type PromptAccess } from "../../tenancy/guard";
import { can } from "../../tenancy/permissions";
import { language, market, version } from "../../validation";
import { brandNames } from "../brand/profile";
import {
  approvalRequired,
  changeSummary,
  decoratePrompts,
  duplicatePrompt,
  findExactWording,
  loadPromptRow,
  nearDuplicates,
  promptActivity,
  promptText,
  rethrowDuplicate,
} from "./shared";

export const newVersionSchema = z.strictObject({
  version,
  text: promptText.optional(),
  market: market.optional(),
  language: language.optional(),
  searchMode: z.enum(SEARCH_MODES).optional(),
  changeSummary: changeSummary.nullish(),
  /** Approve the new wording at once. Needs permission to approve. */
  approve: z.boolean().default(false),
});

type VersionRow = {
  id: string;
  version: number;
  text: string;
  market: string;
  language: string;
  searchMode: SearchMode;
  changeSummary: string | null;
  createdByName: string;
  approvedAt: number | null;
  approvedByName: string | null;
  createdAt: number;
};

const VERSION_SELECT = `select id as id, version as version, text as text, market as market, language as language, search_mode as searchMode,
    change_summary as changeSummary, created_by_name as createdByName, approved_at as approvedAt, approved_by_name as approvedByName, created_at as createdAt
  from prompt_versions`;

const toDto = (row: VersionRow) => ({
  ...row,
  approvedAt: row.approvedAt === null ? null : new Date(row.approvedAt).toISOString(),
  createdAt: new Date(row.createdAt).toISOString(),
});

export async function listVersions(context: ApiContext, scope: PromptAccess) {
  const { results } = await prepare(context.d1, raw(`${VERSION_SELECT} where prompt_id = ? order by version desc limit 200`, scope.promptId)).all<VersionRow>();
  return results.map(toDto);
}

/** Approves the newest version of every prompt changed by `changeId` that has not been approved yet. */
export function approveCurrentVersionsStatement(context: ApiContext, scope: { userId: string; userName: string }, changeId: string): Statement {
  return raw(
    `update prompt_versions set approved_at = ?, approved_by_user_id = ?, approved_by_name = ?, change_id = ?
      where approved_at is null
        and exists (select 1 from prompts p where p.id = prompt_versions.prompt_id and p.change_id = ? and p.current_version = prompt_versions.version)`,
    context.now,
    scope.userId,
    scope.userName,
    changeId,
    changeId,
  );
}

export async function createVersion(context: ApiContext, scope: PromptAccess, input: z.output<typeof newVersionSchema>) {
  assertWritableWebsite(scope);
  const prompt = await loadPromptRow(context, scope, scope.promptId);
  if (prompt.status === "archived") throw conflict("prompt_archived", "Restore the prompt before changing its wording.");
  if (input.approve && !can(scope.role, "prompt.approve")) throw approvalRequired();
  const next = {
    text: input.text ?? prompt.text,
    market: input.market ?? prompt.market,
    language: input.language ?? prompt.language,
    searchMode: input.searchMode ?? prompt.searchMode,
  };
  if (next.text === prompt.text && next.market === prompt.market && next.language === prompt.language && next.searchMode === prompt.searchMode) {
    throw invalid({ text: "Nothing changed." });
  }
  const normalized = normalisePrompt(next.text);
  const existing = await findExactWording(context, scope.websiteId, next.market, next.language, normalized, scope.promptId);
  if (existing) throw duplicatePrompt(existing.id);

  const changeId = newChangeId();
  const guard = appliedClause({ table: "prompts", id: scope.promptId, changeId });
  const number = prompt.currentVersion + 1;
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const approvedAt = input.approve ? context.now : null;
  let updated: number;
  try {
    [updated] = await atomic(context.d1, [
      raw(
        `update prompts set text = ?, normalized_text = ?, market = ?, language = ?, search_mode = ?, current_version = ?, version = version + 1, change_id = ?, updated_at = ?
          where id = ? and website_id = ? and version = ? and current_version = ? and status in ('draft', 'active', 'paused') and ${writable.sql} and ${actor.sql}`,
        next.text,
        normalized,
        next.market,
        next.language,
        next.searchMode,
        number,
        changeId,
        context.now,
        scope.promptId,
        scope.websiteId,
        input.version,
        prompt.currentVersion,
        ...writable.params,
        ...actor.params,
      ),
      raw(
        `insert into prompt_versions (id, organization_id, website_id, prompt_id, version, text, normalized_text, market, language, search_mode,
           change_summary, created_by_user_id, created_by_name, approved_at, approved_by_user_id, approved_by_name, change_id, created_at)
         select ?, organization_id, website_id, id, current_version, text, normalized_text, market, language, search_mode, ?, ?, ?, ?, ?, ?, ?, ?
           from prompts where id = ? and change_id = ?`,
        newId("pmv"),
        input.changeSummary ?? null,
        scope.userId,
        scope.userName,
        approvedAt,
        input.approve ? scope.userId : null,
        input.approve ? scope.userName : null,
        changeId,
        context.now,
        scope.promptId,
        changeId,
      ),
      activityStatement(promptActivity(context, scope, "prompt.version_created", scope.promptId, { version: number, approved: input.approve }), guard),
    ]);
  } catch (error) {
    rethrowDuplicate(error);
  }
  if (updated === 0) throw versionConflict();
  context.commit();
  const [dto] = await decoratePrompts(context, [await loadPromptRow(context, scope, scope.promptId)], await brandNames(context, scope));
  return { prompt: dto, nearDuplicates: await nearDuplicates(context, scope.websiteId, next.market, next.language, next.text, scope.promptId) };
}

export async function approveVersion(context: ApiContext, scope: PromptAccess, versionId: string) {
  assertWritableWebsite(scope);
  const row = await prepare(context.d1, raw(`${VERSION_SELECT} where id = ? and prompt_id = ?`, versionId, scope.promptId)).first<VersionRow>();
  if (!row) throw notFound();
  if (row.approvedAt !== null) throw conflict("already_approved", "This version is already approved.");

  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update prompt_versions set approved_at = ?, approved_by_user_id = ?, approved_by_name = ?, change_id = ?
        where id = ? and prompt_id = ? and approved_at is null
          and exists (select 1 from prompts where id = ? and status in ('draft', 'active', 'paused'))
          and ${writable.sql} and ${actor.sql}`,
      context.now,
      scope.userId,
      scope.userName,
      changeId,
      versionId,
      scope.promptId,
      scope.promptId,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(
      promptActivity(context, scope, "prompt.version_approved", scope.promptId, { version: row.version }),
      appliedClause({ table: "prompt_versions", id: versionId, changeId }),
    ),
  ]);
  if (updated === 0) throw conflict("prompt_changed", "This prompt changed. Reload and try again.");
  return listVersions(context, scope);
}
