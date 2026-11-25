/** Endpoints under /api/v1/auth/me, /api/v1/organizations and /api/v1/invitations. */
import { prepare, raw } from "../db/atomic";
import { apiHandler } from "../http/handler";
import { recordSecurityEvent } from "../logs/security";
import { listActivity, listSecurityLog } from "../modules/history/service";
import {
  acceptInvitation,
  createInvitation,
  createInvitationSchema,
  invitationTokenSchema,
  listInvitations,
  lookupInvitation,
  rejectInvitation,
  resendInvitation,
  revokeInvitation,
} from "../modules/invitations/service";
import { leaveOrganization, listMembers, removeMember, updateMember, updateMemberSchema } from "../modules/members/service";
import {
  createOrganization,
  createOrganizationSchema,
  deleteOrganization,
  deleteOrganizationSchema,
  getOrganization,
  listOrganizations,
  updateOrganization,
  updateOrganizationSchema,
} from "../modules/organizations/service";
import { getUsageOverview } from "../modules/usage/service";
import { requireOrganization } from "../tenancy/guard";
import { pageQuery } from "../validation";

export const me = apiHandler({ name: "auth.me" }, async (context) => ({
  data: { user: context.user, organizations: await listOrganizations(context) },
}));

/** Signs out every other device with one statement, however many there are. */
export const revokeOtherSessions = apiHandler({ name: "auth.revoke_other_sessions" }, async (context) => {
  const result = await prepare(context.d1, raw(`delete from user_sessions where user_id = ? and id <> ?`, context.user.id, context.sessionId)).run();
  await recordSecurityEvent(context.d1, {
    event: "auth.other_sessions_revoked",
    outcome: "success",
    userId: context.user.id,
    ipAddress: context.ip,
    userAgent: context.userAgent,
    metadata: { revoked: result.meta.changes },
    requestId: context.requestId,
    at: context.now,
  });
  return { data: { revoked: result.meta.changes } };
});

export const organizationsList = apiHandler({ name: "organizations.list" }, async (context) => ({ data: await listOrganizations(context) }));

export const organizationsCreate = apiHandler({ name: "organizations.create", idempotent: true }, async (context) => ({
  status: 201,
  data: await createOrganization(context, context.body(createOrganizationSchema)),
}));

export const organizationGet = apiHandler({ name: "organizations.get" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "organization.read");
  return { data: await getOrganization(context, scope) };
});

export const organizationUpdate = apiHandler({ name: "organizations.update" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "organization.update");
  return { data: await updateOrganization(context, scope, context.body(updateOrganizationSchema)) };
});

export const organizationDelete = apiHandler({ name: "organizations.delete" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "organization.delete");
  return { data: await deleteOrganization(context, scope, context.body(deleteOrganizationSchema)) };
});

export const organizationLeave = apiHandler({ name: "organizations.leave" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "organization.read");
  return { data: await leaveOrganization(context, scope) };
});

export const membersList = apiHandler({ name: "members.list" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.read");
  return { data: await listMembers(context, scope) };
});

export const memberUpdate = apiHandler({ name: "members.update" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { data: await updateMember(context, scope, context.params.memberId, context.body(updateMemberSchema)) };
});

export const memberRemove = apiHandler({ name: "members.remove" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { data: await removeMember(context, scope, context.params.memberId) };
});

export const invitationsList = apiHandler({ name: "invitations.list" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { data: await listInvitations(context, scope) };
});

export const invitationsCreate = apiHandler({ name: "invitations.create", idempotent: true }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { status: 201, data: await createInvitation(context, scope, context.body(createInvitationSchema)) };
});

export const invitationResend = apiHandler({ name: "invitations.resend" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { data: await resendInvitation(context, scope, context.params.invitationId) };
});

export const invitationRevoke = apiHandler({ name: "invitations.revoke" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "member.manage");
  return { data: await revokeInvitation(context, scope, context.params.invitationId) };
});

// The invited person is not a member yet: the token plus their verified email is the authorization.
export const invitationLookup = apiHandler({ name: "invitations.lookup" }, async (context) => ({
  data: await lookupInvitation(context, context.body(invitationTokenSchema)),
}));

export const invitationAccept = apiHandler({ name: "invitations.accept" }, async (context) => ({
  data: await acceptInvitation(context, context.body(invitationTokenSchema)),
}));

export const invitationReject = apiHandler({ name: "invitations.reject" }, async (context) => ({
  data: await rejectInvitation(context, context.body(invitationTokenSchema)),
}));

export const organizationActivity = apiHandler({ name: "organizations.activity" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "activity.read");
  return { data: await listActivity(context, scope, context.query(pageQuery)) };
});

export const organizationSecurityLog = apiHandler({ name: "organizations.security_log" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "security_log.read");
  return { data: await listSecurityLog(context, scope, context.query(pageQuery)) };
});

export const organizationUsage = apiHandler({ name: "organizations.usage" }, async (context) => {
  const scope = await requireOrganization(context, context.params.organizationId, "usage.read");
  return { data: await getUsageOverview(context, scope) };
});
