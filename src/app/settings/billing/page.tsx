import type { Metadata } from "next";

import { DemoBadge } from "@/components/ui/demo";
import { BillingView } from "@/features/settings/billing-view";
import { PageHeader } from "@/components/shell/page-header";
import { getOrganization, listStores } from "@/services/core";
import { getBillingBase, listPromptCountRows } from "@/services/settings";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const [base, stores, promptRows, org] = await Promise.all([getBillingBase(), listStores(), listPromptCountRows(), getOrganization()]);
  return (
    <>
      <PageHeader
        title="Billing"
        meta={
          <>
            <DemoBadge>Demo</DemoBadge>
            <DemoBadge>No real payments</DemoBadge>
          </>
        }
      />
      <BillingView base={base} stores={stores} promptRows={promptRows} organization={org.name} />
    </>
  );
}
