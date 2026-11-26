/** Reads, input rules and conditions shared by the prompt library modules. */
import { z } from "zod";

import { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, NEAR_DUPLICATE_THRESHOLD, mentionsAnyName, normalisePrompt, overlap, wordSet } from "@/lib/prompt-text";

import { MAX_PRODUCTS_PER_PROMPT, MAX_TAGS_PER_PROMPT } from "../../config/limits";
import { isUniqueViolation, prepare, raw, type Statement } from "../../db/atomic";
import type { PromptIntent, PromptScope, PromptSource, PromptStatus, SearchMode } from "../../db/schema";
import { ApiError, conflict, forbidden, invalid, notFound } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import type { WebsiteScope } from "../../tenancy/guard";
import { boundedText, exactText } from "../../validation";
import { websiteActivity } from "../websites/service";

/* ───────── Input ───────── */

export const promptText = exactText("Prompt text", MIN_PROMPT_LENGTH, MAX_PROMPT_LENGTH).refine(
  (value) => normalisePrompt(value) !== "",
  "Prompt text needs words, not only symbols.",
);
export const topic = boundedText("Topic", 1, 60);
export const groupName = boundedText("Group name", 1, 40);
export const changeSummary = boundedText("Change summary", 1, 200);

export const tags = z
  .array(boundedText("Tag", 1, 40).transform((value) => value.toLowerCase()))
  .max(MAX_TAGS_PER_PROMPT, `Use up to ${MAX_TAGS_PER_PROMPT} tags.`)
  .transform((values) => [...new Set(values)]);

export const productIds = z
  .array(z.string().min(1).max(64))
  .max(MAX_PRODUCTS_PER_PROMPT, `Link up to ${MAX_PRODUCTS_PER_PROMPT} products or services.`)
  .transform((values) => [...new Set(values)]);

/* ───────── Errors ───────── */

export const approvalRequired = () => forbidden("approval_required", "A manager, admin or owner must approve this wording first.");

export const duplicatePrompt = (promptId?: string) =>
  new ApiError(409, "duplicate_prompt", "This website already has this prompt for that market and language.", undefined, promptId ? { promptId } : undefined);

export const activeLimitReached = () =>
  conflict("active_prompt_limit_reached", "The active prompt limit of this organization is reached. Pause or archive prompts, or keep this one as a draft.");

export function rethrowDuplicate(error: unknown): never {
  if (isUniqueViolation(error, "prompts.website_id", "prompts.normalized_text")) throw duplicatePrompt();
  throw error;
}

/* ───────── Active prompt limit ───────── */

/**
 * True when `adding` more prompts fit under the organization's active limit. `excluding` leaves out
 * the rows being switched on, so the answer is the same before and after the write changes them.
 * Prompts of removed websites do not count.
 */
export function activePromptRoom(organizationId: string, adding: number, excluding: Statement): Statement {
  return raw(
    `(select count(*) from prompts ap join websites aw on aw.id = ap.website_id
       where ap.organization_id = ? and ap.status = 'active' and aw.status <> 'removed' and ${excluding.sql}) + ?
     <= (select max_active_prompts from organization_entitlements where organization_id = ?)`,
    organizationId,
    ...excluding.params,
    adding,
    organizationId,
  );
}

export async function activePromptUsage(context: ApiContext, organizationId: string) {
  const row = await prepare(
    context.d1,
    raw(
      `select (select count(*) from prompts ap join websites aw on aw.id = ap.website_id
                where ap.organization_id = e.organization_id and ap.status = 'active' and aw.status <> 'removed') as used,
              e.max_active_prompts as "limit"
         from organization_entitlements e where e.organization_id = ?`,
      organizationId,
    ),
  ).first<{ used: number; limit: number }>();
  if (!row) throw notFound();
  return row;
}

/* ───────── Checks ───────── */

export async function findExactWording(context: ApiContext, websiteId: string, market: string, language: string, normalized: string, exceptId = "") {
  return prepare(
    context.d1,
    raw(
      `select id as id, status as status from prompts where website_id = ? and market = ? and language = ? and normalized_text = ? and status <> 'deleted' and id <> ? limit 1`,
      websiteId,
      market,
      language,
      normalized,
      exceptId,
    ),
  ).first<{ id: string; status: PromptStatus }>();
}

/** Similar wording is reported, never blocked: small variants are often on purpose. */
export async function nearDuplicates(context: ApiContext, websiteId: string, market: string, language: string, text: string, exceptId = "") {
  const { results } = await prepare(
    context.d1,
    raw(
      `select id as id, text as text from prompts where website_id = ? and market = ? and language = ? and status <> 'deleted' and id <> ?
        order by updated_at desc limit 1000`,
      websiteId,
      market,
      language,
      exceptId,
    ),
  ).all<{ id: string; text: string }>();
  const words = wordSet(text);
  return results
    .map((row) => ({ id: row.id, text: row.text, similarity: Math.round(overlap(words, wordSet(row.text)) * 100) / 100 }))
    .filter((row) => row.similarity >= NEAR_DUPLICATE_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export const groupExists = (scope: WebsiteScope, groupId: string | null): Statement =>
  raw(`(? is null or exists (select 1 from prompt_groups where id = ? and website_id = ? and removed_at is null))`, groupId, groupId, scope.websiteId);

export async function assertGroup(context: ApiContext, scope: WebsiteScope, groupId: string | null) {
  if (groupId === null) return;
  const check = groupExists(scope, groupId);
  const row = await prepare(context.d1, raw(`select ${check.sql} as found`, ...check.params)).first<{ found: number }>();
  if (!row?.found) throw invalid({ groupId: "That group is not on this website." });
}

export async function assertProducts(context: ApiContext, scope: WebsiteScope, ids: string[]) {
  if (ids.length === 0) return;
  const row = await prepare(
    context.d1,
    raw(
      `select count(*) as found from products_services where website_id = ? and removed_at is null and id in (select value from json_each(?))`,
      scope.websiteId,
      JSON.stringify(ids),
    ),
  ).first<{ found: number }>();
  if (row?.found !== ids.length) throw invalid({ productIds: "Some products or services are not on this website." });
}

/* ───────── Writes shared by create, update and import ───────── */

export function insertTagsStatement(context: ApiContext, scope: WebsiteScope, promptId: string, values: string[], guard: Statement): Statement {
  return raw(
    `insert into prompt_tags (prompt_id, organization_id, website_id, tag, created_at)
     select ?, ?, ?, j.value, ? from json_each(?) j where ${guard.sql}`,
    promptId,
    scope.organizationId,
    scope.websiteId,
    context.now,
    JSON.stringify(values),
    ...guard.params,
  );
}

export function insertProductLinksStatement(context: ApiContext, scope: WebsiteScope, promptId: string, ids: string[], guard: Statement): Statement {
  return raw(
    `insert into prompt_products (prompt_id, product_id, organization_id, website_id, created_at)
     select ?, s.id, ?, ?, ? from products_services s
      where s.website_id = ? and s.removed_at is null and s.id in (select value from json_each(?)) and ${guard.sql}`,
    promptId,
    scope.organizationId,
    scope.websiteId,
    context.now,
    scope.websiteId,
    JSON.stringify(ids),
    ...guard.params,
  );
}

export const promptActivity = (context: ApiContext, scope: WebsiteScope, action: string, promptId: string, metadata?: Record<string, string | number | boolean>) =>
  websiteActivity(context, scope, scope.websiteId, action, metadata, { type: "prompt", id: promptId });

/* ───────── Reads ───────── */

export type PromptRow = {
  id: string;
  websiteId: string;
  groupId: string | null;
  groupName: string | null;
  intent: PromptIntent;
  topic: string | null;
  scope: PromptScope;
  isCore: number;
  source: PromptSource;
  status: PromptStatus;
  currentVersion: number;
  currentVersionId: string;
  currentApprovedAt: number | null;
  approvedVersion: number | null;
  text: string;
  market: string;
  language: string;
  searchMode: SearchMode;
  version: number;
  createdByName: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
};

export const PROMPT_SELECT = `select p.id as id, p.website_id as websiteId, p.group_id as groupId, g.name as groupName, p.intent as intent,
    p.topic as topic, p.scope as scope, p.is_core as isCore, p.source as source, p.status as status, p.current_version as currentVersion,
    cv.id as currentVersionId, cv.approved_at as currentApprovedAt,
    (select max(av.version) from prompt_versions av where av.prompt_id = p.id and av.approved_at is not null) as approvedVersion,
    p.text as text, p.market as market, p.language as language, p.search_mode as searchMode, p.version as version,
    p.created_by_name as createdByName, p.created_at as createdAt, p.updated_at as updatedAt, p.archived_at as archivedAt
  from prompts p
  join prompt_versions cv on cv.prompt_id = p.id and cv.version = p.current_version
  left join prompt_groups g on g.id = p.group_id and g.removed_at is null`;

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

/** Adds tags, linked products and the brand-or-neutral flag. Two queries for any number of prompts. */
export async function decoratePrompts(context: ApiContext, rows: PromptRow[], brand: string[]) {
  const ids = JSON.stringify(rows.map((row) => row.id));
  const [tagRows, productRows] = await context.d1.batch([
    prepare(context.d1, raw(`select prompt_id as promptId, tag as tag from prompt_tags where prompt_id in (select value from json_each(?)) order by tag`, ids)),
    prepare(
      context.d1,
      raw(
        `select pp.prompt_id as promptId, pp.product_id as productId from prompt_products pp
           join products_services s on s.id = pp.product_id and s.removed_at is null
          where pp.prompt_id in (select value from json_each(?)) order by pp.product_id`,
        ids,
      ),
    ),
  ]);
  const tagList = tagRows.results as { promptId: string; tag: string }[];
  const productList = productRows.results as { promptId: string; productId: string }[];
  return rows.map(({ currentApprovedAt, isCore, createdAt, updatedAt, archivedAt, ...row }) => ({
    ...row,
    isCore: isCore === 1,
    currentVersionApproved: currentApprovedAt !== null,
    mentionsBrand: mentionsAnyName(row.text, brand),
    tags: tagList.filter((item) => item.promptId === row.id).map((item) => item.tag),
    productIds: productList.filter((item) => item.promptId === row.id).map((item) => item.productId),
    createdAt: iso(createdAt) as string,
    updatedAt: iso(updatedAt) as string,
    archivedAt: iso(archivedAt),
  }));
}

export type PromptDto = Awaited<ReturnType<typeof decoratePrompts>>[number];

export async function loadPromptRow(context: ApiContext, scope: WebsiteScope, promptId: string): Promise<PromptRow> {
  const row = await prepare(
    context.d1,
    raw(`${PROMPT_SELECT} where p.id = ? and p.website_id = ? and p.organization_id = ? and p.status <> 'deleted'`, promptId, scope.websiteId, scope.organizationId),
  ).first<PromptRow>();
  if (!row) throw notFound();
  return row;
}
