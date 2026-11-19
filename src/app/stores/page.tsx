import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { StoresView } from "@/features/stores/stores-view";
import { listStores } from "@/services/core";

export const metadata: Metadata = { title: "Stores" };

export default async function StoresPage() {
  const stores = await listStores();
  return (
    <>
      <PageHeader
        title="Stores"
        subtitle={`${stores.length} ${stores.length === 1 ? "store" : "stores"}`}
        actions={<ButtonLink href="/stores/new" variant="primary" icon="plus">Add store</ButtonLink>}
      />
      <StoresView stores={stores} />
    </>
  );
}
