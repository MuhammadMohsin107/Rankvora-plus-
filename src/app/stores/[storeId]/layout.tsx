import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import { LocalWebsiteGate } from "@/features/stores/local-website";
import { isLocalWebsiteId } from "@/features/stores/website-model";
import { getStore, listChannels, storeIds } from "@/services/core";
import { getOrgNotificationPrefs, listNotificationEvents } from "@/services/settings";
import { notFound } from "next/navigation";

// Cache Components: route params must be known at build time (or wrapped in Suspense).
export async function generateStaticParams() {
  return storeIds();
}

/**
 * Seeded websites render their pages. Ids made by the Add website wizard (`demo-websites-n`) exist only in this
 * browser: the server cannot know them (and `dynamicParams` is not available with Cache Components), so a client
 * gate looks the id up in demo-state and draws the dashboard and settings itself. Other ids are a real 404.
 */
async function StoreLayoutContent({ children, params }: LayoutProps<"/stores/[storeId]">) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (store) return children;
  if (!isLocalWebsiteId(storeId)) notFound();
  const [channels, events, orgPrefs] = await Promise.all([listChannels(), listNotificationEvents(), getOrgNotificationPrefs()]);
  return (
    <LocalWebsiteGate storeId={storeId} bundle={{ channels, events, orgPrefs }}>
      {children}
    </LocalWebsiteGate>
  );
}

export default function StoreLayout(props: LayoutProps<"/stores/[storeId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <StoreLayoutContent {...props} />
    </Suspense>
  );
}
