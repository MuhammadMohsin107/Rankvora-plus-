import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NoSchedules } from "@/features/monitoring/no-schedules";
import { RunsTable } from "@/features/monitoring/runs-table";
import { getStore, storeIds } from "@/services/core";
import { listRuns, listSchedules } from "@/services/monitoring";

export const metadata: Metadata = { title: "Runs" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function RunsPage(props: PageProps<"/stores/[storeId]/monitoring/runs">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [schedules, runs] = await Promise.all([listSchedules(storeId), listRuns(storeId)]);
  if (schedules.length === 0) return <NoSchedules storeId={storeId} canSchedule={store.channelIds.length > 0} />;
  return <RunsTable storeId={storeId} runs={runs} storeTimezone={store.timezone} />;
}
