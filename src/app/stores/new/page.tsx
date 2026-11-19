import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { AddStoreWizard } from "@/features/stores/wizard/add-store-wizard";
import { listChannels } from "@/services/core";
import { getStoreSetupSample } from "@/services/settings";

export const metadata: Metadata = { title: "Add store" };

export default async function NewStorePage() {
  const [channels, sample] = await Promise.all([listChannels(), getStoreSetupSample()]);
  return (
    <>
      <PageHeader title="Add store" subtitle="Six short steps. Nothing is tracked until you activate." breadcrumb={[{ label: "Stores", href: "/stores" }, { label: "Add store" }]} />
      <AddStoreWizard channels={channels} sample={sample} />
    </>
  );
}
