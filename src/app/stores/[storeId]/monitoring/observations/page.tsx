import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/feedback";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { ObservationsTable } from "@/features/monitoring/observations-table";
import { getStore, storeIds } from "@/services/core";
import { listObservations, listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "Observations" };

export async function generateStaticParams() {
  return storeIds();
}

async function ObservationsPageContent(props: PageProps<"/stores/[storeId]/monitoring/observations">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [schedules, rows] = await Promise.all([listSchedules(storeId), listObservations(storeId)]);
  if (schedules.length === 0) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="monitoring"
        title="No prompt-level observations yet"
        description="They appear once a run stores answers per prompt and provider."
      />
    );
  }
  return <ObservationsTable rows={rows} />;
}

export default function ObservationsPage(props: PageProps<"/stores/[storeId]/monitoring/observations">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ObservationsPageContent {...props} />
    </Suspense>
  );
}
