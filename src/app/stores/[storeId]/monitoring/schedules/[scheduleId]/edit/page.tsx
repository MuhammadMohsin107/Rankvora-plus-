import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { EditScheduleHeader } from "@/features/monitoring/schedule-detail";
import { ScheduleForm } from "@/features/monitoring/schedule-form";
import { scheduleParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Edit schedule" };

export async function generateStaticParams() {
  return scheduleParams();
}

/** Schedules created in the browser are not known to the server, so the form resolves the id from the shared client state. */
export default async function EditSchedulePage(props: PageProps<"/stores/[storeId]/monitoring/schedules/[scheduleId]/edit">) {
  const { scheduleId } = await props.params;
  return (
    <Suspense fallback={<PageFallback />}>
      <EditScheduleHeader scheduleId={scheduleId} />
      <ScheduleForm mode="edit" scheduleId={scheduleId} />
    </Suspense>
  );
}
