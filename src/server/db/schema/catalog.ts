/**
 * Competitors and the optional products or services of a website. Every change also writes an
 * append-only revision (a full snapshot), so past results can show what was true then. Removal is a
 * soft delete.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { createdAt, instant, oneOf, updatedAt } from "./columns";
import { websites } from "./websites";

/** A suggestion stays a suggestion until a person confirms it. */
export const COMPETITOR_STATUSES = ["suggested", "confirmed", "archived"] as const;
export type CompetitorStatus = (typeof COMPETITOR_STATUSES)[number];

export const COMPETITOR_SOURCES = ["owner", "suggestion", "imported"] as const;
export type CompetitorSource = (typeof COMPETITOR_SOURCES)[number];

export const PRODUCT_KINDS = ["product", "service", "other"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_STATUSES = ["active", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_AVAILABILITY = ["available", "unavailable", "in_stock", "out_of_stock", "preorder"] as const;
export const PRODUCT_SOURCES = ["owner", "website", "imported"] as const;

export const competitors = sqliteTable(
  "competitors",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    name: text("name").notNull(),
    /** Lowercased name, for the one-name-per-website rule. */
    nameKey: text("name_key").notNull(),
    /** JSON array of strings. */
    aliases: text("aliases").notNull(),
    /** ISO 3166-1 alpha-2. Null means every market. */
    market: text("market"),
    businessCategory: text("business_category"),
    status: text("status", { enum: COMPETITOR_STATUSES }).notNull(),
    source: text("source", { enum: COMPETITOR_SOURCES }).notNull(),
    /** Why this is a competitor, and a page that shows it. */
    evidence: text("evidence"),
    evidenceUrl: text("evidence_url"),
    confirmedAt: instant("confirmed_at"),
    confirmedByName: text("confirmed_by_name"),
    removedAt: instant("removed_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "competitors_website_fk" }),
    uniqueIndex("competitors_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    uniqueIndex("competitors_name_uq").on(t.websiteId, t.nameKey).where(sql`removed_at is null`),
    index("competitors_website_idx").on(t.websiteId, t.removedAt, t.status),
    check("competitors_status_check", oneOf("status", COMPETITOR_STATUSES)),
    check("competitors_source_check", oneOf("source", COMPETITOR_SOURCES)),
  ],
);

export const competitorDomains = sqliteTable(
  "competitor_domains",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    competitorId: text("competitor_id").notNull(),
    host: text("host").notNull(),
    removedAt: instant("removed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.competitorId, t.websiteId, t.organizationId], foreignColumns: [competitors.id, competitors.websiteId, competitors.organizationId], name: "competitor_domains_competitor_fk" }),
    // One domain belongs to one competitor of a website, so a citation is never counted twice.
    uniqueIndex("competitor_domains_host_uq").on(t.websiteId, t.host).where(sql`removed_at is null`),
    index("competitor_domains_competitor_idx").on(t.competitorId, t.removedAt),
  ],
);

export const competitorRevisions = sqliteTable(
  "competitor_revisions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    competitorId: text("competitor_id").notNull(),
    version: integer("version").notNull(),
    action: text("action").notNull(),
    /** JSON of the competitor after the change, including its domains. */
    snapshot: text("snapshot").notNull(),
    changedByUserId: text("changed_by_user_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.competitorId, t.websiteId, t.organizationId], foreignColumns: [competitors.id, competitors.websiteId, competitors.organizationId], name: "competitor_revisions_competitor_fk" }),
    uniqueIndex("competitor_revisions_number_uq").on(t.competitorId, t.version),
  ],
);

export const productsServices = sqliteTable(
  "products_services",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    kind: text("kind", { enum: PRODUCT_KINDS }).notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    /** JSON array of {name, value}. Verified specifications are brand facts of kind "product". */
    attributes: text("attributes").notNull(),
    /** JSON array of public page addresses. */
    urls: text("urls").notNull(),
    /** A decimal string ("1499.00"), so no rounding happens. Always with a currency. */
    priceAmount: text("price_amount"),
    currency: text("currency"),
    availability: text("availability", { enum: PRODUCT_AVAILABILITY }),
    source: text("source", { enum: PRODUCT_SOURCES }).notNull(),
    sourceUrl: text("source_url"),
    status: text("status", { enum: PRODUCT_STATUSES }).notNull().default("active"),
    removedAt: instant("removed_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "products_services_website_fk" }),
    uniqueIndex("products_services_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    index("products_services_website_idx").on(t.websiteId, t.removedAt, t.status),
    check("products_services_kind_check", oneOf("kind", PRODUCT_KINDS)),
    check("products_services_status_check", oneOf("status", PRODUCT_STATUSES)),
    check("products_services_source_check", oneOf("source", PRODUCT_SOURCES)),
    check("products_services_price_check", sql`(price_amount is null) = (currency is null)`),
  ],
);

export const productServiceVersions = sqliteTable(
  "product_service_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    productId: text("product_id").notNull(),
    version: integer("version").notNull(),
    action: text("action").notNull(),
    snapshot: text("snapshot").notNull(),
    changedByUserId: text("changed_by_user_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.productId, t.websiteId, t.organizationId], foreignColumns: [productsServices.id, productsServices.websiteId, productsServices.organizationId], name: "product_service_versions_product_fk" }),
    uniqueIndex("product_service_versions_number_uq").on(t.productId, t.version),
  ],
);
