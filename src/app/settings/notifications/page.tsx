import type { Metadata } from "next";

import { NotificationsForm } from "@/features/settings/notifications-form";
import { getOrganization } from "@/services/core";
import { getOrgNotificationPrefs, listNotificationEvents } from "@/services/settings";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationsPage() {
  const [events, prefs, org] = await Promise.all([listNotificationEvents(), getOrgNotificationPrefs(), getOrganization()]);
  return <NotificationsForm events={events} initial={prefs} orgTimezone={org.timezone} />;
}
