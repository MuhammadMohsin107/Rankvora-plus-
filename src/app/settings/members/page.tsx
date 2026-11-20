import type { Metadata } from "next";

import { MembersView } from "@/features/settings/members-view";
import { SettingsHeader } from "@/features/settings/settings-header";
import { getCurrentUser, listStores } from "@/services/core";
import { getPlanSnapshot, getRolePermissions, listPermissions, listTeam, listTeamActivity } from "@/services/settings";

export const metadata: Metadata = { title: "Team" };

export default async function MembersPage() {
  const [members, websites, me, permissions, rolePermissions, snapshot, activity] = await Promise.all([
    listTeam(),
    listStores(),
    getCurrentUser(),
    listPermissions(),
    getRolePermissions(),
    getPlanSnapshot(),
    listTeamActivity(),
  ]);
  return (
    <>
      <SettingsHeader title="Team" />
      <MembersView
        members={members}
        websites={websites}
        currentUserId={me.id}
        permissions={permissions}
        rolePermissions={rolePermissions}
        plans={snapshot.plans}
        billingState={snapshot.state}
        activity={activity}
      />
    </>
  );
}
