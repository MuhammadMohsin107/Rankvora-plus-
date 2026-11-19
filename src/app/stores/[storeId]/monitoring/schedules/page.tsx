import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NoSchedules } from "@/features/monitoring/no-schedules";
import { SchedulesTable } from "@/features/monitoring/schedules-table";
import { getStore, storeIds } from "@/services/core";
import { listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "Schedules" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function SchedulesPage(props: PageProps<"/stores/[storeId]/monitoring/schedules">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const rows = await listSchedules(storeId);
  const canSchedule = store.channelIds.length > 0;
  if (rows.length === 0) return <NoSchedules storeId={storeId} canSchedule={canSchedule} />;
  return <SchedulesTable storeId={storeId} rows={rows} canSchedule={canSchedule} storeTimezone={store.timezone} />;
}
