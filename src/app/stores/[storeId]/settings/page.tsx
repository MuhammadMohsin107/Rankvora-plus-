import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreSettings, type StoreSettingsData } from "@/features/stores/settings/store-settings";
import { getStore, listChannels, listPromptsBase, listProducts, storeIds } from "@/services/core";
import {
  getDomainRecord,
  getIntegrationDetail,
  getOrgNotificationPrefs,
  getStoreNotificationOverride,
  listBrandVersions,
  listNotificationEvents,
  listStoreActivity,
  listStoreCompetitors,
} from "@/services/settings";

export const metadata: Metadata = { title: "Store settings" };

export async function generateStaticParams() {
  return storeIds();
}

async function StoreSettingsPageContent(props: PageProps<"/stores/[storeId]/settings">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [channels, competitors, products, prompts, brandVersions, domainRecord, integrationDetail, activity, events, orgPrefs, override] = await Promise.all([
    listChannels(),
    listStoreCompetitors(storeId),
    listProducts(storeId),
    listPromptsBase(storeId),
    listBrandVersions(storeId),
    getDomainRecord(storeId),
    getIntegrationDetail(storeId),
    listStoreActivity(storeId),
    listNotificationEvents(),
    getOrgNotificationPrefs(),
    getStoreNotificationOverride(storeId),
  ]);

  const data: StoreSettingsData = {
    store,
    channels,
    competitors,
    products,
    brandVersions,
    domains: domainRecord ?? { storeId, canonical: store.domain, aliases: [], former: [] },
    integrations: integrationDetail ?? {
      storeId,
      commerce: { platform: store.platform, state: store.integrations.commerce, account: null, scopes: [], lastVerifiedAt: null, note: null },
      searchConsole: { state: store.integrations.searchConsole, property: null, lastVerifiedAt: null, note: null },
    },
    activity,
    events,
    orgMatrix: orgPrefs.matrix,
    orgWebhookReady: orgPrefs.webhookUrl.trim() !== "",
    notifications: { mode: override.mode, matrix: override.matrix },
    promptCount: prompts.filter((p) => p.status === "active").length,
  };

  return <StoreSettings data={data} />;
}

export default function StoreSettingsPage(props: PageProps<"/stores/[storeId]/settings">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <StoreSettingsPageContent {...props} />
    </Suspense>
  );
}
