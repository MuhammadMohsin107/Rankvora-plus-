/**
 * Tenant guard. An organization or website id from a request is only a question; these functions
 * answer it from the database and return a scope. Services take a scope, never a bare id, so a
 * query cannot be written for a tenant that was not verified.
 *
 * Not a member (or no such record): 404, so another tenant's ids cannot be probed.
 * Member without the permission: 403.
 */
import { prepare, raw, type Statement } from "../db/atomic";
import type { OrganizationStatus, Role, WebsiteStatus } from "../db/schema";
import { forbidden, notFound } from "../http/errors";
import type { ApiContext } from "../http/handler";
import { recordSecurityEvent } from "../logs/security";
import { can, isReadPermission, type Permission } from "./permissions";

declare const verified: unique symbol;

export type OrgScope = {
  readonly [verified]: true;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationStatus: OrganizationStatus;
  readonly memberId: string;
  readonly userId: string;
  readonly userName: string;
  readonly role: Role;
};

export type WebsiteScope = OrgScope & {
  readonly websiteId: string;
  readonly websiteStatus: WebsiteStatus;
};

type MembershipRow = {
  organizationId: string;
  organizationName: string;
  organizationStatus: OrganizationStatus;
  memberId: string;
  role: Role;
};

/**
 * A condition for the first write of a batch: the actor still has the role the guard checked, in an
 * organization that can be changed. Without it, a request already running could finish after the
 * actor was demoted or removed, or the organization suspended or deleted.
 * `"not_deleted"` is only for leaving, which a suspended organization still allows.
 */
export function stillAuthorized(scope: OrgScope, organization: "active" | "not_deleted" = "active"): Statement {
  const organizationClause = organization === "active" ? "ao.status = 'active'" : "ao.status <> 'deleted'";
  return raw(
    `exists (select 1 from organization_members am join organizations ao on ao.id = am.organization_id
       where am.id = ? and am.organization_id = ? and am.role = ? and am.status = 'active' and ${organizationClause})`,
    scope.memberId,
    scope.organizationId,
    scope.role,
  );
}

async function deny(context: ApiContext, organizationId: string | null, permission: Permission, reason: string): Promise<void> {
  await recordSecurityEvent(context.d1, {
    organizationId,
    userId: context.user.id,
    event: "authz.denied",
    outcome: "denied",
    ipAddress: context.ip,
    userAgent: context.userAgent,
    metadata: { permission, reason, method: context.request.method, path: new URL(context.request.url).pathname.slice(0, 200) },
    requestId: context.requestId,
    at: context.now,
  });
}

async function authorize(context: ApiContext, row: MembershipRow, permission: Permission): Promise<OrgScope> {
  if (!can(row.role, permission)) {
    await deny(context, row.organizationId, permission, "role");
    throw forbidden();
  }
  if (row.organizationStatus === "suspended" && !isReadPermission(permission)) {
    await deny(context, row.organizationId, permission, "organization_suspended");
    throw forbidden("organization_suspended", "This organization is suspended. It can be viewed but not changed.");
  }
  context.organizationId = row.organizationId;
  return {
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationStatus: row.organizationStatus,
    memberId: row.memberId,
    userId: context.user.id,
    userName: context.user.name,
    role: row.role,
  } as OrgScope;
}

export async function requireOrganization(context: ApiContext, organizationId: string, permission: Permission): Promise<OrgScope> {
  const row = await prepare(
    context.d1,
    raw(
      `select o.id as organizationId, o.name as organizationName, o.status as organizationStatus, m.id as memberId, m.role as role
         from organization_members m join organizations o on o.id = m.organization_id
        where o.id = ? and m.user_id = ? and m.status = 'active' and o.status <> 'deleted'`,
      organizationId,
      context.user.id,
    ),
  ).first<MembershipRow>();
  if (!row) {
    // No organization id on the record: the caller has no proven link to it.
    await deny(context, null, permission, "not_a_member");
    throw notFound();
  }
  return authorize(context, row, permission);
}

/** Looks the website up together with the caller's membership of the organization that owns it. */
export async function requireWebsite(context: ApiContext, websiteId: string, permission: Permission): Promise<WebsiteScope> {
  const row = await prepare(
    context.d1,
    raw(
      `select o.id as organizationId, o.name as organizationName, o.status as organizationStatus, m.id as memberId, m.role as role,
              w.status as websiteStatus
         from websites w
         join organizations o on o.id = w.organization_id
         join organization_members m on m.organization_id = w.organization_id
        where w.id = ? and m.user_id = ? and m.status = 'active' and o.status <> 'deleted' and w.status <> 'removed'`,
      websiteId,
      context.user.id,
    ),
  ).first<MembershipRow & { websiteStatus: WebsiteStatus }>();
  if (!row) {
    await deny(context, null, permission, "website_not_visible");
    throw notFound();
  }
  const scope = await authorize(context, row, permission);
  return { ...scope, websiteId, websiteStatus: row.websiteStatus };
}
