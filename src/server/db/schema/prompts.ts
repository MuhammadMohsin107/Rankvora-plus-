/**
 * The prompt library. A prompt row holds how it is organized and tracked; every wording, market,
 * language or search-mode change is a new immutable version. A version may be approved once, and the
 * approval never changes afterwards (triggers).
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { createdAt, instant, oneOf, updatedAt } from "./columns";
import { productsServices } from "./catalog";
import { websites } from "./websites";

export const PROMPT_INTENTS = ["discovery", "recommendation", "comparison", "alternative", "product_service", "local_market", "informational"] as const;
export type PromptIntent = (typeof PROMPT_INTENTS)[number];

export const PROMPT_STATUSES = ["draft", "active", "paused", "archived", "deleted"] as const;
export type PromptStatus = (typeof PROMPT_STATUSES)[number];

/** Which modules may use the prompt. */
export const PROMPT_SCOPES = ["audit", "monitoring", "both"] as const;
export type PromptScope = (typeof PROMPT_SCOPES)[number];

/** "ai_generated" is reserved for AI suggestions (Phase 3). */
export const PROMPT_SOURCES = ["manual", "template", "imported", "research_derived", "ai_generated"] as const;
export type PromptSource = (typeof PROMPT_SOURCES)[number];

export const SEARCH_MODES = ["model_only", "web_grounded_required", "web_grounded_auto"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const ASSIGNMENT_PURPOSES = ["audit", "monitoring"] as const;
export type AssignmentPurpose = (typeof ASSIGNMENT_PURPOSES)[number];

/** Which version an assignment runs: the newest approved one, or one fixed version. */
export const VERSION_RULES = ["latest_approved", "pinned"] as const;
export type VersionRule = (typeof VERSION_RULES)[number];

/** Providers a prompt can be assigned to (blueprint 7.1). Connections and model choice are Phase 3. */
export const ASSIGNMENT_PROVIDERS = ["openai", "gemini", "perplexity"] as const;
export type AssignmentProvider = (typeof ASSIGNMENT_PROVIDERS)[number];

export const promptGroups = sqliteTable(
  "prompt_groups",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    removedAt: instant("removed_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "prompt_groups_website_fk" }),
    uniqueIndex("prompt_groups_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    uniqueIndex("prompt_groups_name_uq").on(t.websiteId, t.nameKey).where(sql`removed_at is null`),
  ],
);

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    groupId: text("group_id"),
    intent: text("intent", { enum: PROMPT_INTENTS }).notNull(),
    topic: text("topic"),
    scope: text("scope", { enum: PROMPT_SCOPES }).notNull(),
    isCore: integer("is_core", { mode: "boolean" }).notNull().default(false),
    source: text("source", { enum: PROMPT_SOURCES }).notNull(),
    status: text("status", { enum: PROMPT_STATUSES }).notNull().default("draft"),
    /** Copies of the newest version, for lists, search and the duplicate rule. */
    currentVersion: integer("current_version").notNull(),
    text: text("text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    market: text("market").notNull(),
    language: text("language").notNull(),
    searchMode: text("search_mode", { enum: SEARCH_MODES }).notNull(),
    archivedAt: instant("archived_at"),
    deletedAt: instant("deleted_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "prompts_website_fk" }),
    foreignKey({ columns: [t.groupId, t.websiteId, t.organizationId], foreignColumns: [promptGroups.id, promptGroups.websiteId, promptGroups.organizationId], name: "prompts_group_fk" }),
    uniqueIndex("prompts_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    // The same wording for the same market and language is one prompt.
    uniqueIndex("prompts_wording_uq").on(t.websiteId, t.market, t.language, t.normalizedText).where(sql`status <> 'deleted'`),
    index("prompts_website_idx").on(t.websiteId, t.status, t.createdAt, t.id),
    index("prompts_org_status_idx").on(t.organizationId, t.status),
    check("prompts_intent_check", oneOf("intent", PROMPT_INTENTS)),
    check("prompts_scope_check", oneOf("scope", PROMPT_SCOPES)),
    check("prompts_status_check", oneOf("status", PROMPT_STATUSES)),
    check("prompts_source_check", oneOf("source", PROMPT_SOURCES)),
    check("prompts_search_mode_check", oneOf("search_mode", SEARCH_MODES)),
  ],
);

export const promptVersions = sqliteTable(
  "prompt_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    promptId: text("prompt_id").notNull(),
    version: integer("version").notNull(),
    /** Exactly what is sent to a provider. */
    text: text("text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    market: text("market").notNull(),
    language: text("language").notNull(),
    searchMode: text("search_mode", { enum: SEARCH_MODES }).notNull(),
    changeSummary: text("change_summary"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    /** Set once. Only approved versions can run. */
    approvedAt: instant("approved_at"),
    approvedByUserId: text("approved_by_user_id"),
    approvedByName: text("approved_by_name"),
    changeId: text("change_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.promptId, t.websiteId, t.organizationId], foreignColumns: [prompts.id, prompts.websiteId, prompts.organizationId], name: "prompt_versions_prompt_fk" }),
    uniqueIndex("prompt_versions_number_uq").on(t.promptId, t.version),
    uniqueIndex("prompt_versions_id_prompt_uq").on(t.id, t.promptId),
    check("prompt_versions_search_mode_check", oneOf("search_mode", SEARCH_MODES)),
  ],
);

export const promptTags = sqliteTable(
  "prompt_tags",
  {
    promptId: text("prompt_id").notNull(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    /** Lowercased, so "Local" and "local" are one tag. */
    tag: text("tag").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.promptId, t.websiteId, t.organizationId], foreignColumns: [prompts.id, prompts.websiteId, prompts.organizationId], name: "prompt_tags_prompt_fk" }),
    uniqueIndex("prompt_tags_uq").on(t.promptId, t.tag),
    index("prompt_tags_website_idx").on(t.websiteId, t.tag),
  ],
);

/** The products or services a prompt is about. */
export const promptProducts = sqliteTable(
  "prompt_products",
  {
    promptId: text("prompt_id").notNull(),
    productId: text("product_id").notNull(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.promptId, t.websiteId, t.organizationId], foreignColumns: [prompts.id, prompts.websiteId, prompts.organizationId], name: "prompt_products_prompt_fk" }),
    foreignKey({ columns: [t.productId, t.websiteId, t.organizationId], foreignColumns: [productsServices.id, productsServices.websiteId, productsServices.organizationId], name: "prompt_products_product_fk" }),
    uniqueIndex("prompt_products_uq").on(t.promptId, t.productId),
  ],
);

/**
 * Where a prompt is used and with which settings. Monitoring schedules (Phase 7) read these: editing
 * a prompt never changes what runs until a new version is approved, and a pinned one never moves.
 */
export const promptAssignments = sqliteTable(
  "prompt_assignments",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    promptId: text("prompt_id").notNull(),
    purpose: text("purpose", { enum: ASSIGNMENT_PURPOSES }).notNull(),
    versionRule: text("version_rule", { enum: VERSION_RULES }).notNull(),
    pinnedVersionId: text("pinned_version_id"),
    /** JSON arrays. Model choice arrives with the model registry (Phase 3). */
    providers: text("providers").notNull(),
    markets: text("markets").notNull(),
    languages: text("languages").notNull(),
    searchModes: text("search_modes").notNull(),
    samples: integer("samples").notNull(),
    removedAt: instant("removed_at"),
    version: integer("version").notNull().default(1),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({ columns: [t.promptId, t.websiteId, t.organizationId], foreignColumns: [prompts.id, prompts.websiteId, prompts.organizationId], name: "prompt_assignments_prompt_fk" }),
    foreignKey({ columns: [t.pinnedVersionId, t.promptId], foreignColumns: [promptVersions.id, promptVersions.promptId], name: "prompt_assignments_pinned_fk" }),
    uniqueIndex("prompt_assignments_purpose_uq").on(t.promptId, t.purpose).where(sql`removed_at is null`),
    check("prompt_assignments_purpose_check", oneOf("purpose", ASSIGNMENT_PURPOSES)),
    check("prompt_assignments_rule_check", oneOf("version_rule", VERSION_RULES)),
    check("prompt_assignments_pin_check", sql`(version_rule = 'pinned') = (pinned_version_id is not null)`),
    check("prompt_assignments_samples_check", sql`samples between 1 and 10`),
  ],
);
