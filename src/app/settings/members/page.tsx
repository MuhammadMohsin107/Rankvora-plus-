import type { Metadata } from "next";

import { MembersView } from "@/features/settings/members-view";
import { getCurrentUser, listMembers } from "@/services/core";
import { getRolePermissions, listPendingInvites, listPermissions } from "@/services/settings";

export const metadata: Metadata = { title: "Members and roles" };

export default async function MembersPage() {
  const [members, invites, me, permissions, rolePermissions] = await Promise.all([listMembers(), listPendingInvites(), getCurrentUser(), listPermissions(), getRolePermissions()]);
  return <MembersView members={members} invites={invites} currentUserId={me.id} permissions={permissions} rolePermissions={rolePermissions} />;
}
