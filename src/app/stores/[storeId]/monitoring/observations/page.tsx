import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { EmptyState } from "@/components/ui/feedback";
import { HistorySwitch } from "@/features/monitoring/monitoring-header";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { ObservationsTable } from "@/features/monitoring/observations-table";
import { getStore, storeIds } from "@/services/core";
import { listObservations, listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "History by prompt" };

export async function generateStaticParams() {
  return storeIds();
}

async function ObservationsPageContent(props: PageProps<"/stores/[storeId]/monitoring/observations">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [schedules, rows] = await Promise.all([listSchedules(storeId), listObservations(storeId)]);
  if (schedules.length === 0) return <NoSchedules />;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <HistorySwitch current="prompts" />
        <EmptyState icon="monitoring" title="No prompt history yet" description="It appears once a run stores answers per prompt and provider." />
      </div>
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
