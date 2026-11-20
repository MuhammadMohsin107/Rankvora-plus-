import type { Metadata } from "next";

import { DemoBadge } from "@/components/ui/demo";
import { BillingView } from "@/features/settings/billing-view";
import { SettingsHeader } from "@/features/settings/settings-header";
import { getOrganization, listStores } from "@/services/core";
import { getBillingBase, listPromptCountRows, listTeam } from "@/services/settings";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const [base, stores, team, promptRows, org] = await Promise.all([getBillingBase(), listStores(), listTeam(), listPromptCountRows(), getOrganization()]);
  return (
    <>
      <SettingsHeader
        title="Billing"
        meta={
          <>
            <DemoBadge>Demo</DemoBadge>
            <DemoBadge>No real payments</DemoBadge>
          </>
        }
      />
      <BillingView base={base} stores={stores} team={team} promptRows={promptRows} organization={org.name} />
    </>
  );
}
