/**
 * Products and services. Optional: a website that sells nothing, or only describes itself, needs none.
 * Verified specifications are brand facts of kind "product". Every change keeps a snapshot.
 */
import { z } from "zod";

import { MAX_PRODUCTS_PER_WEBSITE } from "../../config/limits";
import { appliedClause, atomic, prepare, raw, type Statement } from "../../db/atomic";
import { PRODUCT_AVAILABILITY, PRODUCT_KINDS, PRODUCT_SOURCES, type ProductKind, type ProductStatus } from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, pageUrl, version } from "../../validation";
import { websiteActivity } from "../websites/service";

const CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

const name = boundedText("Name", 2, 120);
const category = boundedText("Category", 1, 80);
const description = boundedText("Description", 1, 2000, "multiple");
const attributes = z.array(z.strictObject({ name: boundedText("Attribute name", 1, 60), value: boundedText("Attribute value", 1, 300) })).max(50);
const urls = z.array(pageUrl).max(10);
const price = z.strictObject({
  amount: z.string({ error: "Price is required." }).regex(/^(0|[1-9]\d{0,9})(\.\d{1,3})?$/, "Enter a price such as 1499 or 14.99."),
  currency: z
    .string({ error: "Currency is required." })
    .transform((code) => code.trim().toUpperCase())
    .pipe(z.string().refine((code) => CURRENCIES.has(code), "Choose a valid currency.")),
});
const availability = z.enum(PRODUCT_AVAILABILITY);
const source = z.enum(PRODUCT_SOURCES);

export const createProductSchema = z.strictObject({
  kind: z.enum(PRODUCT_KINDS, { error: "Choose product, service or other." }),
  name,
  category: category.nullish(),
  description: description.nullish(),
  attributes: attributes.default([]),
  urls: urls.default([]),
  price: price.nullish(),
  availability: availability.nullish(),
  source: source.default("owner"),
  sourceUrl: pageUrl.nullish(),
});

export const updateProductSchema = z
  .strictObject({
    version,
    kind: z.enum(PRODUCT_KINDS).optional(),
    name: name.optional(),
    category: category.nullable().optional(),
    description: description.nullable().optional(),
    attributes: attributes.optional(),
    urls: urls.optional(),
    price: price.nullable().optional(),
    availability: availability.nullable().optional(),
    source: source.optional(),
    sourceUrl: pageUrl.nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 1, { message: "Nothing to change.", path: ["name"] });

export const productStatusSchema = z.strictObject({ version, action: z.enum(["archive", "restore"]) });
export const removeProductSchema = z.strictObject({ version });
export const listProductsSchema = z.object({ status: z.enum(["active", "archived"]).optional() });

type Row = {
  id: string;
  kind: ProductKind;
  name: string;
  category: string | null;
  description: string | null;
  attributes: string;
  urls: string;
  priceAmount: string | null;
  currency: string | null;
  availability: (typeof PRODUCT_AVAILABILITY)[number] | null;
  source: (typeof PRODUCT_SOURCES)[number];
  sourceUrl: string | null;
  status: ProductStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
};

const SELECT = `select id as id, kind as kind, name as name, category as category, description as description, attributes as attributes, urls as urls,
    price_amount as priceAmount, currency as currency, availability as availability, source as source, source_url as sourceUrl,
    status as status, version as version, created_at as createdAt, updated_at as updatedAt
  from products_services`;

const toDto = ({ priceAmount, currency, ...row }: Row) => ({
  ...row,
  attributes: JSON.parse(row.attributes) as { name: string; value: string }[],
  urls: JSON.parse(row.urls) as string[],
  price: priceAmount !== null && currency !== null ? { amount: priceAmount, currency } : null,
  createdAt: new Date(row.createdAt).toISOString(),
  updatedAt: new Date(row.updatedAt).toISOString(),
});

export type ProductDto = ReturnType<typeof toDto>;
type Content = Omit<ProductDto, "id" | "status" | "version" | "createdAt" | "updatedAt">;

const content = (product: Content): Content => ({
  kind: product.kind,
  name: product.name,
  category: product.category,
  description: product.description,
  attributes: product.attributes,
  urls: product.urls,
  price: product.price,
  availability: product.availability,
  source: product.source,
  sourceUrl: product.sourceUrl,
});

/** "From the website" is a claim about evidence, so it needs the page. */
function assertSourced(product: Content) {
  if (product.source === "website" && !product.sourceUrl) throw invalid({ sourceUrl: "Add the page this comes from." });
}

export async function listProducts(context: ApiContext, scope: WebsiteScope, status?: ProductStatus) {
  const { results } = await prepare(
    context.d1,
    raw(
      `${SELECT} where website_id = ? and organization_id = ? and removed_at is null${status ? " and status = ?" : ""} order by name collate nocase, id limit ?`,
      scope.websiteId,
      scope.organizationId,
      ...(status ? [status] : []),
      MAX_PRODUCTS_PER_WEBSITE,
    ),
  ).all<Row>();
  return results.map(toDto);
}

async function findProduct(context: ApiContext, scope: WebsiteScope, productId: string): Promise<ProductDto> {
  const row = await prepare(
    context.d1,
    raw(`${SELECT} where id = ? and website_id = ? and organization_id = ? and removed_at is null`, productId, scope.websiteId, scope.organizationId),
  ).first<Row>();
  if (!row) throw notFound();
  return toDto(row);
}

function snapshotStatement(context: ApiContext, scope: WebsiteScope, productId: string, changeId: string, action: string, snapshot: object): Statement {
  return raw(
    `insert into product_service_versions (id, organization_id, website_id, product_id, version, action, snapshot, changed_by_user_id, changed_by_name, created_at)
     select ?, organization_id, website_id, id, version, ?, ?, ?, ?, ? from products_services where id = ? and change_id = ?`,
    newId("prv"),
    action,
    JSON.stringify(snapshot),
    scope.userId,
    scope.userName,
    context.now,
    productId,
    changeId,
  );
}

const activity = (context: ApiContext, scope: WebsiteScope, action: string, productId: string, productName: string) =>
  websiteActivity(context, scope, scope.websiteId, action, { name: productName }, { type: "product_service", id: productId });

const columnValues = (product: Content) => [
  product.kind,
  product.name,
  product.category,
  product.description,
  JSON.stringify(product.attributes),
  JSON.stringify(product.urls),
  product.price?.amount ?? null,
  product.price?.currency ?? null,
  product.availability,
  product.source,
  product.sourceUrl,
];

export async function createProduct(context: ApiContext, scope: WebsiteScope, input: z.output<typeof createProductSchema>) {
  assertWritableWebsite(scope);
  const record = content({
    ...input,
    category: input.category ?? null,
    description: input.description ?? null,
    price: input.price ?? null,
    availability: input.availability ?? null,
    sourceUrl: input.sourceUrl ?? null,
  });
  assertSourced(record);
  const id = newId("prd");
  const changeId = newChangeId();
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const { now } = context;
  const [inserted] = await atomic(context.d1, [
    raw(
      `insert into products_services (id, organization_id, website_id, kind, name, category, description, attributes, urls, price_amount, currency,
         availability, source, source_url, status, version, created_by_user_id, change_id, created_at, updated_at)
       select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?, ?
        where (select count(*) from products_services where website_id = ? and removed_at is null) < ? and ${writable.sql} and ${actor.sql}`,
      id,
      scope.organizationId,
      scope.websiteId,
      ...columnValues(record),
      scope.userId,
      changeId,
      now,
      now,
      scope.websiteId,
      MAX_PRODUCTS_PER_WEBSITE,
      ...writable.params,
      ...actor.params,
    ),
    snapshotStatement(context, scope, id, changeId, "added", { ...record, status: "active" }),
    activityStatement(activity(context, scope, "product.added", id, record.name), appliedClause({ table: "products_services", id, changeId })),
  ]);
  if (inserted === 0) throw conflict("product_limit_reached", `A website can have up to ${MAX_PRODUCTS_PER_WEBSITE} products and services. Reload and try again.`);
  context.commit();
  return findProduct(context, scope, id);
}

function productGuard(scope: WebsiteScope, productId: string, readVersion: number): Statement {
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  return raw(
    `id = ? and website_id = ? and organization_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
    productId,
    scope.websiteId,
    scope.organizationId,
    readVersion,
    ...writable.params,
    ...actor.params,
  );
}

export async function updateProduct(context: ApiContext, scope: WebsiteScope, productId: string, input: z.output<typeof updateProductSchema>) {
  assertWritableWebsite(scope);
  const current = await findProduct(context, scope, productId);
  const pick = <K extends keyof Content>(key: K): Content[K] => ((input as Partial<Content>)[key] === undefined ? current[key] : (input as Content)[key]);
  const next = content({
    kind: pick("kind"),
    name: pick("name"),
    category: pick("category"),
    description: pick("description"),
    attributes: pick("attributes"),
    urls: pick("urls"),
    price: pick("price"),
    availability: pick("availability"),
    source: pick("source"),
    sourceUrl: pick("sourceUrl"),
  });
  if (JSON.stringify(next) === JSON.stringify(content(current))) throw invalid({ name: "Nothing changed." });
  assertSourced(next);

  const changeId = newChangeId();
  const where = productGuard(scope, productId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(
      `update products_services set kind = ?, name = ?, category = ?, description = ?, attributes = ?, urls = ?, price_amount = ?, currency = ?,
          availability = ?, source = ?, source_url = ?, version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`,
      ...columnValues(next),
      changeId,
      context.now,
      ...where.params,
    ),
    snapshotStatement(context, scope, productId, changeId, "updated", { ...next, status: current.status }),
    activityStatement(activity(context, scope, "product.updated", productId, next.name), appliedClause({ table: "products_services", id: productId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return findProduct(context, scope, productId);
}

export async function changeProductStatus(context: ApiContext, scope: WebsiteScope, productId: string, input: z.output<typeof productStatusSchema>) {
  assertWritableWebsite(scope);
  const current = await findProduct(context, scope, productId);
  const from: ProductStatus = input.action === "archive" ? "active" : "archived";
  const to: ProductStatus = input.action === "archive" ? "archived" : "active";
  if (current.status !== from) throw conflict("invalid_transition", `You cannot ${input.action} an item that is ${current.status}.`);

  const changeId = newChangeId();
  const where = productGuard(scope, productId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(`update products_services set status = ?, version = version + 1, change_id = ?, updated_at = ? where ${where.sql} and status = ?`, to, changeId, context.now, ...where.params, from),
    snapshotStatement(context, scope, productId, changeId, input.action, { ...content(current), status: to }),
    activityStatement(activity(context, scope, `product.${input.action}`, productId, current.name), appliedClause({ table: "products_services", id: productId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return findProduct(context, scope, productId);
}

/** Hides the item. Prompts stop showing it; past results and its history keep it. */
export async function removeProduct(context: ApiContext, scope: WebsiteScope, productId: string, input: z.output<typeof removeProductSchema>) {
  assertWritableWebsite(scope);
  const current = await findProduct(context, scope, productId);
  const changeId = newChangeId();
  const where = productGuard(scope, productId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(`update products_services set removed_at = ?, version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`, context.now, changeId, context.now, ...where.params),
    snapshotStatement(context, scope, productId, changeId, "removed", { ...content(current), status: current.status }),
    activityStatement(activity(context, scope, "product.removed", productId, current.name), appliedClause({ table: "products_services", id: productId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return { id: productId, removed: true as const };
}

export async function productHistory(context: ApiContext, scope: WebsiteScope, productId: string) {
  const { results } = await prepare(
    context.d1,
    raw(
      `select version as version, action as action, snapshot as snapshot, changed_by_name as changedByName, created_at as createdAt
         from product_service_versions where product_id = ? and website_id = ? and organization_id = ? order by version desc limit 200`,
      productId,
      scope.websiteId,
      scope.organizationId,
    ),
  ).all<{ version: number; action: string; snapshot: string; changedByName: string; createdAt: number }>();
  if (results.length === 0) throw notFound();
  return results.map((row) => ({ ...row, snapshot: JSON.parse(row.snapshot) as Record<string, unknown>, createdAt: new Date(row.createdAt).toISOString() }));
}
