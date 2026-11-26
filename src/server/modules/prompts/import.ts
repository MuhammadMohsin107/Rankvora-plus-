/**
 * CSV import. The same request previews (dryRun) and saves. The server always works out the rows
 * itself, never trusting a preview from the browser, and saves them all or none in one transaction.
 */
import { z } from "zod";

import { CsvError, parseCsvObjects } from "@/lib/csv";
import { NEAR_DUPLICATE_THRESHOLD, normalisePrompt, overlap, wordSet } from "@/lib/prompt-text";

import { MAX_IMPORT_BODY_BYTES, MAX_IMPORT_ROWS, MAX_PROMPT_GROUPS_PER_WEBSITE, MAX_PROMPTS_PER_WEBSITE } from "../../config/limits";
import { atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import { PROMPT_INTENTS, PROMPT_SCOPES, SEARCH_MODES, type PromptIntent, type PromptScope, type SearchMode } from "../../db/schema";
import { conflict, invalid } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityPerRowStatement, activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { can } from "../../tenancy/permissions";
import { language, market } from "../../validation";
import { websiteActivity } from "../websites/service";
import { listGroups } from "./groups";
import { activePromptRoom, activePromptUsage, groupName, promptText, tags, topic } from "./shared";

export const IMPORT_COLUMNS = ["prompt_text", "intent", "topic", "group", "language", "country", "status", "tracking_scope", "is_core", "search_mode", "tags"] as const;

export const importSchema = z.strictObject({
  csv: z.string({ error: "csv is required." }).min(1, "The file is empty.").max(MAX_IMPORT_BODY_BYTES, "The file is too large."),
  dryRun: z.boolean().default(true),
  /** Used for rows without a search_mode. */
  searchMode: z.enum(SEARCH_MODES).default("web_grounded_auto"),
});

type RowDefaults = { market: string; language: string; searchMode: SearchMode; mayApprove: boolean };

export type ImportRow = {
  /** Line in the file; the header is line 1. */
  line: number;
  text: string;
  intent: PromptIntent;
  topic: string | null;
  group: string | null;
  scope: PromptScope;
  status: "draft" | "active" | "paused";
  market: string;
  language: string;
  searchMode: SearchMode;
  isCore: boolean;
  tags: string[];
  result: "create" | "duplicate" | "invalid";
  notes: string[];
};

const key = (value: string) => value.trim().toLowerCase().replace(/[\s/-]+/g, "_");

function boolean(value: string): boolean | null {
  const text = value.trim().toLowerCase();
  if (text === "" || ["false", "no", "n", "0"].includes(text)) return false;
  return ["true", "yes", "y", "1"].includes(text) ? true : null;
}

/** Checks one CSV record. Pure: duplicates are decided later, against the library and the file. */
export function readImportRow(record: Record<string, string>, line: number, defaults: RowDefaults): ImportRow {
  const problems: string[] = [];
  const notes: string[] = [];
  const check = <T>(label: string, schema: z.ZodType<T>, value: unknown, fallback: T): T => {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    problems.push(`${label}: ${result.error.issues[0].message}`);
    return fallback;
  };
  const choice = <T extends string>(label: string, options: readonly T[], value: string, fallback: T): T => {
    if (!value.trim()) return fallback;
    const match = options.find((option) => option === key(value));
    if (!match) problems.push(`${label} must be one of ${options.join(", ")}.`);
    return match ?? fallback;
  };

  const text = check("Text", promptText as z.ZodType<string>, record.prompt_text ?? "", (record.prompt_text ?? "").trim());
  if (!record.intent?.trim()) notes.push("Intent defaults to discovery.");
  const intent = choice("Intent", PROMPT_INTENTS, record.intent ?? "", "discovery");
  const scope = choice("Tracking scope", PROMPT_SCOPES, record.tracking_scope ?? "", "both");
  const status = choice("Status", ["draft", "active", "paused"] as const, record.status ?? "", "draft");
  const searchMode = choice("Search mode", SEARCH_MODES, record.search_mode ?? "", defaults.searchMode);
  if (status === "active" && !defaults.mayApprove) problems.push("Only a manager, admin or owner can import active prompts. Use draft.");
  const topicText = record.topic?.trim() ? check("Topic", topic as z.ZodType<string>, record.topic, "") : null;
  const group = record.group?.trim() ? check("Group", groupName as z.ZodType<string>, record.group, "") : null;
  const marketCode = check("Country", market as z.ZodType<string>, record.country?.trim() || defaults.market, defaults.market);
  const languageTag = check("Language", language as z.ZodType<string>, record.language?.trim() || defaults.language, defaults.language);
  const isCore = boolean(record.is_core ?? "");
  if (isCore === null) problems.push("is_core must be true or false.");
  const tagList = check("Tags", tags as z.ZodType<string[]>, (record.tags ?? "").split(";").map((tag) => tag.trim()).filter(Boolean), []);

  return {
    line,
    text,
    intent,
    topic: topicText,
    group,
    scope,
    status,
    market: marketCode,
    language: languageTag,
    searchMode,
    isCore: isCore === true,
    tags: tagList,
    result: problems.length ? "invalid" : "create",
    notes: problems.length ? problems : notes,
  };
}

const wordingKey = (row: { market: string; language: string }, normalized: string) => `${row.market}|${row.language}|${normalized}`;

async function planImport(context: ApiContext, scope: WebsiteScope, input: z.output<typeof importSchema>) {
  let records: Record<string, string>[];
  try {
    records = parseCsvObjects(input.csv);
  } catch (error) {
    if (error instanceof CsvError) throw invalid({ csv: error.message });
    throw error;
  }
  if (records.length === 0) throw invalid({ csv: "No data rows under the header." });
  const headers = Object.keys(records[0]);
  if (!headers.includes("prompt_text")) throw invalid({ csv: "The prompt_text column is missing." });
  if (records.length > MAX_IMPORT_ROWS) throw invalid({ csv: `${records.length} rows found. Import up to ${MAX_IMPORT_ROWS} at a time.` });

  const website = await prepare(context.d1, raw(`select market as market, language as language from websites where id = ?`, scope.websiteId)).first<{ market: string; language: string }>();
  const defaults: RowDefaults = {
    market: website?.market ?? "",
    language: website?.language ?? "",
    searchMode: input.searchMode,
    mayApprove: can(scope.role, "prompt.approve"),
  };
  const { results: library } = await prepare(
    context.d1,
    raw(`select market as market, language as language, normalized_text as normalized, text as text from prompts where website_id = ? and status <> 'deleted' limit ?`, scope.websiteId, MAX_PROMPTS_PER_WEBSITE),
  ).all<{ market: string; language: string; normalized: string; text: string }>();
  const groups = await listGroups(context, scope);

  const existing = new Set(library.map((row) => wordingKey(row, row.normalized)));
  const seen = new Map<string, number>();
  // Similarity notes compare every pair, so they are skipped when that would be too much work.
  const compare = library.length * records.length <= 100_000 ? library.map((row) => ({ words: wordSet(row.text), text: row.text })) : [];
  const rows = records.map((record, index) => {
    const row = readImportRow(record, index + 2, defaults);
    if (row.result === "invalid") return row;
    const id = wordingKey(row, normalisePrompt(row.text));
    const earlier = seen.get(id);
    if (earlier !== undefined) return { ...row, result: "duplicate" as const, notes: [`Repeats line ${earlier}.`] };
    if (existing.has(id)) return { ...row, result: "duplicate" as const, notes: ["Already in the library."] };
    seen.set(id, row.line);
    const words = wordSet(row.text);
    const similar = compare.find((item) => overlap(words, item.words) >= NEAR_DUPLICATE_THRESHOLD);
    return similar ? { ...row, notes: [...row.notes, `Similar to “${similar.text.slice(0, 80)}”.`] } : row;
  });

  const creates = rows.filter((row) => row.result === "create");
  const known = new Set(groups.map((group) => group.name.toLowerCase()));
  const newGroups = [...new Map(creates.filter((row) => row.group && !known.has(row.group.toLowerCase())).map((row) => [row.group!.toLowerCase(), row.group!])).values()];
  const active = creates.filter((row) => row.status === "active").length;
  const usage = await activePromptUsage(context, scope.organizationId);
  const activeSlotsLeft = Math.max(usage.limit - usage.used, 0);

  const blockedReason =
    library.length + creates.length > MAX_PROMPTS_PER_WEBSITE
      ? `A website can have up to ${MAX_PROMPTS_PER_WEBSITE} prompts; this file would pass that.`
      : groups.length + newGroups.length > MAX_PROMPT_GROUPS_PER_WEBSITE
        ? `A website can have up to ${MAX_PROMPT_GROUPS_PER_WEBSITE} groups.`
        : active > activeSlotsLeft
          ? `Only ${activeSlotsLeft} more prompts can be active. Change some rows to draft.`
          : null;

  return {
    rows,
    newGroups,
    ignoredColumns: headers.filter((header) => !(IMPORT_COLUMNS as readonly string[]).includes(header)),
    summary: {
      create: creates.length,
      duplicate: rows.filter((row) => row.result === "duplicate").length,
      invalid: rows.filter((row) => row.result === "invalid").length,
      active,
    },
    activeSlotsLeft,
    blockedReason,
  };
}

export async function importPrompts(context: ApiContext, scope: WebsiteScope, input: z.output<typeof importSchema>) {
  assertWritableWebsite(scope);
  const plan = await planImport(context, scope, input);
  if (input.dryRun) return { ...plan, saved: false as const };
  if (plan.blockedReason) throw conflict("import_blocked", plan.blockedReason);
  const creates = plan.rows.filter((row) => row.result === "create");
  if (creates.length === 0) throw invalid({ csv: "There is nothing new to import." });

  const changeId = newChangeId();
  const { now } = context;
  const items = creates.map((row) => ({
    id: newId("prm"),
    versionId: newId("pmv"),
    groupKey: row.group?.toLowerCase() ?? null,
    text: row.text,
    normalized: normalisePrompt(row.text),
    intent: row.intent,
    topic: row.topic,
    scope: row.scope,
    status: row.status,
    market: row.market,
    language: row.language,
    searchMode: row.searchMode,
    isCore: row.isCore,
    tags: row.tags,
  }));
  const groupRows = plan.newGroups.map((name) => ({ id: newId("pgr"), name, key: name.toLowerCase() }));
  const groupKeys = [...new Set(items.map((item) => item.groupKey).filter((value): value is string => value !== null))];
  const json = JSON.stringify(items);

  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  // Rows of this import are left out of both counts, so the answer is the same before and after they are added.
  const totalRoom = raw(
    `(select count(*) from prompts where website_id = ? and status <> 'deleted' and coalesce(change_id, '') <> ?) + ? <= ?`,
    scope.websiteId,
    changeId,
    items.length,
    MAX_PROMPTS_PER_WEBSITE,
  );
  const room = activePromptRoom(scope.organizationId, plan.summary.active, raw("coalesce(ap.change_id, '') <> ?", changeId));
  const allowed = raw(`${totalRoom.sql} and ${room.sql} and ${writable.sql} and ${actor.sql}`, ...totalRoom.params, ...room.params, ...writable.params, ...actor.params);
  const imported = raw("select id from prompts where change_id = ?", changeId);

  let changes: number[];
  try {
    changes = await atomic(context.d1, [
      raw(
        `insert or ignore into prompt_groups (id, organization_id, website_id, name, name_key, version, created_by_user_id, change_id, created_at, updated_at)
         select json_extract(j.value, '$.id'), ?, ?, json_extract(j.value, '$.name'), json_extract(j.value, '$.key'), 1, ?, ?, ?, ?
           from json_each(?) j
          where ${allowed.sql} and (select count(*) from prompt_groups where website_id = ? and removed_at is null) + ? <= ?`,
        scope.organizationId,
        scope.websiteId,
        scope.userId,
        changeId,
        now,
        now,
        JSON.stringify(groupRows),
        ...allowed.params,
        scope.websiteId,
        groupRows.length,
        MAX_PROMPT_GROUPS_PER_WEBSITE,
      ),
      // Every group the rows name must exist now, or nothing is imported.
      raw(
        `insert into prompts (id, organization_id, website_id, group_id, intent, topic, scope, is_core, source, status, current_version, text,
           normalized_text, market, language, search_mode, version, created_by_user_id, created_by_name, change_id, created_at, updated_at)
         select json_extract(j.value, '$.id'), ?, ?,
                (select g.id from prompt_groups g where g.website_id = ? and g.name_key = json_extract(j.value, '$.groupKey') and g.removed_at is null),
                json_extract(j.value, '$.intent'), json_extract(j.value, '$.topic'), json_extract(j.value, '$.scope'), json_extract(j.value, '$.isCore'),
                'imported', json_extract(j.value, '$.status'), 1, json_extract(j.value, '$.text'), json_extract(j.value, '$.normalized'),
                json_extract(j.value, '$.market'), json_extract(j.value, '$.language'), json_extract(j.value, '$.searchMode'), 1, ?, ?, ?, ?, ?
           from json_each(?) j
          where ${allowed.sql}
            and (select count(*) from prompt_groups where website_id = ? and removed_at is null and name_key in (select value from json_each(?))) = ?`,
        scope.organizationId,
        scope.websiteId,
        scope.websiteId,
        scope.userId,
        scope.userName,
        changeId,
        now,
        now,
        json,
        ...allowed.params,
        scope.websiteId,
        JSON.stringify(groupKeys),
        groupKeys.length,
      ),
      raw(
        `insert into prompt_versions (id, organization_id, website_id, prompt_id, version, text, normalized_text, market, language, search_mode,
           change_summary, created_by_user_id, created_by_name, approved_at, approved_by_user_id, approved_by_name, change_id, created_at)
         select json_extract(j.value, '$.versionId'), p.organization_id, p.website_id, p.id, 1, p.text, p.normalized_text, p.market, p.language, p.search_mode,
                'Imported', ?, ?, case when p.status = 'active' then ? end, case when p.status = 'active' then ? end, case when p.status = 'active' then ? end, ?, ?
           from json_each(?) j join prompts p on p.id = json_extract(j.value, '$.id') and p.change_id = ?`,
        scope.userId,
        scope.userName,
        now,
        scope.userId,
        scope.userName,
        changeId,
        now,
        json,
        changeId,
      ),
      raw(
        `insert into prompt_tags (prompt_id, organization_id, website_id, tag, created_at)
         select p.id, p.organization_id, p.website_id, t.value, ?
           from json_each(?) j join prompts p on p.id = json_extract(j.value, '$.id') and p.change_id = ?, json_each(j.value, '$.tags') t`,
        now,
        json,
        changeId,
      ),
      activityPerRowStatement(websiteActivity(context, scope, scope.websiteId, "prompt.created", { source: "imported" }, { type: "prompt", id: "" }), imported),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "prompts.imported", { count: items.length, groups: groupRows.length }),
        raw(`exists (${imported.sql})`, ...imported.params),
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "prompts.website_id", "prompts.normalized_text")) {
      throw conflict("import_changed", "Some of these prompts were added meanwhile. Preview the file again.");
    }
    throw error;
  }
  if (changes[1] === 0) throw conflict("import_changed", "The library or its limits changed. Preview the file again.");
  context.commit();
  return { ...plan, saved: true as const, created: changes[1], groupsCreated: changes[0] };
}
