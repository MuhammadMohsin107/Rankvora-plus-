import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { AlertsInbox } from "@/features/monitoring/alerts-inbox";
import { getStore, storeIds } from "@/services/core";
import { listEvents } from "@/services/monitoring";

export const metadata: Metadata = { title: "Alerts" };

export async function generateStaticParams() {
  return storeIds();
}

async function AlertsPageContent(props: PageProps<"/stores/[storeId]/monitoring/alerts">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const events = await listEvents(storeId);
  return <AlertsInbox events={events} storeTimezone={store.timezone} />;
}

export default function AlertsPage(props: PageProps<"/stores/[storeId]/monitoring/alerts">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AlertsPageContent {...props} />
    </Suspense>
  );
}
