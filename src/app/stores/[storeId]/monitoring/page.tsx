import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { OverviewView } from "@/features/monitoring/overview-view";
import { getStore, storeIds } from "@/services/core";
import { getMonitoringOverview } from "@/services/monitoring";

export const metadata: Metadata = { title: "Monitoring" };

export async function generateStaticParams() {
  return storeIds();
}

async function MonitoringOverviewPageContent(props: PageProps<"/stores/[storeId]/monitoring">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const data = await getMonitoringOverview(storeId);
  if (!data) notFound();
  return <OverviewView data={data} />;
}

export default function MonitoringOverviewPage(props: PageProps<"/stores/[storeId]/monitoring">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <MonitoringOverviewPageContent {...props} />
    </Suspense>
  );
}
