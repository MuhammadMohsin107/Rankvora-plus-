import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ScheduleForm } from "@/features/monitoring/schedule-form";
import { getSchedule, getScheduleFormContext, scheduleParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Edit schedule" };

export async function generateStaticParams() {
  return scheduleParams();
}

async function EditSchedulePageContent(props: PageProps<"/stores/[storeId]/monitoring/schedules/[scheduleId]/edit">) {
  const { storeId, scheduleId } = await props.params;
  const detail = await getSchedule(storeId, scheduleId);
  if (!detail) notFound();
  const base = `/stores/${storeId}/monitoring`;
  const { row } = detail;
  const header = (
    <PageHeader
      title={`Edit ${row.name}`}
      breadcrumb={[{ label: "Monitoring", href: base }, { label: "Schedules", href: `${base}/schedules` }, { label: row.name, href: `${base}/schedules/${row.id}` }, { label: "Edit" }]}
    />
  );
  const ctx = await getScheduleFormContext(storeId);
  if (!ctx || !row.editable || row.status === "cancelled") {
    return (
      <>
        {header}
        <EmptyState icon="lock" title="This schedule cannot be edited" description={row.status === "cancelled" ? "Cancelled schedules are read-only." : "The prompt library for this store is not available in the demo."} action={<ButtonLink href={`${base}/schedules/${row.id}`}>Back to schedule</ButtonLink>} />
      </>
    );
  }
  return (
    <>
      {header}
      <ScheduleForm ctx={ctx} mode="edit" scheduleId={row.id} initial={{ name: row.name, config: row.config, version: row.currentVersion }} />
    </>
  );
}

export default function EditSchedulePage(props: PageProps<"/stores/[storeId]/monitoring/schedules/[scheduleId]/edit">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EditSchedulePageContent {...props} />
    </Suspense>
  );
}
