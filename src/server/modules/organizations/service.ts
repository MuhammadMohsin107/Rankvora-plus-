import { z } from "zod";

import { appliedClause, atomic, prepare, raw, type Applied } from "../../db/atomic";
import type { OrganizationStatus, Role } from "../../db/schema";
import { DEFAULT_ENTITLEMENTS, MAX_OWNED_ORGANIZATIONS } from "../../config/limits";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId, randomToken } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { stillAuthorized, type OrgScope } from "../../tenancy/guard";
import { permissionsFor } from "../../tenancy/permissions";
import { displayName, timezone, version } from "../../validation";

export const createOrganizationSchema = z.strictObject({
  // Appears in invitation emails, so links are not allowed in it.
  name: displayName("Name"),
  timezone,
});

export const updateOrganizationSchema = z
  .strictObject({
    version,
    name: displayName("Name").optional(),
    timezone: timezone.optional(),
  })
  .refine((input) => input.name !== undefined || input.timezone !== undefined, { message: "Nothing to change.", path: ["name"] });

export const deleteOrganizationSchema = z.strictObject({ confirmName: z.string() });

export type OrganizationSummary = { id: string; name: string; slug: string; timezone: string; status: OrganizationStatus; role: Role };

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: OrganizationStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
  activeMembers: number;
  websites: number;
};

/** Readable and unique without a second query: the suffix is random. */
function slugFor(name: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "x");
  return `${base || "organization"}-${suffix}`;
}

export async function listOrganizations(context: ApiContext): Promise<OrganizationSummary[]> {
  const { results } = await prepare(
    context.d1,
    raw(
      `select o.id as id, o.name as name, o.slug as slug, o.timezone as timezone, o.status as status, m.role as role
         from organization_members m join organizations o on o.id = m.organization_id
        where m.user_id = ? and m.status = 'active' and o.status <> 'deleted'
        order by o.name collate nocase, o.id`,
      context.user.id,
    ),
  ).all<OrganizationSummary>();
  return results;
}

export async function createOrganization(context: ApiContext, input: z.output<typeof createOrganizationSchema>) {
  const id = newId("org");
  const changeId = newChangeId();
  const created: Applied = { table: "organizations", id, changeId };
  const guard = appliedClause(created);
  const { now, user } = context;

  const [inserted] = await atomic(context.d1, [
    raw(
      `insert into organizations (id, name, slug, timezone, status, created_by_user_id, version, change_id, created_at, updated_at)
       select ?, ?, ?, ?, 'active', ?, 1, ?, ?, ?
        where (select count(*) from organization_members m join organizations o on o.id = m.organization_id
                where m.user_id = ? and m.role = 'owner' and m.status = 'active' and o.status <> 'deleted') < ?`,
      id,
      input.name,
      slugFor(input.name),
      input.timezone,
      user.id,
      changeId,
      now,
      now,
      user.id,
      MAX_OWNED_ORGANIZATIONS,
    ),
    raw(
      `insert into organization_members (id, organization_id, user_id, role, status, created_at, updated_at)
       select ?, ?, ?, 'owner', 'active', ?, ? where ${guard.sql}`,
      newId("mem"),
      id,
      user.id,
      now,
      now,
      ...guard.params,
    ),
    raw(
      `insert into organization_entitlements (organization_id, max_websites, max_members, max_active_prompts, monthly_ai_requests, monthly_search_calls, source, created_at, updated_at)
       select ?, ?, ?, ?, ?, ?, 'default', ?, ? where ${guard.sql}`,
      id,
      DEFAULT_ENTITLEMENTS.maxWebsites,
      DEFAULT_ENTITLEMENTS.maxMembers,
      DEFAULT_ENTITLEMENTS.maxActivePrompts,
      DEFAULT_ENTITLEMENTS.monthlyAiRequests,
      DEFAULT_ENTITLEMENTS.monthlySearchCalls,
      now,
      now,
      ...guard.params,
    ),
    activityStatement(
      { organizationId: id, actorUserId: user.id, actorName: user.name, action: "organization.created", targetType: "organization", targetId: id, requestId: context.requestId, at: now },
      guard,
    ),
  ]);

  if (inserted === 0) {
    throw conflict("organization_limit_reached", `You can own up to ${MAX_OWNED_ORGANIZATIONS} organizations.`);
  }
  context.commit();
  context.organizationId = id;
  return loadOrganization(context.d1, id, "owner");
}

async function loadOrganization(d1: D1Database, organizationId: string, role: Role) {
  const row = await prepare(
    d1,
    raw(
      `select o.id as id, o.name as name, o.slug as slug, o.timezone as timezone, o.status as status, o.version as version,
              o.created_at as createdAt, o.updated_at as updatedAt,
              (select count(*) from organization_members m where m.organization_id = o.id and m.status = 'active') as activeMembers,
              (select count(*) from websites w where w.organization_id = o.id and w.status <> 'removed') as websites
         from organizations o where o.id = ? and o.status <> 'deleted'`,
      organizationId,
    ),
  ).first<OrganizationRow>();
  if (!row) throw notFound();
  return {
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
    role,
    permissions: permissionsFor(role),
  };
}

export const getOrganization = (context: ApiContext, scope: OrgScope) => loadOrganization(context.d1, scope.organizationId, scope.role);

export async function updateOrganization(context: ApiContext, scope: OrgScope, input: z.output<typeof updateOrganizationSchema>) {
  const changeId = newChangeId();
  const applied: Applied = { table: "organizations", id: scope.organizationId, changeId };
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update organizations set name = coalesce(?, name), timezone = coalesce(?, timezone), version = version + 1, change_id = ?, updated_at = ?
        where id = ? and version = ? and status = 'active' and ${actor.sql}`,
      input.name ?? null,
      input.timezone ?? null,
      changeId,
      context.now,
      scope.organizationId,
      input.version,
      ...actor.params,
    ),
    activityStatement(
      {
        organizationId: scope.organizationId,
        actorUserId: scope.userId,
        actorName: scope.userName,
        action: "organization.updated",
        targetType: "organization",
        targetId: scope.organizationId,
        metadata: { name: input.name, timezone: input.timezone },
        requestId: context.requestId,
        at: context.now,
      },
      appliedClause(applied),
    ),
  ]);
  if (updated === 0) throw versionConflict();
  return loadOrganization(context.d1, scope.organizationId, scope.role);
}

/**
 * Soft delete. Websites are marked removed, their domains are released for other accounts, and
 * pending invitations are revoked. History and usage records are kept.
 */
export async function deleteOrganization(context: ApiContext, scope: OrgScope, input: z.output<typeof deleteOrganizationSchema>) {
  if (input.confirmName.trim() !== scope.organizationName) {
    throw invalid({ confirmName: "Type the organization name exactly to confirm." });
  }
  const changeId = newChangeId();
  const guard = appliedClause({ table: "organizations", id: scope.organizationId, changeId });
  const id = scope.organizationId;
  const { now } = context;
  const actor = stillAuthorized(scope);

  const [deleted] = await atomic(context.d1, [
    raw(
      `update organizations set status = 'deleted', deleted_at = ?, updated_at = ?, version = version + 1, change_id = ?
        where id = ? and status = 'active' and ${actor.sql}`,
      now,
      now,
      changeId,
      id,
      ...actor.params,
    ),
    raw(`update domain_verifications set status = 'superseded' where organization_id = ? and status = 'pending' and ${guard.sql}`, id, ...guard.params),
    raw(
      `update website_domains set status = 'retired', retired_at = ?, retired_reason = 'organization_deleted' where organization_id = ? and status = 'active' and ${guard.sql}`,
      now,
      id,
      ...guard.params,
    ),
    raw(
      `update websites set status = 'removed', removed_at = ?, updated_at = ?, version = version + 1 where organization_id = ? and status <> 'removed' and ${guard.sql}`,
      now,
      now,
      id,
      ...guard.params,
    ),
    raw(
      `update invitations set status = 'revoked', responded_at = ?, updated_at = ? where organization_id = ? and status = 'pending' and ${guard.sql}`,
      now,
      now,
      id,
      ...guard.params,
    ),
    activityStatement(
      { organizationId: id, actorUserId: scope.userId, actorName: scope.userName, action: "organization.deleted", targetType: "organization", targetId: id, requestId: context.requestId, at: now },
      guard,
    ),
  ]);
  if (deleted === 0) throw conflict("organization_changed", "This organization changed. Reload and try again.");
  return { id, status: "deleted" as const };
}
