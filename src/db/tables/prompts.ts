import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { createdAt, updatedAt } from "./_columns";
import { organizations, productsServices, stores } from "./tenancy";
import { users } from "./users";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const promptIntent = pgEnum("prompt_intent", [
  "discovery",
  "recommendation",
  "comparison",
  "alternative",
  "product_service",
  "local_market",
  "informational",
]);

export const promptStatus = pgEnum("prompt_status", [
  "draft",
  "active",
  "paused",
  "archived",
]);

export const promptTrackingScope = pgEnum("prompt_tracking_scope", [
  "audit",
  "monitoring",
  "both",
]);

export const promptSource = pgEnum("prompt_source", [
  "manual",
  "ai_generated",
  "imported",
  "research_derived",
  "template",
]);

// ---------------------------------------------------------------------------
// Prompt groups (per store)
// ---------------------------------------------------------------------------

export const promptGroups = pgTable(
  "prompt_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "prompt_groups_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    unique("prompt_groups_id_store_id_unique").on(t.id, t.storeId),
    uniqueIndex("prompt_groups_store_name_unique").on(
      t.storeId,
      sql`lower(${t.name})`,
    ),
    index("prompt_groups_organization_id_idx").on(t.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// Prompt templates (per organization, copied into stores)
// ---------------------------------------------------------------------------

// A template is a starting point shared inside one organization. Copying it
// into a store creates that store's own prompt; the template is never tracked.
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    text: text("text").notNull(),
    intent: promptIntent("intent").notNull(),
    topic: text("topic"),
    language: text("language").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("prompt_templates_id_organization_id_unique").on(
      t.id,
      t.organizationId,
    ),
    index("prompt_templates_organization_id_idx").on(t.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// Prompts and their immutable versions
// ---------------------------------------------------------------------------

// The prompt row holds identity and metadata. The exact wording lives in
// prompt_versions, so every run can point at the precise text it sent.
export const prompts = pgTable(
  "prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    groupId: uuid("group_id"),
    topic: text("topic"),
    intent: promptIntent("intent").notNull(),
    // Market context. A change to either creates a new version.
    language: text("language").notNull(),
    country: char("country", { length: 2 }).notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    // Hash of the normalized text of the current version (duplicate detection).
    textHash: text("text_hash").notNull(),
    // Part of the fixed set kept for long-term comparison.
    isCore: boolean("is_core").notNull().default(false),
    creationSource: promptSource("creation_source").notNull().default("manual"),
    sourceTemplateId: uuid("source_template_id"),
    status: promptStatus("status").notNull().default("draft"),
    trackingScope: promptTrackingScope("tracking_scope")
      .notNull()
      .default("both"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "prompts_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    // group_id is nullable: the composite key is only enforced when it is set,
    // and then guarantees the group belongs to the same store.
    foreignKey({
      name: "prompts_group_store_fk",
      columns: [t.groupId, t.storeId],
      foreignColumns: [promptGroups.id, promptGroups.storeId],
    }).onDelete("restrict"),
    foreignKey({
      name: "prompts_template_org_fk",
      columns: [t.sourceTemplateId, t.organizationId],
      foreignColumns: [promptTemplates.id, promptTemplates.organizationId],
    }).onDelete("restrict"),
    unique("prompts_id_store_id_unique").on(t.id, t.storeId),
    uniqueIndex("prompts_store_text_unique")
      .on(t.storeId, t.language, t.country, t.textHash)
      .where(sql`${t.status} <> 'archived'`),
    index("prompts_store_status_idx").on(t.storeId, t.status),
    index("prompts_group_id_idx").on(t.groupId),
    index("prompts_organization_id_idx").on(t.organizationId),
    check("prompts_country_format", sql`${t.country} ~ '^[A-Z]{2}$'`),
    check("prompts_current_version_positive", sql`${t.currentVersion} >= 1`),
  ],
);

// Append-only. A database trigger rejects UPDATE and DELETE (see the
// immutability migration), so history cannot be rewritten even by mistake.
export const promptVersions = pgTable(
  "prompt_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    promptId: uuid("prompt_id").notNull(),
    version: integer("version").notNull(),
    text: text("text").notNull(),
    textHash: text("text_hash").notNull(),
    language: text("language").notNull(),
    country: char("country", { length: 2 }).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "prompt_versions_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "prompt_versions_prompt_store_fk",
      columns: [t.promptId, t.storeId],
      foreignColumns: [prompts.id, prompts.storeId],
    }).onDelete("restrict"),
    unique("prompt_versions_prompt_version_unique").on(t.promptId, t.version),
    // Lets run jobs reference (prompt_version_id, store_id) in a later phase.
    unique("prompt_versions_id_store_id_unique").on(t.id, t.storeId),
    index("prompt_versions_store_id_idx").on(t.storeId),
    index("prompt_versions_organization_id_idx").on(t.organizationId),
    check("prompt_versions_version_positive", sql`${t.version} >= 1`),
    check("prompt_versions_country_format", sql`${t.country} ~ '^[A-Z]{2}$'`),
  ],
);

// ---------------------------------------------------------------------------
// Prompt <-> product/service links
// ---------------------------------------------------------------------------

export const promptProducts = pgTable(
  "prompt_products",
  {
    organizationId: uuid("organization_id").notNull(),
    storeId: uuid("store_id").notNull(),
    promptId: uuid("prompt_id").notNull(),
    productServiceId: uuid("product_service_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({
      name: "prompt_products_pk",
      columns: [t.promptId, t.productServiceId],
    }),
    foreignKey({
      name: "prompt_products_store_org_fk",
      columns: [t.storeId, t.organizationId],
      foreignColumns: [stores.id, stores.organizationId],
    }).onDelete("restrict"),
    foreignKey({
      name: "prompt_products_prompt_store_fk",
      columns: [t.promptId, t.storeId],
      foreignColumns: [prompts.id, prompts.storeId],
    }).onDelete("cascade"),
    foreignKey({
      name: "prompt_products_product_store_fk",
      columns: [t.productServiceId, t.storeId],
      foreignColumns: [productsServices.id, productsServices.storeId],
    }).onDelete("cascade"),
    index("prompt_products_product_idx").on(t.productServiceId),
    index("prompt_products_store_id_idx").on(t.storeId),
  ],
);

export type PromptGroup = typeof promptGroups.$inferSelect;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type Prompt = typeof prompts.$inferSelect;
export type PromptVersion = typeof promptVersions.$inferSelect;
export type PromptIntent = (typeof promptIntent.enumValues)[number];
export type PromptStatus = (typeof promptStatus.enumValues)[number];
export type PromptTrackingScope =
  (typeof promptTrackingScope.enumValues)[number];
export type PromptSource = (typeof promptSource.enumValues)[number];
