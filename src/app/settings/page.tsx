import type { Metadata } from "next";

import { GeneralForm } from "@/features/settings/general-form";
import { getOrganization } from "@/services/core";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettingsPage() {
  const org = await getOrganization();
  return <GeneralForm initial={{ name: org.name, timezone: org.timezone }} />;
}
