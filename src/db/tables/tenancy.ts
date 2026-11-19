import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, textArray, updatedAt } from "./_columns";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const organizationStatus = pgEnum("organization_status", [
  "active",
  "suspended",
  "archived",
]);

export const membershipRole = pgEnum("membership_role", [
  "owner",
  "admin",
  "editor",
  "auditor",
  "viewer",
]);

export const storeStatus = pgEnum("store_status", [
  "draft",
  "needs_review",
  "ready",
  "active",
  "paused",
  "disconnected",
  "archived",
]);

export const storePlatform = pgEnum("store_platform", [
  "shopify",
  "woocommerce",
  "wordpress",
  "webflow",
  "custom",
  "manual",
]);

export const storeDomainKind = pgEnum("store_domain_kind", [
  "alias",
  "redirect",
  "previous_canonical",
]);

export const competitorStatus = pgEnum("competitor_status", [
  "suggested",
  "confirmed",
  "archived",
]);

export const recordSource = pgEnum("record_source", [
  "manual",
  "ai_suggested",
  "imported",
  "connector",
]);

// ---------------------------------------------------------------------------
// Organizations and memberships
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  timezoneDefault: text("timezone_default").notNull().default("UTC"),
  status: organizationStatus("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: membershipRole("role").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("organization_memberships_org_user_unique").on(
      t.organizationId,
      t.userId,
    ),
    index("organization_memberships_user_id_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Optional link between regional storefronts of the same brand.
    brandGroupId: uuid("brand_group_id"),
    name: text("name").notNull(),
    platformType: storePlatform("platform_type").notNull(),
    canonicalDomain: text("canonical_domain").notNull(),
    market: char("market", { length: 2 }).notNull(),
    language: text("language").notNull(),
    timezone: text("timezone").notNull(),
    industry: text("industry"),
    description: text("description"),
    status: storeStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Lets child tables reference (store_id, organization_id) so the database
    // itself rejects a row whose store and organization do not match.
    unique("stores_id_organization_id_unique").on(t.id, t.organizationId),
    uniqueIndex("stores_org_domain_unique")
      .on(t.organizationId, t.canonicalDomain)
      .where(sql`${t.status} <> 'archived'`),
    index("stores_organization_id_idx").on(t.organizationId),
    index("stores_brand_group_id_idx").on(t.brandGroupId),
    check("stores_market_format", sql`${t.market} ~ '^[A-Z]{2}$'`),
    check(
      "stores_domain_lowercase",
      sql`${t.canonicalDomain} = lower(${t.canonicalDomain})`,
    ),
  ],
);

// Aliases, redirect hosts and the history of former canonical domains.
export const storeDomains = pgTable(
  "store_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    host: text("host").notNull(),
    kind: storeDomainKind("kind").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "store_domains_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    unique("store_domains_store_host_unique").on(t.storeId, t.host),
    index("store_domains_organization_id_idx").on(t.organizationId),
    check("store_domains_host_lowercase", sql`${t.host} = lower(${t.host})`),
  ],
);

// ---------------------------------------------------------------------------
// Brand profile (append-only versions) and competitors
// ---------------------------------------------------------------------------

// A brand rename or alias change creates a new version; old versions are never
// edited, so earlier analysis can still be traced to the profile it used.
export const brandProfiles = pgTable(
  "brand_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    version: integer("version").notNull(),
    brandName: text("brand_name").notNull(),
    legalName: text("legal_name"),
    aliases: textArray("aliases"),
    description: text("description"),
    differentiators: text("differentiators"),
    targetAudience: text("target_audience"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "brand_profiles_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    unique("brand_profiles_store_version_unique").on(t.storeId, t.version),
    index("brand_profiles_organization_id_idx").on(t.organizationId),
    check("brand_profiles_version_positive", sql`${t.version} >= 1`),
  ],
);

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    name: text("name").notNull(),
    aliases: textArray("aliases"),
    domains: textArray("domains"),
    // Competitors are configured per store and market.
    market: char("market", { length: 2 }),
    competitorType: text("competitor_type"),
    status: competitorStatus("status").notNull().default("suggested"),
    source: recordSource("source").notNull().default("manual"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "competitors_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    uniqueIndex("competitors_store_name_unique")
      .on(t.storeId, sql`lower(${t.name})`)
      .where(sql`${t.status} <> 'archived'`),
    index("competitors_organization_id_idx").on(t.organizationId),
    check(
      "competitors_market_format",
      sql`${t.market} is null or ${t.market} ~ '^[A-Z]{2}$'`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Products and services (catalogue context)
// ---------------------------------------------------------------------------

export const productsServices = pgTable(
  "products_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    url: text("url"),
    category: text("category"),
    facts: jsonb("facts")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    source: recordSource("source").notNull().default("manual"),
    // When the source system last changed this record, if it told us.
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "products_services_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    // Lets join tables reference (product_service_id, store_id) so a link can
    // only ever connect records that belong to the same store.
    unique("products_services_id_store_id_unique").on(t.id, t.storeId),
    uniqueIndex("products_services_store_external_unique")
      .on(t.storeId, t.externalId)
      .where(sql`${t.externalId} is not null`),
    index("products_services_store_id_idx").on(t.storeId),
    index("products_services_organization_id_idx").on(t.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// Activity log (who changed what)
// ---------------------------------------------------------------------------

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    storeId: uuid("store_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    // storeId may be null (organization-level event); the composite key is
    // only enforced when it is set.
    foreignKey({
      name: "activity_logs_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    index("activity_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("activity_logs_store_created_idx").on(t.storeId, t.createdAt),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof organizationMemberships.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type StoreDomain = typeof storeDomains.$inferSelect;
export type BrandProfile = typeof brandProfiles.$inferSelect;
export type Competitor = typeof competitors.$inferSelect;
export type ProductService = typeof productsServices.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type MembershipRole = (typeof membershipRole.enumValues)[number];
export type StoreStatus = (typeof storeStatus.enumValues)[number];
export type StorePlatform = (typeof storePlatform.enumValues)[number];
export type CompetitorStatus = (typeof competitorStatus.enumValues)[number];
export type RecordSource = (typeof recordSource.enumValues)[number];
