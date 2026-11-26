/**
 * Invitations. The emailed token is stored only as a hash. Accepting needs a signed-in account whose
 * verified email is the invited address, so a forwarded link is useless to anyone else.
 */
import { z } from "zod";

import {
  INVITATION_DAILY_SENDS,
  INVITATION_MAX_SENDS,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_MS,
  INVITATION_WINDOW_MS,
} from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw, type Statement } from "../../db/atomic";
import { ROLES, type DeliveryStatus, type InvitationStatus, type OrganizationStatus, type Role } from "../../db/schema";
import { ApiError, conflict, forbidden, notFound } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId, randomToken, sha256Hex } from "../../ids";
import { activityStatement, type ActivityEvent } from "../../logs/activity";
import { emailNotConfigured, MailDeliveryError } from "../../mail/mailer";
import { invitationMail } from "../../mail/templates";
import { stillAuthorized, type OrgScope } from "../../tenancy/guard";
import { canManageRole } from "../../tenancy/permissions";
import { email } from "../../validation";

export const createInvitationSchema = z.strictObject({ email, role: z.enum(ROLES) });
export const invitationTokenSchema = z.strictObject({ token: z.string().min(20).max(200) });

type InvitationRow = {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  expiresAt: number;
  deliveryStatus: DeliveryStatus;
  deliveryError: string | null;
  sendCount: number;
  lastSentAt: number | null;
  createdAt: number;
};

const COLUMNS = `i.id as id, i.organization_id as organizationId, i.email as email, i.role as role, i.status as status,
  i.expires_at as expiresAt, i.delivery_status as deliveryStatus, i.delivery_error as deliveryError,
  i.send_count as sendCount, i.last_sent_at as lastSentAt, i.created_at as createdAt`;

/** A pending invitation past its date is shown as expired even before anything rewrites the row. */
function effectiveStatus(row: { status: InvitationStatus; expiresAt: number }, now: Date): InvitationStatus {
  return row.status === "pending" && row.expiresAt <= now.getTime() ? "expired" : row.status;
}

function toDto(row: InvitationRow, now: Date) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: effectiveStatus(row, now),
    delivery: row.deliveryStatus,
    deliveryError: row.deliveryError,
    sendCount: row.sendCount,
    lastSentAt: row.lastSentAt === null ? null : new Date(row.lastSentAt).toISOString(),
    expiresAt: new Date(row.expiresAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

const ownerRequired = () => forbidden("owner_required", "Only an owner can invite or manage owners.");
const unavailable = () => conflict("invitation_unavailable", "This invitation is no longer open.");
const memberLimit = () => conflict("member_limit_reached", "The member limit of this organization is reached.");
const sendQuota = () => new ApiError(429, "invitation_send_limit", "Too many invitation emails in the last 24 hours. Try again later.");

/**
 * Active members plus open invitations are below the member limit. `exceptEmail` leaves out the
 * invitations to one address: for someone being reactivated, their own invitation is not a second seat.
 */
export function seatFree(organizationId: string, now: Date, exceptEmail = ""): Statement {
  return raw(
    `(select count(*) from organization_members where organization_id = ? and status = 'active')
       + (select count(*) from invitations where organization_id = ? and status = 'pending' and expires_at > ? and email <> ?)
       < (select max_members from organization_entitlements where organization_id = ?)`,
    organizationId,
    organizationId,
    now,
    exceptEmail,
    organizationId,
  );
}

/** Emails sent in the last 24 hours, by organization, sender and recipient. Counts revoked invitations too. */
function sendAllowance(scope: OrgScope, recipient: string, now: Date): Statement {
  const since = now.getTime() - INVITATION_WINDOW_MS;
  const sent = (column: "organization_id" | "invited_by_user_id" | "email") =>
    `(select coalesce(sum(send_count), 0) from invitations where ${column} = ? and last_sent_at > ?) < ?`;
  return raw(
    `${sent("organization_id")} and ${sent("invited_by_user_id")} and ${sent("email")}`,
    scope.organizationId,
    since,
    INVITATION_DAILY_SENDS.perOrganization,
    scope.userId,
    since,
    INVITATION_DAILY_SENDS.perSender,
    recipient,
    since,
    INVITATION_DAILY_SENDS.perRecipient,
  );
}

/** Why a guarded invitation write changed nothing. */
async function refusalReason(context: ApiContext, scope: OrgScope, recipient: string, needsSeat: boolean): Promise<ApiError> {
  const allowance = sendAllowance(scope, recipient, context.now);
  const seat = seatFree(scope.organizationId, context.now);
  const row = await prepare(
    context.d1,
    raw(`select (${allowance.sql}) as canSend, (${seat.sql}) as hasSeat`, ...allowance.params, ...seat.params),
  ).first<{ canSend: number; hasSeat: number }>();
  if (row && !row.canSend) return sendQuota();
  if (row && needsSeat && !row.hasSeat) return memberLimit();
  return conflict("invitation_changed", "Something changed while sending. Reload and try again.");
}

function activity(context: ApiContext, organizationId: string, action: string, invitationId: string, metadata?: ActivityEvent["metadata"]): ActivityEvent {
  return {
    organizationId,
    actorUserId: context.user.id,
    actorName: context.user.name,
    action,
    targetType: "invitation",
    targetId: invitationId,
    metadata,
    requestId: context.requestId,
    at: context.now,
  };
}

async function findInOrganization(context: ApiContext, scope: OrgScope, invitationId: string): Promise<InvitationRow> {
  const row = await prepare(
    context.d1,
    raw(`select ${COLUMNS} from invitations i where i.id = ? and i.organization_id = ?`, invitationId, scope.organizationId),
  ).first<InvitationRow>();
  if (!row) throw notFound();
  return row;
}

export async function listInvitations(context: ApiContext, scope: OrgScope) {
  const { results } = await prepare(
    context.d1,
    raw(`select ${COLUMNS} from invitations i where i.organization_id = ? order by i.created_at desc, i.id desc limit 200`, scope.organizationId),
  ).all<InvitationRow>();
  return results.map((row) => toDto(row, context.now));
}

/** Sends the email and records the outcome. Throws 502 when the provider did not accept it. */
async function deliver(
  context: ApiContext,
  scope: OrgScope,
  invitation: { id: string; email: string; role: Role; tokenHash: string; sendNumber: number },
  token: string,
) {
  const appUrl = context.deps.env.appUrl;
  if (!appUrl) throw emailNotConfigured();
  let failure: string | null = null;
  try {
    await context.mailer.send(
      invitationMail({
        to: invitation.email,
        url: `${appUrl}/invitations/accept?token=${encodeURIComponent(token)}`,
        organizationName: scope.organizationName,
        inviterName: scope.userName,
        role: invitation.role,
        idempotencyKey: `invitation-${invitation.id}-${invitation.sendNumber}`,
      }),
    );
  } catch (error) {
    failure = error instanceof MailDeliveryError ? error.code : "send_failed";
  }
  // The attempt was already counted by the write that issued this token.
  await prepare(
    context.d1,
    raw(
      `update invitations set delivery_status = ?, delivery_error = ?, updated_at = ? where id = ? and token_hash = ?`,
      failure ? "failed" : "sent",
      failure,
      context.now,
      invitation.id,
      invitation.tokenHash,
    ),
  ).run();
  if (failure) {
    throw new ApiError(502, "email_delivery_failed", "The invitation was saved but the email could not be sent. Send it again.", undefined, {
      invitationId: invitation.id,
    });
  }
}

export async function createInvitation(context: ApiContext, scope: OrgScope, input: z.output<typeof createInvitationSchema>) {
  if (!canManageRole(scope.role, input.role)) throw ownerRequired();
  if (!context.mailer.configured) throw emailNotConfigured();

  const existing = await prepare(
    context.d1,
    raw(
      `select 1 as found from organization_members m join users u on u.id = m.user_id
        where m.organization_id = ? and lower(u.email) = ? and m.status = 'active'`,
      scope.organizationId,
      input.email,
    ),
  ).first<{ found: number }>();
  if (existing) throw conflict("already_member", "This person is already a member.");

  const id = newId("inv");
  const changeId = newChangeId();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const guard = appliedClause({ table: "invitations", id, changeId });
  const { now } = context;
  const seat = seatFree(scope.organizationId, now);
  const allowance = sendAllowance(scope, input.email, now);
  const actor = stillAuthorized(scope);

  let results: number[];
  try {
    results = await atomic(context.d1, [
      raw(
        `update invitations set status = 'expired', updated_at = ? where organization_id = ? and email = ? and status = 'pending' and expires_at <= ?`,
        now,
        scope.organizationId,
        input.email,
        now,
      ),
      // A pending invitation holds a seat. The first send is counted here.
      raw(
        `insert into invitations (id, organization_id, email, role, token_hash, status, invited_by_user_id, expires_at, delivery_status, send_count, last_sent_at, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, 'pending', ?, ?, 'pending', 1, ?, ?, ?, ?
          where ${seat.sql} and ${allowance.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        input.email,
        input.role,
        tokenHash,
        scope.userId,
        now.getTime() + INVITATION_TTL_MS,
        now,
        changeId,
        now,
        now,
        ...seat.params,
        ...allowance.params,
        ...actor.params,
      ),
      activityStatement(activity(context, scope.organizationId, "invitation.created", id, { role: input.role }), guard),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "invitations.organization_id", "invitations.email")) {
      throw conflict("invitation_pending", "An invitation to this address is already open. Send it again instead.");
    }
    throw error;
  }
  if (results[1] === 0) throw await refusalReason(context, scope, input.email, true);
  context.commit();

  await deliver(context, scope, { id, email: input.email, role: input.role, tokenHash, sendNumber: 1 }, token);
  return toDto(await findInOrganization(context, scope, id), context.now);
}

/** Sends again with a new token, so the previous link stops working. */
export async function resendInvitation(context: ApiContext, scope: OrgScope, invitationId: string) {
  const invitation = await findInOrganization(context, scope, invitationId);
  if (!canManageRole(scope.role, invitation.role)) throw ownerRequired();
  if (invitation.status !== "pending") throw unavailable();
  if (!context.mailer.configured) throw emailNotConfigured();
  if (invitation.sendCount >= INVITATION_MAX_SENDS) {
    throw conflict("send_limit_reached", "This invitation was sent too many times. Revoke it and create a new one.");
  }
  if (invitation.lastSentAt !== null && context.now.getTime() - invitation.lastSentAt < INVITATION_RESEND_COOLDOWN_MS) {
    throw new ApiError(429, "too_soon", "Wait a minute before sending again.");
  }

  const changeId = newChangeId();
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const seat = seatFree(scope.organizationId, context.now);
  const allowance = sendAllowance(scope, invitation.email, context.now);
  const actor = stillAuthorized(scope);
  // An expired invitation holds no seat, so reviving it needs a free one.
  const expired = invitation.expiresAt <= context.now.getTime();
  const [updated] = await atomic(context.d1, [
    // Counting the send inside the guarded write lets only one of two simultaneous requests through.
    // The sender becomes the inviter: acceptance checks that person's authority.
    raw(
      `update invitations set token_hash = ?, expires_at = ?, invited_by_user_id = ?, delivery_status = 'pending', delivery_error = null,
          send_count = send_count + 1, last_sent_at = ?, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and status = 'pending' and send_count = ?
          and (expires_at > ? or (${seat.sql})) and ${allowance.sql} and ${actor.sql}`,
      tokenHash,
      context.now.getTime() + INVITATION_TTL_MS,
      scope.userId,
      context.now,
      changeId,
      context.now,
      invitation.id,
      scope.organizationId,
      invitation.sendCount,
      context.now,
      ...seat.params,
      ...allowance.params,
      ...actor.params,
    ),
    activityStatement(
      activity(context, scope.organizationId, "invitation.resent", invitation.id),
      appliedClause({ table: "invitations", id: invitation.id, changeId }),
    ),
  ]);
  if (updated === 0) throw await refusalReason(context, scope, invitation.email, expired);

  await deliver(context, scope, { id: invitation.id, email: invitation.email, role: invitation.role, tokenHash, sendNumber: invitation.sendCount + 1 }, token);
  return toDto(await findInOrganization(context, scope, invitation.id), context.now);
}

export async function revokeInvitation(context: ApiContext, scope: OrgScope, invitationId: string) {
  const invitation = await findInOrganization(context, scope, invitationId);
  if (!canManageRole(scope.role, invitation.role)) throw ownerRequired();
  const changeId = newChangeId();
  const actor = stillAuthorized(scope);
  const [updated] = await atomic(context.d1, [
    raw(
      `update invitations set status = 'revoked', responded_at = ?, change_id = ?, updated_at = ?
        where id = ? and organization_id = ? and status = 'pending' and ${actor.sql}`,
      context.now,
      changeId,
      context.now,
      invitation.id,
      scope.organizationId,
      ...actor.params,
    ),
    activityStatement(
      activity(context, scope.organizationId, "invitation.revoked", invitation.id),
      appliedClause({ table: "invitations", id: invitation.id, changeId }),
    ),
  ]);
  if (updated === 0) throw unavailable();
  return { id: invitation.id, status: "revoked" as const };
}

/* ───────── The invited person ───────── */

type TokenRow = InvitationRow & { organizationName: string; organizationStatus: OrganizationStatus };

/** The invitation for this token, only for the signed-in, verified owner of the invited address. */
async function findForInvitee(context: ApiContext, token: string): Promise<TokenRow & { tokenHash: string }> {
  const tokenHash = await sha256Hex(token);
  const row = await prepare(
    context.d1,
    raw(
      `select ${COLUMNS}, o.name as organizationName, o.status as organizationStatus
         from invitations i join organizations o on o.id = i.organization_id where i.token_hash = ?`,
      tokenHash,
    ),
  ).first<TokenRow>();
  if (!row || row.organizationStatus === "deleted") throw notFound();
  if (row.email !== context.user.email.toLowerCase()) {
    throw forbidden("invitation_email_mismatch", "Sign in with the email address that received the invitation.");
  }
  if (!context.user.emailVerified) throw forbidden("email_not_verified", "Confirm your email address first.");
  return { ...row, tokenHash };
}

export async function lookupInvitation(context: ApiContext, input: z.output<typeof invitationTokenSchema>) {
  const row = await findForInvitee(context, input.token);
  return {
    organizationName: row.organizationName,
    role: row.role,
    status: effectiveStatus(row, context.now),
    expiresAt: new Date(row.expiresAt).toISOString(),
  };
}

export async function acceptInvitation(context: ApiContext, input: z.output<typeof invitationTokenSchema>) {
  const row = await findForInvitee(context, input.token);
  if (effectiveStatus(row, context.now) !== "pending" || row.organizationStatus !== "active") throw unavailable();

  const membership = await prepare(
    context.d1,
    raw(`select status from organization_members where organization_id = ? and user_id = ?`, row.organizationId, context.user.id),
  ).first<{ status: string }>();
  if (membership?.status === "active") throw conflict("already_member", "You are already a member of this organization.");

  const changeId = newChangeId();
  const guard = appliedClause({ table: "invitations", id: row.id, changeId });
  const { now, user } = context;
  const [accepted] = await atomic(context.d1, [
    // The inviter must still be allowed to grant this role, or a removed owner or admin could use an
    // earlier invitation to get back in.
    raw(
      `update invitations set status = 'accepted', responded_at = ?, responded_by_user_id = ?, change_id = ?, updated_at = ?
        where id = ? and token_hash = ? and status = 'pending' and expires_at > ?
          and exists (select 1 from organization_members g
                       where g.organization_id = invitations.organization_id and g.user_id = invitations.invited_by_user_id and g.status = 'active'
                         and (g.role = 'owner' or (g.role = 'admin' and invitations.role <> 'owner')))
          and exists (select 1 from organizations where id = ? and status = 'active')
          and (select count(*) from organization_members where organization_id = ? and status = 'active')
              < (select max_members from organization_entitlements where organization_id = ?)`,
      now,
      user.id,
      changeId,
      now,
      row.id,
      row.tokenHash,
      now,
      row.organizationId,
      row.organizationId,
      row.organizationId,
    ),
    // A previously deactivated member is reactivated with the invited role.
    raw(
      `insert into organization_members (id, organization_id, user_id, role, status, change_id, created_at, updated_at)
       select ?, ?, ?, ?, 'active', ?, ?, ? where ${guard.sql}
       on conflict (organization_id, user_id) do update set
         role = excluded.role, status = 'active', deactivated_at = null, change_id = excluded.change_id, updated_at = excluded.updated_at
       where organization_members.status = 'deactivated'`,
      newId("mem"),
      row.organizationId,
      user.id,
      row.role,
      changeId,
      now,
      now,
      ...guard.params,
    ),
    activityStatement(activity(context, row.organizationId, "invitation.accepted", row.id, { role: row.role }), guard),
  ]);

  if (accepted === 0) {
    const seats = await prepare(
      context.d1,
      raw(
        `select (select count(*) from organization_members where organization_id = ? and status = 'active') >=
                (select max_members from organization_entitlements where organization_id = ?) as seatsFull`,
        row.organizationId,
        row.organizationId,
      ),
    ).first<{ seatsFull: number }>();
    throw seats?.seatsFull ? memberLimit() : unavailable();
  }
  context.organizationId = row.organizationId;
  return { organizationId: row.organizationId, organizationName: row.organizationName, role: row.role };
}

export async function rejectInvitation(context: ApiContext, input: z.output<typeof invitationTokenSchema>) {
  const row = await findForInvitee(context, input.token);
  const changeId = newChangeId();
  const [updated] = await atomic(context.d1, [
    raw(
      `update invitations set status = 'rejected', responded_at = ?, responded_by_user_id = ?, change_id = ?, updated_at = ?
        where id = ? and token_hash = ? and status = 'pending' and expires_at > ?`,
      context.now,
      context.user.id,
      changeId,
      context.now,
      row.id,
      row.tokenHash,
      context.now,
    ),
    activityStatement(activity(context, row.organizationId, "invitation.rejected", row.id), appliedClause({ table: "invitations", id: row.id, changeId })),
  ]);
  if (updated === 0) throw unavailable();
  return { status: "rejected" as const };
}
