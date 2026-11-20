import type { Metadata } from "next";

import { DemoBadge } from "@/components/ui/demo";
import { ProvidersView } from "@/features/settings/providers-view";
import { SettingsHeader } from "@/features/settings/settings-header";
import { listProviderConnections } from "@/services/settings";

export const metadata: Metadata = { title: "AI platforms" };

export default async function AiPlatformsPage() {
  const providers = await listProviderConnections();
  return (
    <>
      <SettingsHeader title="AI platforms" meta={<DemoBadge />} />
      <ProvidersView providers={providers} />
    </>
  );
}
