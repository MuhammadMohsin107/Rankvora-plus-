import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NoSchedules } from "@/features/monitoring/no-schedules";
import { UsageView } from "@/features/monitoring/usage-view";
import { getStore, storeIds } from "@/services/core";
import { getUsage, listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "Usage" };

export async function generateStaticParams() {
  return storeIds();
}

async function UsagePageContent(props: PageProps<"/stores/[storeId]/monitoring/usage">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [schedules, usage] = await Promise.all([listSchedules(storeId), getUsage(storeId)]);
  if (schedules.length === 0 || !usage) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;
  return <UsageView usage={usage} />;
}

export default function UsagePage(props: PageProps<"/stores/[storeId]/monitoring/usage">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <UsagePageContent {...props} />
    </Suspense>
  );
}
