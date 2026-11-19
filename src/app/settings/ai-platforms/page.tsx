import type { Metadata } from "next";

import { ProvidersView } from "@/features/settings/providers-view";
import { listProviderConnections } from "@/services/settings";

export const metadata: Metadata = { title: "AI platforms" };

export default async function AiPlatformsPage() {
  const providers = await listProviderConnections();
  return <ProvidersView providers={providers} />;
}
