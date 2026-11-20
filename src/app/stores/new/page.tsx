import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { AddWebsiteWizard } from "@/features/stores/wizard/add-website-wizard";
import { listChannels, listStores } from "@/services/core";
import { getStoreSetupSample } from "@/services/settings";

export const metadata: Metadata = { title: "Add website" };

export default async function NewWebsitePage() {
  const [channels, sample, stores] = await Promise.all([listChannels(), getStoreSetupSample(), listStores()]);
  const existing = stores.map((w) => ({ name: w.name, domain: w.domain }));
  return (
    <>
      <PageHeader title="Add website" />
      <AddWebsiteWizard channels={channels} sample={sample} existing={existing} />
    </>
  );
}
