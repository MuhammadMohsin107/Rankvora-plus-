import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlertsInbox } from "@/features/monitoring/alerts-inbox";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { getStore, storeIds } from "@/services/core";
import { listEvents, listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "Alerts" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function AlertsPage(props: PageProps<"/stores/[storeId]/monitoring/alerts">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [schedules, events] = await Promise.all([listSchedules(storeId), listEvents(storeId)]);
  if (schedules.length === 0) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;
  return <AlertsInbox events={events} storeTimezone={store.timezone} />;
}
