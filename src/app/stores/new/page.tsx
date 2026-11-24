import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { AddWebsiteWizard } from "@/features/stores/wizard/add-website-wizard";
import { listChannels, listStores } from "@/services/core";
import { getBillingBase, getStoreSetupSample } from "@/services/settings";

export const metadata: Metadata = { title: "Add website" };

export default async function NewWebsitePage() {
  const [channels, sample, stores, billing] = await Promise.all([listChannels(), getStoreSetupSample(), listStores(), getBillingBase()]);
  const existing = stores.map((w) => ({ name: w.name, domain: w.domain }));
  const plans = billing.plans.map((p) => ({ id: p.id, name: p.name, websites: p.limits.websites }));
  const seededActive = stores.filter((w) => w.status !== "archived").length;
  return (
    <>
      <PageHeader title="Add website" />
      <AddWebsiteWizard channels={channels} sample={sample} existing={existing} plans={plans} billingState={billing.state} seededActive={seededActive} />
    </>
  );
}
