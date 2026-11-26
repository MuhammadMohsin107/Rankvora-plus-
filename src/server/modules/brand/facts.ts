/**
 * Brand facts and FAQs, with their evidence. A fact is verified only with a linked source or an owner
 * or admin vouching for it. Changing what a verified fact says, or removing its last source, sends it
 * back to "needs review". Every change is kept in the fact's history.
 */
import { z } from "zod";

import { MAX_BRAND_FACTS_PER_WEBSITE, MAX_SOURCES_PER_FACT } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw, type Statement } from "../../db/atomic";
import { FACT_KINDS, FACT_STATUSES, VERIFICATION_BASES, type FactKind, type FactOrigin, type FactStatus, type VerificationBasis } from "../../db/schema";
import { conflict, forbidden, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { can } from "../../tenancy/permissions";
import { boundedText, pageUrl, version } from "../../validation";
import { websiteActivity } from "../websites/service";

const label = boundedText("Label", 1, 300);
const value = boundedText("Value", 1, 2000, "multiple");
const note = boundedText("Note", 1, 500, "multiple").nullish();

const sourceFields = { url: pageUrl, title: boundedText("Source title", 1, 200).nullish(), note };

export const createFactSchema = z
  .strictObject({
    kind: z.enum(FACT_KINDS, { error: "Choose business, product or faq." }),
    productId: z.string().max(64).nullish(),
    label,
    value,
    /** "generated" is written only by AI features (Phase 3). */
    origin: z.enum(["owner", "website", "imported"]).default("owner"),
    sources: z.array(z.strictObject(sourceFields)).max(MAX_SOURCES_PER_FACT).default([]),
  })
  .superRefine((input, context) => {
    if (input.kind === "product" && !input.productId) context.addIssue({ code: "custom", path: ["productId"], message: "Choose the product or service." });
    if (input.kind !== "product" && input.productId) context.addIssue({ code: "custom", path: ["productId"], message: "Only product facts name a product." });
  });

export const updateFactSchema = z
  .strictObject({ version, label: label.optional(), value: value.optional(), note })
  .refine((input) => input.label !== undefined || input.value !== undefined, { message: "Nothing to change.", path: ["value"] });

export const factStatusSchema = z
  .strictObject({ version, status: z.enum(FACT_STATUSES), basis: z.enum(VERIFICATION_BASES).optional(), note })
  .superRefine((input, context) => {
    if (input.status === "verified" && !input.basis) context.addIssue({ code: "custom", path: ["basis"], message: "Say what verifies it: source or owner_confirmation." });
    if (input.status !== "verified" && input.basis) context.addIssue({ code: "custom", path: ["basis"], message: "Only a verified fact has a basis." });
  });

export const addSourceSchema = z.strictObject({ version, ...sourceFields });
export const versionOnlySchema = z.strictObject({ version });
export const listFactsSchema = z.object({ kind: z.enum(FACT_KINDS).optional() });

type FactRow = {
  id: string;
  kind: FactKind;
  productId: string | null;
  label: string;
  value: string;
  status: FactStatus;
  origin: FactOrigin;
  verificationBasis: VerificationBasis | null;
  lastVerifiedAt: number | null;
  lastVerifiedByName: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

type SourceRow = { id: string; factId: string; url: string; title: string | null; note: string | null; createdAt: number };

const FACT_SELECT = `select id as id, kind as kind, product_id as productId, label as label, value as value, status as status, origin as origin,
    verification_basis as verificationBasis, last_verified_at as lastVerifiedAt, last_verified_by_name as lastVerifiedByName,
    version as version, created_at as createdAt, updated_at as updatedAt
  from brand_facts`;

const SOURCE_SELECT = `select id as id, fact_id as factId, url as url, title as title, note as note, created_at as createdAt from brand_fact_sources`;

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

const toDto = (row: FactRow, sources: SourceRow[]) => ({
  ...row,
  lastVerifiedAt: iso(row.lastVerifiedAt),
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
  sources: sources.filter((source) => source.factId === row.id).map(({ id, url, title, note: text }) => ({ id, url, title, note: text })),
});

export async function listFacts(context: ApiContext, scope: WebsiteScope, kind?: FactKind) {
  const [facts, sources] = await context.d1.batch([
    prepare(
      context.d1,
      raw(
        `${FACT_SELECT} where website_id = ? and organization_id = ? and removed_at is null${kind ? " and kind = ?" : ""} order by kind, created_at, id limit ?`,
        scope.websiteId,
        scope.organizationId,
        ...(kind ? [kind] : []),
        MAX_BRAND_FACTS_PER_WEBSITE,
      ),
    ),
    prepare(context.d1, raw(`${SOURCE_SELECT} where website_id = ? and organization_id = ? and removed_at is null order by created_at, id`, scope.websiteId, scope.organizationId)),
  ]);
  return (facts.results as FactRow[]).map((row) => toDto(row, sources.results as SourceRow[]));
}

async function findFact(context: ApiContext, scope: WebsiteScope, factId: string): Promise<FactRow> {
  const row = await prepare(
    context.d1,
    raw(`${FACT_SELECT} where id = ? and website_id = ? and organization_id = ? and removed_at is null`, factId, scope.websiteId, scope.organizationId),
  ).first<FactRow>();
  if (!row) throw notFound();
  return row;
}

async function loadFact(context: ApiContext, scope: WebsiteScope, factId: string) {
  const fact = await findFact(context, scope, factId);
  const { results } = await prepare(context.d1, raw(`${SOURCE_SELECT} where fact_id = ? and removed_at is null order by created_at, id`, factId)).all<SourceRow>();
  return toDto(fact, results);
}

/** The history row for the change this batch made, copied from the fact as it now is. */
function historyStatement(context: ApiContext, scope: WebsiteScope, factId: string, changeId: string, text: string | null): Statement {
  return raw(
    `insert into brand_fact_versions (id, organization_id, website_id, fact_id, version, label, value, status, verification_basis, note, changed_by_user_id, changed_by_name, created_at)
     select ?, organization_id, website_id, id, version, label, value, status, verification_basis, ?, ?, ?, ? from brand_facts where id = ? and change_id = ?`,
    newId("bfv"),
    text,
    scope.userId,
    scope.userName,
    context.now,
    factId,
    changeId,
  );
}

const activity = (context: ApiContext, scope: WebsiteScope, action: string, factId: string, metadata?: Record<string, string>) =>
  websiteActivity(context, scope, scope.websiteId, action, metadata, { type: "brand_fact", id: factId });

/** The conditions of every change to one fact: it is the version read, still there, and the actor may still change it. */
function factGuard(scope: WebsiteScope, factId: string, readVersion: number): Statement {
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  return raw(
    `id = ? and website_id = ? and organization_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
    factId,
    scope.websiteId,
    scope.organizationId,
    readVersion,
    ...writable.params,
    ...actor.params,
  );
}

export async function createFact(context: ApiContext, scope: WebsiteScope, input: z.output<typeof createFactSchema>) {
  assertWritableWebsite(scope);
  const productId = input.productId ?? null;
  if (productId) {
    const product = await prepare(
      context.d1,
      raw(`select 1 as found from products_services where id = ? and website_id = ? and removed_at is null`, productId, scope.websiteId),
    ).first();
    if (!product) throw invalid({ productId: "That product or service is not on this website." });
  }
  const sources = [...new Map(input.sources.map((source) => [source.url, source])).values()].map((source) => ({
    id: newId("bfs"),
    url: source.url,
    title: source.title ?? null,
    note: source.note ?? null,
  }));

  const id = newId("bfc");
  const changeId = newChangeId();
  const guard = appliedClause({ table: "brand_facts", id, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const { now } = context;
  const [inserted] = await atomic(context.d1, [
    raw(
      `insert into brand_facts (id, organization_id, website_id, kind, product_id, label, value, status, origin, version, created_by_user_id, change_id, created_at, updated_at)
       select ?, ?, ?, ?, ?, ?, ?, 'unverified', ?, 1, ?, ?, ?, ?
        where (select count(*) from brand_facts where website_id = ? and removed_at is null) < ?
          and (? is null or exists (select 1 from products_services where id = ? and website_id = ? and removed_at is null))
          and ${writable.sql} and ${actor.sql}`,
      id,
      scope.organizationId,
      scope.websiteId,
      input.kind,
      productId,
      input.label,
      input.value,
      input.origin,
      scope.userId,
      changeId,
      now,
      now,
      scope.websiteId,
      MAX_BRAND_FACTS_PER_WEBSITE,
      productId,
      productId,
      scope.websiteId,
      ...writable.params,
      ...actor.params,
    ),
    historyStatement(context, scope, id, changeId, "Added"),
    raw(
      `insert into brand_fact_sources (id, organization_id, website_id, fact_id, url, title, note, added_by_user_id, created_at)
       select json_extract(j.value, '$.id'), ?, ?, ?, json_extract(j.value, '$.url'), json_extract(j.value, '$.title'), json_extract(j.value, '$.note'), ?, ?
         from json_each(?) j where ${guard.sql}`,
      scope.organizationId,
      scope.websiteId,
      id,
      scope.userId,
      now,
      JSON.stringify(sources),
      ...guard.params,
    ),
    activityStatement(activity(context, scope, "brand.fact_added", id, { kind: input.kind }), guard),
  ]);
  if (inserted === 0) throw conflict("fact_limit_reached", `A website can have up to ${MAX_BRAND_FACTS_PER_WEBSITE} facts. Reload and try again.`);
  context.commit();
  return loadFact(context, scope, id);
}

/** Editing what a fact says. A verified fact loses its verification: it was about the old wording. */
export async function updateFact(context: ApiContext, scope: WebsiteScope, factId: string, input: z.output<typeof updateFactSchema>) {
  assertWritableWebsite(scope);
  const fact = await findFact(context, scope, factId);
  const nextLabel = input.label ?? fact.label;
  const nextValue = input.value ?? fact.value;
  if (nextLabel === fact.label && nextValue === fact.value) throw invalid({ value: "Nothing changed." });

  const changeId = newChangeId();
  const where = factGuard(scope, factId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(
      `update brand_facts set label = ?, value = ?, status = case when status = 'verified' then 'needs_review' else status end,
          verification_basis = null, version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`,
      nextLabel,
      nextValue,
      changeId,
      context.now,
      ...where.params,
    ),
    historyStatement(context, scope, factId, changeId, input.note ?? "Edited"),
    activityStatement(activity(context, scope, "brand.fact_updated", factId), appliedClause({ table: "brand_facts", id: factId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return loadFact(context, scope, factId);
}

export async function setFactStatus(context: ApiContext, scope: WebsiteScope, factId: string, input: z.output<typeof factStatusSchema>) {
  assertWritableWebsite(scope);
  const fact = await findFact(context, scope, factId);
  if (input.basis === "owner_confirmation" && !can(scope.role, "brand.confirm")) {
    throw forbidden("owner_confirmation_required", "Only an owner or admin can confirm a fact without a source.");
  }
  // Verifying again is allowed: it records that someone checked it again.
  if (fact.status === input.status && input.status !== "verified") throw invalid({ status: "The fact already has this status." });

  const basis = input.basis ?? null;
  const changeId = newChangeId();
  const where = factGuard(scope, factId, input.version);
  const needsSource = basis === "source";
  const [updated] = await atomic(context.d1, [
    raw(
      `update brand_facts set status = ?, verification_basis = ?,
          last_verified_at = case when ? = 'verified' then ? else last_verified_at end,
          last_verified_by_name = case when ? = 'verified' then ? else last_verified_by_name end,
          version = version + 1, change_id = ?, updated_at = ?
        where ${where.sql}${needsSource ? " and exists (select 1 from brand_fact_sources s where s.fact_id = brand_facts.id and s.removed_at is null)" : ""}`,
      input.status,
      basis,
      input.status,
      context.now,
      input.status,
      scope.userName,
      changeId,
      context.now,
      ...where.params,
    ),
    historyStatement(context, scope, factId, changeId, input.note ?? null),
    activityStatement(
      activity(context, scope, "brand.fact_status", factId, { status: input.status, ...(basis ? { basis } : {}) }),
      appliedClause({ table: "brand_facts", id: factId, changeId }),
    ),
  ]);
  if (updated === 0) {
    const latest = await findFact(context, scope, factId);
    if (needsSource && latest.version === input.version) throw conflict("source_required", "Add a source before marking this fact verified from sources.");
    throw versionConflict();
  }
  return loadFact(context, scope, factId);
}

export async function addFactSource(context: ApiContext, scope: WebsiteScope, factId: string, input: z.output<typeof addSourceSchema>) {
  assertWritableWebsite(scope);
  await findFact(context, scope, factId);
  const changeId = newChangeId();
  const guard = appliedClause({ table: "brand_facts", id: factId, changeId });
  const where = factGuard(scope, factId, input.version);
  let updated: number;
  try {
    [updated] = await atomic(context.d1, [
      raw(
        `update brand_facts set version = version + 1, change_id = ?, updated_at = ?
          where ${where.sql} and (select count(*) from brand_fact_sources s where s.fact_id = brand_facts.id and s.removed_at is null) < ?`,
        changeId,
        context.now,
        ...where.params,
        MAX_SOURCES_PER_FACT,
      ),
      raw(
        `insert into brand_fact_sources (id, organization_id, website_id, fact_id, url, title, note, added_by_user_id, created_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ? where ${guard.sql}`,
        newId("bfs"),
        scope.organizationId,
        scope.websiteId,
        factId,
        input.url,
        input.title ?? null,
        input.note ?? null,
        scope.userId,
        context.now,
        ...guard.params,
      ),
      historyStatement(context, scope, factId, changeId, `Source added: ${input.url}`),
      activityStatement(activity(context, scope, "brand.fact_source_added", factId), guard),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "brand_fact_sources.fact_id", "brand_fact_sources.url")) throw conflict("source_exists", "This fact already has that source.");
    throw error;
  }
  if (updated === 0) throw conflict("source_not_added", `The source was not added. A fact can have up to ${MAX_SOURCES_PER_FACT} sources; reload and try again.`);
  return loadFact(context, scope, factId);
}

export async function removeFactSource(context: ApiContext, scope: WebsiteScope, factId: string, sourceId: string, input: z.output<typeof versionOnlySchema>) {
  assertWritableWebsite(scope);
  await findFact(context, scope, factId);
  const source = await prepare(
    context.d1,
    raw(`select url as url from brand_fact_sources where id = ? and fact_id = ? and removed_at is null`, sourceId, factId),
  ).first<{ url: string }>();
  if (!source) throw notFound();

  const changeId = newChangeId();
  const guard = appliedClause({ table: "brand_facts", id: factId, changeId });
  const where = factGuard(scope, factId, input.version);
  const lastSource = `not exists (select 1 from brand_fact_sources s where s.fact_id = brand_facts.id and s.removed_at is null and s.id <> ?)`;
  const [updated] = await atomic(context.d1, [
    // Both CASEs read the row as it was, so status and basis stay consistent.
    raw(
      `update brand_facts set
          status = case when verification_basis = 'source' and ${lastSource} then 'needs_review' else status end,
          verification_basis = case when verification_basis = 'source' and ${lastSource} then null else verification_basis end,
          version = version + 1, change_id = ?, updated_at = ?
        where ${where.sql}`,
      sourceId,
      sourceId,
      changeId,
      context.now,
      ...where.params,
    ),
    raw(`update brand_fact_sources set removed_at = ?, change_id = ? where id = ? and removed_at is null and ${guard.sql}`, context.now, changeId, sourceId, ...guard.params),
    historyStatement(context, scope, factId, changeId, `Source removed: ${source.url}`),
    activityStatement(activity(context, scope, "brand.fact_source_removed", factId), guard),
  ]);
  if (updated === 0) throw versionConflict();
  return loadFact(context, scope, factId);
}

export async function removeFact(context: ApiContext, scope: WebsiteScope, factId: string, input: z.output<typeof versionOnlySchema>) {
  assertWritableWebsite(scope);
  await findFact(context, scope, factId);
  const changeId = newChangeId();
  const where = factGuard(scope, factId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(`update brand_facts set removed_at = ?, version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`, context.now, changeId, context.now, ...where.params),
    historyStatement(context, scope, factId, changeId, "Removed"),
    activityStatement(activity(context, scope, "brand.fact_removed", factId), appliedClause({ table: "brand_facts", id: factId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return { id: factId, removed: true as const };
}

/** Every version of a fact, newest first, including a removed one. */
export async function factHistory(context: ApiContext, scope: WebsiteScope, factId: string) {
  const { results } = await prepare(
    context.d1,
    raw(
      `select version as version, label as label, value as value, status as status, verification_basis as verificationBasis, note as note,
              changed_by_name as changedByName, created_at as createdAt
         from brand_fact_versions where fact_id = ? and website_id = ? and organization_id = ? order by version desc limit 200`,
      factId,
      scope.websiteId,
      scope.organizationId,
    ),
  ).all<{ createdAt: number }>();
  if (results.length === 0) throw notFound();
  return results.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }));
}
