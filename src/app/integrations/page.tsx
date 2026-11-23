import type { Metadata } from "next";

import { PageHeader } from "@/components/shell/page-header";
import { DemoBadge } from "@/components/ui/demo";
import { IntegrationsHub } from "@/features/settings/integrations-hub";
import { listStores } from "@/services/core";
import { listProviderConnections } from "@/services/settings";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const [providers, websites] = await Promise.all([listProviderConnections(), listStores()]);
  return (
    <>
      <PageHeader title="Integrations" meta={<DemoBadge />} />
      <IntegrationsHub providers={providers} websites={websites} />
    </>
  );
}
