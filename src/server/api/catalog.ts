/** Endpoints for competitors and products or services of a website. */
import { apiHandler } from "../http/handler";
import {
  changeCompetitorStatus,
  competitorHistory,
  competitorStatusSchema,
  createCompetitor,
  createCompetitorSchema,
  listCompetitors,
  listCompetitorsSchema,
  removeCompetitor,
  removeCompetitorSchema,
  updateCompetitor,
  updateCompetitorSchema,
} from "../modules/competitors/service";
import {
  changeProductStatus,
  createProduct,
  createProductSchema,
  listProducts,
  listProductsSchema,
  productHistory,
  productStatusSchema,
  removeProduct,
  removeProductSchema,
  updateProduct,
  updateProductSchema,
} from "../modules/products/service";
import { requireWebsite } from "../tenancy/guard";

export const competitorsList = apiHandler({ name: "competitors.list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listCompetitors(context, scope, context.query(listCompetitorsSchema).status) };
});

export const competitorsCreate = apiHandler({ name: "competitors.create", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await createCompetitor(context, scope, context.body(createCompetitorSchema)) };
});

export const competitorUpdate = apiHandler({ name: "competitors.update" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await updateCompetitor(context, scope, context.params.competitorId, context.body(updateCompetitorSchema)) };
});

export const competitorStatus = apiHandler({ name: "competitors.status" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await changeCompetitorStatus(context, scope, context.params.competitorId, context.body(competitorStatusSchema)) };
});

export const competitorRemove = apiHandler({ name: "competitors.remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await removeCompetitor(context, scope, context.params.competitorId, context.body(removeCompetitorSchema)) };
});

export const competitorHistoryList = apiHandler({ name: "competitors.history" }, async (context) => {
  // History names who did what.
  const scope = await requireWebsite(context, context.params.websiteId, "activity.read");
  return { data: await competitorHistory(context, scope, context.params.competitorId) };
});

export const productsList = apiHandler({ name: "products.list" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.read");
  return { data: await listProducts(context, scope, context.query(listProductsSchema).status) };
});

export const productsCreate = apiHandler({ name: "products.create", idempotent: true }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { status: 201, data: await createProduct(context, scope, context.body(createProductSchema)) };
});

export const productUpdate = apiHandler({ name: "products.update" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await updateProduct(context, scope, context.params.productId, context.body(updateProductSchema)) };
});

export const productStatus = apiHandler({ name: "products.status" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await changeProductStatus(context, scope, context.params.productId, context.body(productStatusSchema)) };
});

export const productRemove = apiHandler({ name: "products.remove" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "website.update");
  return { data: await removeProduct(context, scope, context.params.productId, context.body(removeProductSchema)) };
});

export const productHistoryList = apiHandler({ name: "products.history" }, async (context) => {
  const scope = await requireWebsite(context, context.params.websiteId, "activity.read");
  return { data: await productHistory(context, scope, context.params.productId) };
});
