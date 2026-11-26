/**
 * Assignments: where a prompt runs (audits, monitoring) and with which settings. The version it runs
 * is explicit: the newest approved one, or one pinned version. So editing a prompt never silently
 * changes a monitoring setup. Provider connections and model choice arrive in Phase 3.
 */
import { z } from "zod";

import { appliedClause, atomic, isUniqueViolation, prepare, raw, type Statement } from "../../db/atomic";
import {
  ASSIGNMENT_PROVIDERS,
  ASSIGNMENT_PURPOSES,
  SEARCH_MODES,
  VERSION_RULES,
  type AssignmentPurpose,
  type PromptScope,
  type PromptStatus,
  type VersionRule,
} from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type PromptAccess } from "../../tenancy/guard";
import { language, market, version } from "../../validation";
import { loadPromptRow, promptActivity } from "./shared";

const unique = <T>(values: T[]) => [...new Set(values)];
const providers = z.array(z.enum(ASSIGNMENT_PROVIDERS)).min(1, "Choose at least one AI provider.").max(ASSIGNMENT_PROVIDERS.length).transform(unique);
const markets = z.array(market).min(1, "Choose at least one market.").max(10).transform(unique);
const languages = z.array(language).min(1, "Choose at least one language.").max(10).transform(unique);
const searchModes = z.array(z.enum(SEARCH_MODES)).min(1, "Choose at least one search mode.").max(SEARCH_MODES.length).transform(unique);
const samples = z.number().int().min(1, "At least 1 sample.").max(10, "At most 10 samples.");

export const createAssignmentSchema = z.strictObject({
  purpose: z.enum(ASSIGNMENT_PURPOSES, { error: "Choose audit or monitoring." }),
  versionRule: z.enum(VERSION_RULES).default("latest_approved"),
  pinnedVersionId: z.string().max(64).nullish(),
  providers,
  samples: samples.default(1),
  /** Default to the prompt's own market, language and search mode. */
  markets: markets.optional(),
  languages: languages.optional(),
  searchModes: searchModes.optional(),
});

export const updateAssignmentSchema = z
  .strictObject({
    version,
    versionRule: z.enum(VERSION_RULES).optional(),
    pinnedVersionId: z.string().max(64).nullable().optional(),
    providers: providers.optional(),
    samples: samples.optional(),
    markets: markets.optional(),
    languages: languages.optional(),
    searchModes: searchModes.optional(),
  })
  .refine((input) => Object.keys(input).length > 1, { message: "Nothing to change.", path: ["providers"] });

export const removeAssignmentSchema = z.strictObject({ version });

/** The permission an assignment needs follows what it will run. */
export const permissionFor = (purpose: AssignmentPurpose): "monitoring.configure" | "audit.create" =>
  purpose === "monitoring" ? "monitoring.configure" : "audit.create";

/** A prompt limited to audits cannot be assigned to monitoring, and the other way round. */
export const scopeAllows = (scope: PromptScope, purpose: AssignmentPurpose) => scope === "both" || scope === purpose;

type Row = {
  id: string;
  purpose: AssignmentPurpose;
  versionRule: VersionRule;
  pinnedVersionId: string | null;
  providers: string;
  markets: string;
  languages: string;
  searchModes: string;
  samples: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  effectiveVersionId: string | null;
  effectiveVersion: number | null;
};

// The version that would run now: the pinned one, or the newest approved one.
const SELECT = `select a.id as id, a.purpose as purpose, a.version_rule as versionRule, a.pinned_version_id as pinnedVersionId,
    a.providers as providers, a.markets as markets, a.languages as languages, a.search_modes as searchModes, a.samples as samples,
    a.version as version, a.created_at as createdAt, a.updated_at as updatedAt, e.id as effectiveVersionId, e.version as effectiveVersion
  from prompt_assignments a
  left join prompt_versions e on e.id = case a.version_rule
      when 'pinned' then a.pinned_version_id
      else (select x.id from prompt_versions x where x.prompt_id = a.prompt_id and x.approved_at is not null order by x.version desc limit 1)
    end`;

export type RunState = "ready" | "prompt_not_active" | "no_approved_version";

export function runState(promptStatus: PromptStatus, effectiveVersionId: string | null): RunState {
  if (promptStatus !== "active") return "prompt_not_active";
  return effectiveVersionId ? "ready" : "no_approved_version";
}

const toDto = (row: Row, promptStatus: PromptStatus) => ({
  ...row,
  providers: JSON.parse(row.providers) as string[],
  markets: JSON.parse(row.markets) as string[],
  languages: JSON.parse(row.languages) as string[],
  searchModes: JSON.parse(row.searchModes) as string[],
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
  state: runState(promptStatus, row.effectiveVersionId),
});

export async function listAssignments(context: ApiContext, scope: PromptAccess) {
  const prompt = await loadPromptRow(context, scope, scope.promptId);
  const { results } = await prepare(context.d1, raw(`${SELECT} where a.prompt_id = ? and a.removed_at is null order by a.purpose`, scope.promptId)).all<Row>();
  return results.map((row) => toDto(row, prompt.status));
}

export async function findAssignment(context: ApiContext, scope: PromptAccess, assignmentId: string) {
  const row = await prepare(context.d1, raw(`${SELECT} where a.id = ? and a.prompt_id = ? and a.removed_at is null`, assignmentId, scope.promptId)).first<Row>();
  if (!row) throw notFound();
  return row;
}

/** A pinned version must belong to this prompt and be approved. */
async function assertPinnable(context: ApiContext, scope: PromptAccess, versionId: string) {
  const row = await prepare(context.d1, raw(`select approved_at as approvedAt from prompt_versions where id = ? and prompt_id = ?`, versionId, scope.promptId)).first<{
    approvedAt: number | null;
  }>();
  if (!row) throw invalid({ pinnedVersionId: "That version is not part of this prompt." });
  if (row.approvedAt === null) throw invalid({ pinnedVersionId: "Only an approved version can be pinned." });
}

/** The prompt can still take this kind of assignment, checked inside the write. */
function promptAccepts(scope: PromptAccess, purpose: AssignmentPurpose): Statement {
  return raw(`exists (select 1 from prompts p where p.id = ? and p.status in ('draft', 'active', 'paused') and p.scope in ('both', ?))`, scope.promptId, purpose);
}

export async function createAssignment(context: ApiContext, scope: PromptAccess, input: z.output<typeof createAssignmentSchema>) {
  assertWritableWebsite(scope);
  const prompt = await loadPromptRow(context, scope, scope.promptId);
  if (prompt.status === "archived") throw conflict("prompt_archived", "Restore the prompt before assigning it.");
  if (!scopeAllows(prompt.scope, input.purpose)) {
    throw conflict("scope_not_allowed", `This prompt is limited to ${prompt.scope}. Change its scope first.`);
  }
  const pinned = input.pinnedVersionId ?? null;
  if ((input.versionRule === "pinned") !== (pinned !== null)) throw invalid({ pinnedVersionId: "Give a version only when the rule is pinned." });
  if (pinned) await assertPinnable(context, scope, pinned);

  const id = newId("pas");
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const accepts = promptAccepts(scope, input.purpose);
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into prompt_assignments (id, organization_id, website_id, prompt_id, purpose, version_rule, pinned_version_id, providers, markets, languages,
           search_modes, samples, version, created_by_user_id, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ? where ${accepts.sql} and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        scope.promptId,
        input.purpose,
        input.versionRule,
        pinned,
        JSON.stringify(input.providers),
        JSON.stringify(input.markets ?? [prompt.market]),
        JSON.stringify(input.languages ?? [prompt.language]),
        JSON.stringify(input.searchModes ?? [prompt.searchMode]),
        input.samples,
        scope.userId,
        changeId,
        context.now,
        context.now,
        ...accepts.params,
        ...writable.params,
        ...actor.params,
      ),
      activityStatement(
        promptActivity(context, scope, "prompt.assignment_added", scope.promptId, { purpose: input.purpose, versionRule: input.versionRule }),
        appliedClause({ table: "prompt_assignments", id, changeId }),
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "prompt_assignments.prompt_id", "prompt_assignments.purpose")) {
      throw conflict("assignment_exists", `This prompt already has a ${input.purpose} assignment. Change that one.`);
    }
    throw error;
  }
  if (inserted === 0) throw conflict("prompt_changed", "This prompt changed. Reload and try again.");
  context.commit();
  return listAssignments(context, scope);
}

export async function updateAssignment(context: ApiContext, scope: PromptAccess, assignmentId: string, input: z.output<typeof updateAssignmentSchema>) {
  assertWritableWebsite(scope);
  const current = await findAssignment(context, scope, assignmentId);
  const versionRule = input.versionRule ?? current.versionRule;
  const pinned = versionRule === "latest_approved" ? null : input.pinnedVersionId === undefined ? current.pinnedVersionId : input.pinnedVersionId;
  if (versionRule === "pinned" && !pinned) throw invalid({ pinnedVersionId: "Choose the version to pin." });
  if (input.versionRule === "latest_approved" && input.pinnedVersionId) throw invalid({ pinnedVersionId: "Give a version only when the rule is pinned." });
  if (pinned && pinned !== current.pinnedVersionId) await assertPinnable(context, scope, pinned);

  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update prompt_assignments set version_rule = ?, pinned_version_id = ?, providers = ?, markets = ?, languages = ?, search_modes = ?, samples = ?,
          version = version + 1, change_id = ?, updated_at = ?
        where id = ? and prompt_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
      versionRule,
      pinned,
      input.providers ? JSON.stringify(input.providers) : current.providers,
      input.markets ? JSON.stringify(input.markets) : current.markets,
      input.languages ? JSON.stringify(input.languages) : current.languages,
      input.searchModes ? JSON.stringify(input.searchModes) : current.searchModes,
      input.samples ?? current.samples,
      changeId,
      context.now,
      assignmentId,
      scope.promptId,
      input.version,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(
      promptActivity(context, scope, "prompt.assignment_changed", scope.promptId, { purpose: current.purpose, versionRule }),
      appliedClause({ table: "prompt_assignments", id: assignmentId, changeId }),
    ),
  ]);
  if (updated === 0) throw versionConflict();
  return listAssignments(context, scope);
}

export async function removeAssignment(context: ApiContext, scope: PromptAccess, assignmentId: string, input: z.output<typeof removeAssignmentSchema>) {
  assertWritableWebsite(scope);
  const current = await findAssignment(context, scope, assignmentId);
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update prompt_assignments set removed_at = ?, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and prompt_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
      context.now,
      changeId,
      context.now,
      assignmentId,
      scope.promptId,
      input.version,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(
      promptActivity(context, scope, "prompt.assignment_removed", scope.promptId, { purpose: current.purpose }),
      appliedClause({ table: "prompt_assignments", id: assignmentId, changeId }),
    ),
  ]);
  if (updated === 0) throw versionConflict();
  return listAssignments(context, scope);
}
