import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { NoSchedules } from "@/features/monitoring/no-schedules";
import { ScheduleForm } from "@/features/monitoring/schedule-form";
import { getStore, storeIds } from "@/services/core";
import { getScheduleFormContext } from "@/services/monitoring";

export const metadata: Metadata = { title: "New schedule" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function NewSchedulePage(props: PageProps<"/stores/[storeId]/monitoring/schedules/new">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const base = `/stores/${storeId}/monitoring`;
  const header = (
    <PageHeader title="New schedule" subtitle="Prompts, providers, timetable and alert rules" breadcrumb={[{ label: "Monitoring", href: base }, { label: "Schedules", href: `${base}/schedules` }, { label: "New" }]} />
  );
  if (store.channelIds.length === 0) {
    return (
      <>
        {header}
        <NoSchedules storeId={storeId} canSchedule={false} />
      </>
    );
  }
  const ctx = await getScheduleFormContext(storeId);
  if (!ctx) notFound();
  return (
    <>
      {header}
      <ScheduleForm ctx={ctx} mode="create" />
    </>
  );
}
