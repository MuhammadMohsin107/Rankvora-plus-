import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { DemoBadge } from "@/components/ui/demo";
import { ProvidersView } from "@/features/settings/providers-view";
import { listProviderConnections } from "@/services/settings";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const providers = await listProviderConnections();
  return (
    <>
      <PageHeader title="Integrations" meta={<DemoBadge />} />
      <ProvidersView providers={providers} />
    </>
  );
}
