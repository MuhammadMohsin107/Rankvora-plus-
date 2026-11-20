import type { Metadata } from "next";

import { GeneralForm } from "@/features/settings/general-form";
import { SettingsHeader } from "@/features/settings/settings-header";
import { getOrgGeneral } from "@/services/settings";

export const metadata: Metadata = { title: "Organization settings" };

export default async function GeneralSettingsPage() {
  const initial = await getOrgGeneral();
  return (
    <>
      <SettingsHeader title="Organization settings" />
      <GeneralForm initial={initial} />
    </>
  );
}
