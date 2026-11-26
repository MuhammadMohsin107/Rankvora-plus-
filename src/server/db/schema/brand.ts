/**
 * Brand knowledge of a website: the profile, facts with their evidence, and the website's own source
 * pages. Profile versions and fact history are append-only (triggers), so a later run can point at the
 * exact wording it used.
 *
 * Aliases, display names and abbreviations are JSON lists inside the immutable profile version: they
 * are always read together with it.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { productsServices } from "./catalog";
import { createdAt, instant, oneOf, updatedAt } from "./columns";
import { websites } from "./websites";

export const FACT_KINDS = ["business", "product", "faq"] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_STATUSES = ["unverified", "verified", "contradicted", "outdated", "needs_review"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

/** Where a fact came from. "generated" is reserved for AI output (Phase 3) and is never verified by itself. */
export const FACT_ORIGINS = ["owner", "website", "imported", "generated"] as const;
export type FactOrigin = (typeof FACT_ORIGINS)[number];

/** Why a fact counts as verified: linked evidence, or an owner or admin vouching for it. */
export const VERIFICATION_BASES = ["source", "owner_confirmation"] as const;
export type VerificationBasis = (typeof VERIFICATION_BASES)[number];

export const brandProfileVersions = sqliteTable(
  "brand_profile_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    version: integer("version").notNull(),
    officialName: text("official_name").notNull(),
    /** JSON arrays of strings. */
    displayNames: text("display_names").notNull(),
    aliases: text("aliases").notNull(),
    abbreviations: text("abbreviations").notNull(),
    description: text("description"),
    targetAudience: text("target_audience"),
    differentiators: text("differentiators").notNull(),
    voice: text("voice"),
    /** A short summary of what the website covers. */
    contentSummary: text("content_summary"),
    changeNote: text("change_note"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "brand_profile_versions_website_fk" }),
    // Two people saving from the same version: only one gets the next number.
    uniqueIndex("brand_profile_versions_number_uq").on(t.websiteId, t.version),
  ],
);

export const brandFacts = sqliteTable(
  "brand_facts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    kind: text("kind", { enum: FACT_KINDS }).notNull(),
    /** For kind "product": the product the fact is about (verified specifications). */
    productId: text("product_id"),
    /** The question, for kind "faq". */
    label: text("label").notNull(),
    value: text("value").notNull(),
    status: text("status", { enum: FACT_STATUSES }).notNull().default("unverified"),
    origin: text("origin", { enum: FACT_ORIGINS }).notNull(),
    verificationBasis: text("verification_basis", { enum: VERIFICATION_BASES }),
    /** Kept after the status changes: when it was last known to be true. */
    lastVerifiedAt: instant("last_verified_at"),
    lastVerifiedByName: text("last_verified_by_name"),
    removedAt: instant("removed_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "brand_facts_website_fk" }),
    foreignKey({ columns: [t.productId, t.websiteId, t.organizationId], foreignColumns: [productsServices.id, productsServices.websiteId, productsServices.organizationId], name: "brand_facts_product_fk" }),
    uniqueIndex("brand_facts_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    index("brand_facts_website_idx").on(t.websiteId, t.removedAt, t.kind),
    check("brand_facts_kind_check", oneOf("kind", FACT_KINDS)),
    check("brand_facts_status_check", oneOf("status", FACT_STATUSES)),
    check("brand_facts_origin_check", oneOf("origin", FACT_ORIGINS)),
    check("brand_facts_basis_check", sql`(status = 'verified') = (verification_basis is not null)`),
  ],
);

/** One row per change of a fact: what it said and how trusted it was. */
export const brandFactVersions = sqliteTable(
  "brand_fact_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    factId: text("fact_id").notNull(),
    version: integer("version").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    status: text("status", { enum: FACT_STATUSES }).notNull(),
    verificationBasis: text("verification_basis", { enum: VERIFICATION_BASES }),
    note: text("note"),
    changedByUserId: text("changed_by_user_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.factId, t.websiteId, t.organizationId], foreignColumns: [brandFacts.id, brandFacts.websiteId, brandFacts.organizationId], name: "brand_fact_versions_fact_fk" }),
    uniqueIndex("brand_fact_versions_number_uq").on(t.factId, t.version),
  ],
);

export const brandFactSources = sqliteTable(
  "brand_fact_sources",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    factId: text("fact_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    note: text("note"),
    addedByUserId: text("added_by_user_id").notNull(),
    removedAt: instant("removed_at"),
    changeId: text("change_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.factId, t.websiteId, t.organizationId], foreignColumns: [brandFacts.id, brandFacts.websiteId, brandFacts.organizationId], name: "brand_fact_sources_fact_fk" }),
    uniqueIndex("brand_fact_sources_url_uq").on(t.factId, t.url).where(sql`removed_at is null`),
  ],
);

/** Pages of the website itself that describe it. */
export const websiteSourcePages = sqliteTable(
  "website_source_pages",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    /** Free label such as "about", "pricing" or "service". */
    pageType: text("page_type").notNull(),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    addedByUserId: text("added_by_user_id").notNull(),
    removedAt: instant("removed_at"),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "website_source_pages_website_fk" }),
    uniqueIndex("website_source_pages_url_uq").on(t.websiteId, t.url).where(sql`removed_at is null`),
  ],
);
