import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WebsiteSettings, type WebsiteSettingsData } from "@/features/stores/settings/website-settings";
import { isLocalWebsiteId } from "@/features/stores/website-model";
import { getStore, listChannels, listPromptsBase, listProducts, storeIds } from "@/services/core";
import {
  getBrandKnowledgeBase,
  getDomainRecord,
  getIntegrationDetail,
  getOrgNotificationPrefs,
  getStoreNotificationOverride,
  listBrandVersions,
  listNotificationEvents,
  listStoreActivity,
  listStoreCompetitors,
} from "@/services/settings";

export const metadata: Metadata = { title: "Website settings" };

export async function generateStaticParams() {
  return storeIds();
}

async function WebsiteSettingsPageContent(props: PageProps<"/stores/[storeId]/settings">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  // Websites created in this browser are drawn by the layout's client gate.
  if (!store) return isLocalWebsiteId(storeId) ? null : notFound();

  const [channels, competitors, products, prompts, brandVersions, knowledge, domainRecord, integrationDetail, activity, events, orgPrefs, override] = await Promise.all([
    listChannels(),
    listStoreCompetitors(storeId),
    listProducts(storeId),
    listPromptsBase(storeId),
    listBrandVersions(storeId),
    getBrandKnowledgeBase(storeId),
    getDomainRecord(storeId),
    getIntegrationDetail(storeId),
    listStoreActivity(storeId),
    listNotificationEvents(),
    getOrgNotificationPrefs(),
    getStoreNotificationOverride(storeId),
  ]);

  const data: WebsiteSettingsData = {
    store,
    seeded: true,
    channels,
    competitors,
    products,
    prompts,
    brandVersions,
    knowledge,
    domains: domainRecord ?? { storeId, canonical: store.domain, aliases: [], former: [] },
    integrations: integrationDetail ?? {
      storeId,
      commerce: { platform: store.platform, state: store.integrations.commerce, account: null, scopes: [], lastVerifiedAt: null, note: null },
      searchConsole: { state: store.integrations.searchConsole, property: null, lastVerifiedAt: null, note: null },
    },
    activity,
    events,
    orgPrefs,
    notifications: override,
  };

  return <WebsiteSettings data={data} />;
}

export default function WebsiteSettingsPage(props: PageProps<"/stores/[storeId]/settings">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WebsiteSettingsPageContent {...props} />
    </Suspense>
  );
}
