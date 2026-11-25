import { z } from "zod";

import { DomainError, normalizeHost } from "@/lib/domain";

import { appliedClause, atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import {
  SITE_TYPES,
  WEBSITE_STATUSES,
  type DomainVerificationStatus,
  type SiteType,
  type WebsiteStatus,
} from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement, type ActivityEvent } from "../../logs/activity";
import { stillAuthorized, type OrgScope, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, language, market, timezone, version } from "../../validation";

/* ───────── Input ───────── */

const name = boundedText("Name", 2, 80);
const category = boundedText("Business category", 1, 80);
const description = boundedText("Description", 1, 1000, "multiple");
export const domainInput = z.string({ error: "Domain is required." }).max(300, "Domain is too long.");

export const createWebsiteSchema = z.strictObject({
  organizationId: z.string().min(1).max(64),
  name,
  domain: domainInput,
  siteType: z.enum(SITE_TYPES, { error: "Choose a site type." }),
  market,
  language,
  timezone,
  businessCategory: category.nullish(),
  businessDescription: description.nullish(),
});

export const listWebsitesSchema = z.object({
  organizationId: z.string({ error: "organizationId is required." }).min(1).max(64),
  status: z.enum(WEBSITE_STATUSES).exclude(["removed"]).optional(),
});

const PROFILE_FIELDS = ["name", "siteType", "businessCategory", "businessDescription", "market", "language", "timezone"] as const;

export const updateWebsiteSchema = z
  .strictObject({
    version,
    name: name.optional(),
    siteType: z.enum(SITE_TYPES).optional(),
    businessCategory: category.nullable().optional(),
    businessDescription: description.nullable().optional(),
    market: market.optional(),
    language: language.optional(),
    timezone: timezone.optional(),
  })
  .refine((input) => PROFILE_FIELDS.some((field) => input[field] !== undefined), { message: "Nothing to change.", path: ["name"] });

export const WEBSITE_ACTIONS = ["activate", "pause", "resume", "archive", "restore"] as const;
export type WebsiteAction = (typeof WEBSITE_ACTIONS)[number];
export const websiteStatusSchema = z.strictObject({ action: z.enum(WEBSITE_ACTIONS), version });
export const removeWebsiteSchema = z.strictObject({ version, confirmName: z.string() });

/** Parses a domain field, reporting problems against that field. */
export function parseHost(value: string, field = "domain"): string {
  try {
    return normalizeHost(value);
  } catch (error) {
    if (error instanceof DomainError) throw invalid({ [field]: error.message });
    throw error;
  }
}

/* ───────── Lifecycle rules (pure) ───────── */

const TRANSITIONS: Record<WebsiteAction, readonly WebsiteStatus[]> = {
  activate: ["draft"],
  pause: ["active"],
  resume: ["paused"],
  archive: ["draft", "active", "paused"],
  restore: ["archived"],
};

/** The status after the action, or null when the action is not allowed from here. */
export function nextStatus(current: WebsiteStatus, action: WebsiteAction, beforeArchive: WebsiteStatus | null): WebsiteStatus | null {
  if (!TRANSITIONS[action].includes(current)) return null;
  if (action === "activate" || action === "resume") return "active";
  if (action === "pause") return "paused";
  if (action === "archive") return "archived";
  // Restoring never resumes by itself: a website that was running comes back paused.
  return beforeArchive === "draft" ? "draft" : "paused";
}

/* ───────── Reads ───────── */

type WebsiteRow = {
  id: string;
  organizationId: string;
  name: string;
  siteType: SiteType;
  businessCategory: string | null;
  businessDescription: string | null;
  market: string;
  language: string;
  timezone: string;
  status: WebsiteStatus;
  statusBeforeArchive: WebsiteStatus | null;
  version: number;
  createdAt: number;
  updatedAt: number;
  activatedAt: number | null;
  pausedAt: number | null;
  archivedAt: number | null;
  domainId: string | null;
  domainHost: string | null;
  domainVerification: DomainVerificationStatus | null;
  domainVerifiedAt: number | null;
};

const SELECT = `select w.id as id, w.organization_id as organizationId, w.name as name, w.site_type as siteType,
    w.business_category as businessCategory, w.business_description as businessDescription, w.market as market,
    w.language as language, w.timezone as timezone, w.status as status, w.status_before_archive as statusBeforeArchive,
    w.version as version, w.created_at as createdAt, w.updated_at as updatedAt, w.activated_at as activatedAt,
    w.paused_at as pausedAt, w.archived_at as archivedAt,
    d.id as domainId, d.host as domainHost, d.verification_status as domainVerification, d.verified_at as domainVerifiedAt
  from websites w
  left join website_domains d on d.website_id = w.id and d.organization_id = w.organization_id and d.kind = 'canonical' and d.status = 'active'`;

const iso = (value: number | null) => (value === null ? null : new Date(value).toISOString());

function toDto(row: WebsiteRow) {
  const { domainId, domainHost, domainVerification, domainVerifiedAt, ...website } = row;
  return {
    ...website,
    createdAt: iso(row.createdAt) as string,
    updatedAt: iso(row.updatedAt) as string,
    activatedAt: iso(row.activatedAt),
    pausedAt: iso(row.pausedAt),
    archivedAt: iso(row.archivedAt),
    domain:
      domainId && domainHost && domainVerification
        ? { id: domainId, host: domainHost, verificationStatus: domainVerification, verifiedAt: iso(domainVerifiedAt) }
        : null,
  };
}

async function loadRow(d1: D1Database, organizationId: string, websiteId: string): Promise<WebsiteRow> {
  const row = await prepare(d1, raw(`${SELECT} where w.id = ? and w.organization_id = ? and w.status <> 'removed'`, websiteId, organizationId)).first<WebsiteRow>();
  if (!row) throw notFound();
  return row;
}

export async function listWebsites(context: ApiContext, scope: OrgScope, status?: WebsiteStatus) {
  const { results } = await prepare(
    context.d1,
    raw(
      `${SELECT} where w.organization_id = ? and w.status <> 'removed'${status ? " and w.status = ?" : ""} order by w.name collate nocase, w.id limit 500`,
      scope.organizationId,
      ...(status ? [status] : []),
    ),
  ).all<WebsiteRow>();
  return results.map(toDto);
}

export async function getWebsite(context: ApiContext, scope: WebsiteScope) {
  return toDto(await loadRow(context.d1, scope.organizationId, scope.websiteId));
}

/* ───────── Writes ───────── */

export function websiteActivity(
  context: ApiContext,
  scope: { organizationId: string; userId: string; userName: string },
  websiteId: string,
  action: string,
  metadata?: ActivityEvent["metadata"],
  target: { type: string; id: string } = { type: "website", id: websiteId },
): ActivityEvent {
  return {
    organizationId: scope.organizationId,
    websiteId,
    actorUserId: scope.userId,
    actorName: scope.userName,
    action,
    targetType: target.type,
    targetId: target.id,
    metadata,
    requestId: context.requestId,
    at: context.now,
  };
}

export const domainInUse = () => conflict("domain_in_use", "Another website in this organization already uses this domain.");
export const domainVerifiedElsewhere = () =>
  conflict("domain_verified_elsewhere", "Another account has already verified this domain. Contact support if you now own it.");

export async function createWebsite(context: ApiContext, scope: OrgScope, input: z.output<typeof createWebsiteSchema>) {
  const host = parseHost(input.domain);
  const taken = await prepare(
    context.d1,
    raw(`select 1 as found from website_domains where organization_id = ? and host = ? and status = 'active'`, scope.organizationId, host),
  ).first<{ found: number }>();
  if (taken) throw domainInUse();

  const id = newId("web");
  const changeId = newChangeId();
  const guard = appliedClause({ table: "websites", id, changeId });
  const { now } = context;
  const actor = stillAuthorized(scope);

  let results: number[];
  try {
    results = await atomic(context.d1, [
      raw(
        `insert into websites (id, organization_id, name, site_type, business_category, business_description, market, language, timezone,
           status, created_by_user_id, version, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, ?
          where (select count(*) from websites where organization_id = ? and status <> 'removed')
              < (select max_websites from organization_entitlements where organization_id = ?)
            and ${actor.sql}`,
        id,
        scope.organizationId,
        input.name,
        input.siteType,
        input.businessCategory ?? null,
        input.businessDescription ?? null,
        input.market,
        input.language,
        input.timezone,
        scope.userId,
        changeId,
        now,
        now,
        scope.organizationId,
        scope.organizationId,
        ...actor.params,
      ),
      raw(
        `insert into website_domains (id, organization_id, website_id, host, kind, status, verification_status, created_by_user_id, created_at)
         select ?, ?, ?, ?, 'canonical', 'active', 'unverified', ?, ? where ${guard.sql}`,
        newId("dom"),
        scope.organizationId,
        id,
        host,
        scope.userId,
        now,
        ...guard.params,
      ),
      activityStatement(websiteActivity(context, scope, id, "website.created", { domain: host }), guard),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "website_domains.organization_id", "website_domains.host")) throw domainInUse();
    throw error;
  }
  if (results[0] === 0) throw conflict("website_limit_reached", "The website limit of this organization is reached.");
  context.commit();
  return toDto(await loadRow(context.d1, scope.organizationId, id));
}

const PROFILE_COLUMNS: Record<(typeof PROFILE_FIELDS)[number], string> = {
  name: "name",
  siteType: "site_type",
  businessCategory: "business_category",
  businessDescription: "business_description",
  market: "market",
  language: "language",
  timezone: "timezone",
};

export async function updateWebsite(context: ApiContext, scope: WebsiteScope, input: z.output<typeof updateWebsiteSchema>) {
  if (scope.websiteStatus === "archived") throw conflict("website_archived", "Restore the website before changing it.");
  const changed = PROFILE_FIELDS.filter((field) => input[field] !== undefined);
  const changeId = newChangeId();
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update websites set ${changed.map((field) => `${PROFILE_COLUMNS[field]} = ?`).join(", ")}, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and version = ? and status in ('draft', 'active', 'paused') and ${actor.sql}`,
      ...changed.map((field) => input[field]),
      changeId,
      context.now,
      scope.websiteId,
      scope.organizationId,
      input.version,
      ...actor.params,
    ),
    activityStatement(
      websiteActivity(context, scope, scope.websiteId, "website.updated", { fields: changed.join(",") }),
      appliedClause({ table: "websites", id: scope.websiteId, changeId }),
    ),
  ]);
  if (updated === 0) throw versionConflict();
  return getWebsite(context, scope);
}

export async function changeWebsiteStatus(context: ApiContext, scope: WebsiteScope, input: z.output<typeof websiteStatusSchema>) {
  const current = await loadRow(context.d1, scope.organizationId, scope.websiteId);
  const target = nextStatus(current.status, input.action, current.statusBeforeArchive);
  if (!target) throw conflict("invalid_transition", `You cannot ${input.action} a website that is ${current.status}.`);

  const changeId = newChangeId();
  const { now } = context;
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update websites set status = ?, status_before_archive = ?,
          activated_at = case when ? = 'active' then coalesce(activated_at, ?) else activated_at end,
          paused_at = case when ? = 'paused' then ? else null end,
          archived_at = case when ? = 'archived' then ? else null end,
          version = version + 1, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and version = ? and status = ? and ${actor.sql}`,
      target,
      input.action === "archive" ? current.status : null,
      target,
      now,
      target,
      now,
      target,
      now,
      changeId,
      now,
      scope.websiteId,
      scope.organizationId,
      input.version,
      current.status,
      ...actor.params,
    ),
    activityStatement(
      websiteActivity(context, scope, scope.websiteId, `website.${input.action}`, { from: current.status, to: target }),
      appliedClause({ table: "websites", id: scope.websiteId, changeId }),
    ),
  ]);
  if (updated === 0) throw versionConflict();
  return getWebsite(context, scope);
}

/**
 * Soft delete of an archived website. Its domains are released; its history, activity and usage
 * records are kept.
 */
export async function removeWebsite(context: ApiContext, scope: WebsiteScope, input: z.output<typeof removeWebsiteSchema>) {
  const current = await loadRow(context.d1, scope.organizationId, scope.websiteId);
  if (current.status !== "archived") throw conflict("not_archived", "Archive the website before removing it.");
  if (input.confirmName.trim() !== current.name) throw invalid({ confirmName: "Type the website name exactly to confirm." });

  const changeId = newChangeId();
  const guard = appliedClause({ table: "websites", id: scope.websiteId, changeId });
  const { now } = context;
  const actor = stillAuthorized(scope);
  const [removed] = await atomic(context.d1, [
    raw(
      `update websites set status = 'removed', removed_at = ?, version = version + 1, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and version = ? and status = 'archived' and ${actor.sql}`,
      now,
      changeId,
      now,
      scope.websiteId,
      scope.organizationId,
      input.version,
      ...actor.params,
    ),
    raw(`update domain_verifications set status = 'superseded' where website_id = ? and status = 'pending' and ${guard.sql}`, scope.websiteId, ...guard.params),
    raw(
      `update website_domains set status = 'retired', retired_at = ?, retired_reason = 'website_removed' where website_id = ? and status = 'active' and ${guard.sql}`,
      now,
      scope.websiteId,
      ...guard.params,
    ),
    activityStatement(websiteActivity(context, scope, scope.websiteId, "website.removed", { name: current.name }), guard),
  ]);
  if (removed === 0) throw versionConflict();
  return { id: scope.websiteId, status: "removed" as const };
}
