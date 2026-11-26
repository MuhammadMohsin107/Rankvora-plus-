/** Pages on the website's own domains that describe the business. */
import { z } from "zod";

import { MAX_SOURCE_PAGES_PER_WEBSITE } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import { conflict, invalid, notFound } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, pageUrl, publicPageUrl } from "../../validation";
import { websiteActivity } from "../websites/service";

const title = boundedText("Page title", 1, 200);
const pageType = boundedText("Page type", 1, 40);

export const addSourcePageSchema = z.strictObject({ url: pageUrl, title, pageType: pageType.default("page"), confirmed: z.boolean().default(false) });
export const updateSourcePageSchema = z
  .strictObject({ title: title.optional(), pageType: pageType.optional(), confirmed: z.boolean().optional() })
  .refine((input) => input.title !== undefined || input.pageType !== undefined || input.confirmed !== undefined, { message: "Nothing to change.", path: ["title"] });

type Row = { id: string; url: string; title: string; pageType: string; confirmed: number; createdAt: number; updatedAt: number };

const SELECT = `select id as id, url as url, title as title, page_type as pageType, confirmed as confirmed, created_at as createdAt, updated_at as updatedAt
  from website_source_pages`;

const toDto = (row: Row) => ({ ...row, confirmed: row.confirmed === 1, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString() });

export async function listSourcePages(context: ApiContext, scope: WebsiteScope) {
  const { results } = await prepare(
    context.d1,
    raw(`${SELECT} where website_id = ? and organization_id = ? and removed_at is null order by created_at, id limit ?`, scope.websiteId, scope.organizationId, MAX_SOURCE_PAGES_PER_WEBSITE),
  ).all<Row>();
  return results.map(toDto);
}

const activity = (context: ApiContext, scope: WebsiteScope, action: string, pageId: string, url: string) =>
  websiteActivity(context, scope, scope.websiteId, action, { url }, { type: "source_page", id: pageId });

export async function addSourcePage(context: ApiContext, scope: WebsiteScope, input: z.output<typeof addSourcePageSchema>) {
  assertWritableWebsite(scope);
  const parsed = publicPageUrl(input.url);
  if ("error" in parsed) throw invalid({ url: parsed.error });
  const ownDomain = `exists (select 1 from website_domains where website_id = ? and organization_id = ? and host = ? and status = 'active')`;
  const own = await prepare(context.d1, raw(`select ${ownDomain} as found`, scope.websiteId, scope.organizationId, parsed.host)).first<{ found: number }>();
  if (!own?.found) throw invalid({ url: "The page must be on one of this website's domains. Add the domain first." });

  const id = newId("wsp");
  const changeId = newChangeId();
  const guard = appliedClause({ table: "website_source_pages", id, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into website_source_pages (id, organization_id, website_id, url, title, page_type, confirmed, added_by_user_id, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          where (select count(*) from website_source_pages where website_id = ? and removed_at is null) < ?
            and ${ownDomain} and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        input.url,
        input.title,
        input.pageType,
        input.confirmed,
        scope.userId,
        changeId,
        context.now,
        context.now,
        scope.websiteId,
        MAX_SOURCE_PAGES_PER_WEBSITE,
        scope.websiteId,
        scope.organizationId,
        parsed.host,
        ...writable.params,
        ...actor.params,
      ),
      activityStatement(activity(context, scope, "brand.source_page_added", id, input.url), guard),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "website_source_pages.website_id", "website_source_pages.url")) throw conflict("source_page_exists", "This page is already listed.");
    throw error;
  }
  if (inserted === 0) throw conflict("source_page_not_added", `The page was not added. A website can list up to ${MAX_SOURCE_PAGES_PER_WEBSITE} pages; reload and try again.`);
  context.commit();
  return listSourcePages(context, scope);
}

async function findPage(context: ApiContext, scope: WebsiteScope, pageId: string) {
  const row = await prepare(
    context.d1,
    raw(`${SELECT} where id = ? and website_id = ? and organization_id = ? and removed_at is null`, pageId, scope.websiteId, scope.organizationId),
  ).first<Row>();
  if (!row) throw notFound();
  return row;
}

export async function updateSourcePage(context: ApiContext, scope: WebsiteScope, pageId: string, input: z.output<typeof updateSourcePageSchema>) {
  assertWritableWebsite(scope);
  const page = await findPage(context, scope, pageId);
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update website_source_pages set title = coalesce(?, title), page_type = coalesce(?, page_type), confirmed = coalesce(?, confirmed), change_id = ?, updated_at = ?
        where id = ? and website_id = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
      input.title ?? null,
      input.pageType ?? null,
      input.confirmed ?? null,
      changeId,
      context.now,
      pageId,
      scope.websiteId,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(activity(context, scope, "brand.source_page_updated", pageId, page.url), appliedClause({ table: "website_source_pages", id: pageId, changeId })),
  ]);
  if (updated === 0) throw notFound();
  return toDto(await findPage(context, scope, pageId));
}

export async function removeSourcePage(context: ApiContext, scope: WebsiteScope, pageId: string) {
  assertWritableWebsite(scope);
  const page = await findPage(context, scope, pageId);
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update website_source_pages set removed_at = ?, change_id = ?, updated_at = ?
        where id = ? and website_id = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
      context.now,
      changeId,
      context.now,
      pageId,
      scope.websiteId,
      ...writable.params,
      ...actor.params,
    ),
    activityStatement(activity(context, scope, "brand.source_page_removed", pageId, page.url), appliedClause({ table: "website_source_pages", id: pageId, changeId })),
  ]);
  if (updated === 0) throw notFound();
  return { id: pageId, removed: true as const };
}
