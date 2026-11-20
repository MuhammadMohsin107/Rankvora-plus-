import type { Metadata } from "next";

import { NotificationsForm } from "@/features/settings/notifications-form";
import { SettingsHeader } from "@/features/settings/settings-header";
import { getOrganization, listStores } from "@/services/core";
import { getOrgNotificationPrefs, listNotificationOverrides, listNotificationEvents } from "@/services/settings";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const [events, prefs, org, websites, overrides] = await Promise.all([listNotificationEvents(), getOrgNotificationPrefs(), getOrganization(), listStores(), listNotificationOverrides()]);
  return (
    <>
      <SettingsHeader title="Notifications" />
      <NotificationsForm events={events} initial={prefs} orgTimezone={org.timezone} websites={websites} overrides={overrides} />
    </>
  );
}
