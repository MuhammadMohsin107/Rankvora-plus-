/** Endpoints under /api/v1/websites/:websiteId/brand. */
import { apiHandler } from "../http/handler";
import {
  addFactSource,
  addSourceSchema,
  createFact,
  createFactSchema,
  factHistory,
  factStatusSchema,
  listFacts,
  listFactsSchema,
  removeFact,
  removeFactSource,
  setFactStatus,
  updateFact,
  updateFactSchema,
  versionOnlySchema,
} from "../modules/brand/facts";
import { getBrandProfile, saveBrandProfile, saveBrandProfileSchema } from "../modules/brand/profile";
import { addSourcePage, addSourcePageSchema, listSourcePages, removeSourcePage, updateSourcePage, updateSourcePageSchema } from "../modules/brand/source-pages";
import { requireWebsite } from "../tenancy/guard";

export const brandGet = apiHandler({ name: "brand.get" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await getBrandProfile(context, scope) };
});

export const brandSave = apiHandler({ name: "brand.save", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await saveBrandProfile(context, scope, context.body(saveBrandProfileSchema)) };
});

export const factsList = apiHandler({ name: "brand.facts_list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listFacts(context, scope, context.query(listFactsSchema).kind) };
});

export const factsCreate = apiHandler({ name: "brand.fact_create", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await createFact(context, scope, context.body(createFactSchema)) };
});

export const factUpdate = apiHandler({ name: "brand.fact_update" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await updateFact(context, scope, context.params.factId, context.body(updateFactSchema)) };
});

export const factRemove = apiHandler({ name: "brand.fact_remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await removeFact(context, scope, context.params.factId, context.body(versionOnlySchema)) };
});

export const factStatus = apiHandler({ name: "brand.fact_status" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await setFactStatus(context, scope, context.params.factId, context.body(factStatusSchema)) };
});

export const factSourceAdd = apiHandler({ name: "brand.fact_source_add" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await addFactSource(context, scope, context.params.factId, context.body(addSourceSchema)) };
});

export const factSourceRemove = apiHandler({ name: "brand.fact_source_remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await removeFactSource(context, scope, context.params.factId, context.params.sourceId, context.body(versionOnlySchema)) };
});

export const factHistoryList = apiHandler({ name: "brand.fact_history" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await factHistory(context, scope, context.params.factId) };
});

export const sourcePagesList = apiHandler({ name: "brand.source_pages_list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listSourcePages(context, scope) };
});

export const sourcePagesAdd = apiHandler({ name: "brand.source_page_add", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await addSourcePage(context, scope, context.body(addSourcePageSchema)) };
});

export const sourcePageUpdate = apiHandler({ name: "brand.source_page_update" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await updateSourcePage(context, scope, context.params.pageId, context.body(updateSourcePageSchema)) };
});

export const sourcePageRemove = apiHandler({ name: "brand.source_page_remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await removeSourcePage(context, scope, context.params.pageId) };
});
