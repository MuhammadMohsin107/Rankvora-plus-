/**
 * Websites and their domains. Every child row carries organization_id and website_id, and a composite
 * foreign key to websites(id, organization_id) makes a mismatched pair impossible to store.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { createdAt, instant, oneOf, updatedAt } from "./columns";
import { organizations } from "./organizations";

/** Shopify is one option among many. */
export const SITE_TYPES = ["shopify", "woocommerce", "wordpress", "webflow", "wix", "squarespace", "custom", "manual"] as const;
export type SiteType = (typeof SITE_TYPES)[number];

export const WEBSITE_STATUSES = ["draft", "active", "paused", "archived", "removed"] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

export const DOMAIN_KINDS = ["canonical", "alias", "redirect"] as const;
export type DomainKind = (typeof DOMAIN_KINDS)[number];

export const DOMAIN_STATUSES = ["active", "retired"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const DOMAIN_VERIFICATION_STATUSES = ["unverified", "pending", "verified"] as const;
export type DomainVerificationStatus = (typeof DOMAIN_VERIFICATION_STATUSES)[number];

export const VERIFICATION_METHODS = ["dns_txt"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const CHALLENGE_STATUSES = ["pending", "verified", "expired", "superseded"] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export const websites = sqliteTable(
  "websites",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    siteType: text("site_type", { enum: SITE_TYPES }).notNull(),
    businessCategory: text("business_category"),
    businessDescription: text("business_description"),
    /** ISO 3166-1 alpha-2. */
    market: text("market").notNull(),
    /** BCP 47 tag. */
    language: text("language").notNull(),
    /** IANA timezone. */
    timezone: text("timezone").notNull(),
    status: text("status", { enum: WEBSITE_STATUSES }).notNull().default("draft"),
    statusBeforeArchive: text("status_before_archive", { enum: WEBSITE_STATUSES }),
    createdByUserId: text("created_by_user_id").notNull(),
    activatedAt: instant("activated_at"),
    pausedAt: instant("paused_at"),
    archivedAt: instant("archived_at"),
    /** Removal is a soft delete: history stays, the website disappears from the product. */
    removedAt: instant("removed_at"),
    /** Optimistic concurrency: a write must name the version it read. */
    version: integer("version").notNull().default(1),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("websites_id_org_uq").on(t.id, t.organizationId),
    index("websites_org_status_idx").on(t.organizationId, t.status),
    check("websites_status_check", oneOf("status", WEBSITE_STATUSES)),
    check("websites_site_type_check", oneOf("site_type", SITE_TYPES)),
  ],
);

export const websiteDomains = sqliteTable(
  "website_domains",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    /** Lowercased ASCII (punycode) hostname. */
    host: text("host").notNull(),
    kind: text("kind", { enum: DOMAIN_KINDS }).notNull(),
    /** Retired rows are the domain history. */
    status: text("status", { enum: DOMAIN_STATUSES }).notNull().default("active"),
    verificationStatus: text("verification_status", { enum: DOMAIN_VERIFICATION_STATUSES }).notNull().default("unverified"),
    verifiedAt: instant("verified_at"),
    createdByUserId: text("created_by_user_id").notNull(),
    retiredAt: instant("retired_at"),
    retiredReason: text("retired_reason"),
    changeId: text("change_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "website_domains_website_fk" }),
    uniqueIndex("website_domains_id_website_org_uq").on(t.id, t.websiteId, t.organizationId),
    index("website_domains_website_idx").on(t.websiteId, t.status),
    uniqueIndex("website_domains_one_canonical_uq")
      .on(t.websiteId)
      .where(sql`kind = 'canonical' and status = 'active'`),
    // Inside one organization an active host belongs to exactly one website.
    uniqueIndex("website_domains_org_host_uq")
      .on(t.organizationId, t.host)
      .where(sql`status = 'active'`),
    // Across the whole platform only one account can hold the proof of ownership of a host.
    uniqueIndex("website_domains_verified_host_uq")
      .on(t.host)
      .where(sql`status = 'active' and verification_status = 'verified'`),
    check("website_domains_kind_check", oneOf("kind", DOMAIN_KINDS)),
    check("website_domains_status_check", oneOf("status", DOMAIN_STATUSES)),
    check("website_domains_verification_check", oneOf("verification_status", DOMAIN_VERIFICATION_STATUSES)),
  ],
);

/** The result of one HTTPS and redirect inspection of a domain. Append-only history. */
export const domainChecks = sqliteTable(
  "domain_checks",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    domainId: text("domain_id").notNull(),
    /** True when https://host/ answered over a valid TLS connection. */
    httpsOk: integer("https_ok", { mode: "boolean" }).notNull(),
    /** True when http://host/ leads to https. Null when http did not answer. */
    httpUpgrades: integer("http_upgrades", { mode: "boolean" }),
    finalUrl: text("final_url"),
    finalStatus: integer("final_status"),
    /** True when the redirects end on a host that is not one of the website's domains. */
    leavesWebsite: integer("leaves_website", { mode: "boolean" }),
    /** JSON array of {url, status} for each hop from https://host/. */
    redirects: text("redirects").notNull(),
    errorCode: text("error_code"),
    checkedByUserId: text("checked_by_user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.domainId, t.websiteId, t.organizationId],
      foreignColumns: [websiteDomains.id, websiteDomains.websiteId, websiteDomains.organizationId],
      name: "domain_checks_domain_fk",
    }),
    index("domain_checks_domain_idx").on(t.domainId, t.createdAt),
  ],
);

export const domainVerifications = sqliteTable(
  "domain_verifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    websiteId: text("website_id").notNull(),
    domainId: text("domain_id").notNull(),
    method: text("method", { enum: VERIFICATION_METHODS }).notNull(),
    recordName: text("record_name").notNull(),
    /** Published in public DNS by the owner, so it is not a secret. */
    recordValue: text("record_value").notNull(),
    status: text("status", { enum: CHALLENGE_STATUSES }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastCheckedAt: instant("last_checked_at"),
    lastErrorCode: text("last_error_code"),
    verifiedAt: instant("verified_at"),
    expiresAt: instant("expires_at").notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    changeId: text("change_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.domainId, t.websiteId, t.organizationId],
      foreignColumns: [websiteDomains.id, websiteDomains.websiteId, websiteDomains.organizationId],
      name: "domain_verifications_domain_fk",
    }),
    uniqueIndex("domain_verifications_one_pending_uq")
      .on(t.domainId)
      .where(sql`status = 'pending'`),
    index("domain_verifications_domain_idx").on(t.domainId, t.createdAt),
    check("domain_verifications_status_check", oneOf("status", CHALLENGE_STATUSES)),
    check("domain_verifications_method_check", oneOf("method", VERIFICATION_METHODS)),
  ],
);
