import { z } from "zod";

import { appliedClause, atomic, isTriggerAbort, prepare, raw, type Statement } from "../../db/atomic";
import { MEMBER_STATUSES, ROLES, type MemberStatus, type Role } from "../../db/schema";
import { ApiError, conflict, forbidden, notFound } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId } from "../../ids";
import { activityStatement, type ActivityEvent } from "../../logs/activity";
import { recordSecurityEvent } from "../../logs/security";
import { stillAuthorized, type OrgScope } from "../../tenancy/guard";
import { canManageRole } from "../../tenancy/permissions";

export const updateMemberSchema = z
  .strictObject({ role: z.enum(ROLES).optional(), status: z.enum(MEMBER_STATUSES).optional() })
  .refine((input) => input.role !== undefined || input.status !== undefined, { message: "Nothing to change.", path: ["role"] });

type MemberRow = { id: string; userId: string; name: string; email: string; role: Role; status: MemberStatus; createdAt: number };

const MEMBER_SELECT = `select m.id as id, m.user_id as userId, u.name as name, u.email as email, m.role as role, m.status as status, m.created_at as createdAt
  from organization_members m join users u on u.id = m.user_id`;

const toDto = (row: MemberRow) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() });

const lastOwner = () => conflict("last_owner", "An organization must keep at least one active owner.");
const ownerRequired = () => forbidden("owner_required", "Only an owner can manage owners.");
const memberChanged = () => conflict("member_changed", "This member changed. Reload and try again.");

export async function listMembers(context: ApiContext, scope: OrgScope) {
  const { results } = await prepare(
    context.d1,
    raw(
      `${MEMBER_SELECT} where m.organization_id = ?
       order by case m.role when 'owner' then 0 when 'admin' then 1 when 'manager' then 2 when 'member' then 3 else 4 end, u.name collate nocase, m.id`,
      scope.organizationId,
    ),
  ).all<MemberRow>();
  return results.map(toDto);
}

/** The member inside this organization, or 404 (also for a member id of another organization). */
async function findMember(context: ApiContext, scope: OrgScope, memberId: string): Promise<MemberRow> {
  const row = await prepare(context.d1, raw(`${MEMBER_SELECT} where m.id = ? and m.organization_id = ?`, memberId, scope.organizationId)).first<MemberRow>();
  if (!row) throw notFound();
  return row;
}

function activity(context: ApiContext, scope: OrgScope, action: string, memberId: string, metadata: ActivityEvent["metadata"]): ActivityEvent {
  return {
    organizationId: scope.organizationId,
    actorUserId: scope.userId,
    actorName: scope.userName,
    action,
    targetType: "member",
    targetId: memberId,
    metadata,
    requestId: context.requestId,
    at: context.now,
  };
}

async function audit(context: ApiContext, scope: OrgScope, event: string, metadata: Record<string, string>) {
  await recordSecurityEvent(context.d1, {
    organizationId: scope.organizationId,
    userId: scope.userId,
    event,
    outcome: "success",
    ipAddress: context.ip,
    userAgent: context.userAgent,
    metadata,
    requestId: context.requestId,
    at: context.now,
  });
}

async function runGuarded(d1: D1Database, statements: Statement[]): Promise<number[]> {
  try {
    return await atomic(d1, statements);
  } catch (error) {
    if (isTriggerAbort(error, "last_owner")) throw lastOwner();
    throw error;
  }
}

export async function updateMember(context: ApiContext, scope: OrgScope, memberId: string, input: z.output<typeof updateMemberSchema>) {
  const member = await findMember(context, scope, memberId);
  const role = input.role ?? member.role;
  const status = input.status ?? member.status;
  if (!canManageRole(scope.role, member.role) || !canManageRole(scope.role, role)) throw ownerRequired();

  if (member.userId === scope.userId) {
    if (status !== member.status) throw conflict("cannot_change_own_status", "You cannot deactivate yourself. Leave the organization instead.");
    if (role !== member.role && scope.role !== "owner") throw conflict("cannot_change_own_role", "You cannot change your own role.");
  }
  if (role === member.role && status === member.status) return toDto(member);

  const reactivating = member.status === "deactivated" && status === "active";
  const deactivating = member.status === "active" && status === "deactivated";
  const changeId = newChangeId();
  const guard = appliedClause({ table: "organization_members", id: member.id, changeId });
  // Reactivation takes a seat, so the limit is checked inside the write.
  const seatClause = reactivating
    ? ` and (select count(*) from organization_members where organization_id = ? and status = 'active') < (select max_members from organization_entitlements where organization_id = ?)`
    : "";

  const actor = stillAuthorized(scope);
  const statements: Statement[] = [
    raw(
      `update organization_members set role = ?, status = ?, deactivated_at = ?, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and role = ? and status = ?${seatClause} and ${actor.sql}`,
      role,
      status,
      status === "deactivated" ? context.now : null,
      changeId,
      context.now,
      member.id,
      scope.organizationId,
      member.role,
      member.status,
      ...(reactivating ? [scope.organizationId, scope.organizationId] : []),
      ...actor.params,
    ),
    activityStatement(
      activity(context, scope, deactivating ? "member.deactivated" : reactivating ? "member.reactivated" : "member.role_changed", member.id, {
        previousRole: member.role,
        role,
      }),
      guard,
    ),
  ];
  if (deactivating) {
    // A pending invitation to the same address would otherwise let them straight back in.
    statements.push(
      raw(
        `update invitations set status = 'revoked', responded_at = ?, updated_at = ? where organization_id = ? and email = ? and status = 'pending' and ${guard.sql}`,
        context.now,
        context.now,
        scope.organizationId,
        member.email.toLowerCase(),
        ...guard.params,
      ),
    );
  }

  // Invitations they sent that their new standing no longer allows.
  const keepsAll = status === "active" && role === "owner";
  const keepsSome = status === "active" && role === "admin";
  if (!keepsAll) {
    statements.push(
      raw(
        `update invitations set status = 'revoked', responded_at = ?, updated_at = ?
          where organization_id = ? and invited_by_user_id = ? and status = 'pending'${keepsSome ? " and role = 'owner'" : ""} and ${guard.sql}`,
        context.now,
        context.now,
        scope.organizationId,
        member.userId,
        ...guard.params,
      ),
    );
  }

  const [updated] = await runGuarded(context.d1, statements);
  if (updated === 0) {
    if (reactivating) throw new ApiError(409, "member_limit_reached", "The member limit is reached, or this member changed. Reload and try again.");
    throw memberChanged();
  }
  await audit(context, scope, "member.updated", { memberId: member.id, previousRole: member.role, role, status });
  return toDto({ ...member, role, status });
}

/** Deletes the membership. The history of what the person did stays in the activity log. */
async function deleteMembership(context: ApiContext, scope: OrgScope, member: MemberRow, action: "member.removed" | "member.left") {
  const actor = stillAuthorized(scope, action === "member.left" ? "not_deleted" : "active");
  const condition = raw(
    `exists (select 1 from organization_members where id = ? and organization_id = ? and role = ?) and ${actor.sql}`,
    member.id,
    scope.organizationId,
    member.role,
    ...actor.params,
  );
  const results = await runGuarded(context.d1, [
    // Written first: after the delete there is no row left to check. Same transaction, same condition.
    activityStatement(activity(context, scope, action, member.id, { role: member.role }), condition),
    // Invitations to them, and every invitation they sent.
    raw(
      `update invitations set status = 'revoked', responded_at = ?, updated_at = ?
        where organization_id = ? and (email = ? or invited_by_user_id = ?) and status = 'pending' and ${condition.sql}`,
      context.now,
      context.now,
      scope.organizationId,
      member.email.toLowerCase(),
      member.userId,
      ...condition.params,
    ),
    // Last, because the condition reads the rows this removes (when leaving, the actor's own).
    raw(
      `delete from organization_members where id = ? and organization_id = ? and role = ? and ${actor.sql}`,
      member.id,
      scope.organizationId,
      member.role,
      ...actor.params,
    ),
  ]);
  if (results[0] === 0) throw memberChanged();
  await audit(context, scope, action, { memberId: member.id, role: member.role });
  return { id: member.id, removed: true as const };
}

export async function removeMember(context: ApiContext, scope: OrgScope, memberId: string) {
  const member = await findMember(context, scope, memberId);
  if (!canManageRole(scope.role, member.role)) throw ownerRequired();
  if (member.userId === scope.userId) throw conflict("use_leave", "To remove yourself, leave the organization.");
  return deleteMembership(context, scope, member, "member.removed");
}

export async function leaveOrganization(context: ApiContext, scope: OrgScope) {
  const member = await findMember(context, scope, scope.memberId);
  return deleteMembership(context, scope, member, "member.left");
}
