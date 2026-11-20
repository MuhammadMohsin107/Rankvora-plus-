import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { ScheduleDetail } from "@/features/monitoring/schedule-detail";
import { scheduleParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Schedule" };

export async function generateStaticParams() {
  return scheduleParams();
}

/** Schedules created in the browser are not known to the server, so the detail resolves the id from the shared client state. */
export default async function ScheduleDetailPage(props: PageProps<"/stores/[storeId]/monitoring/schedules/[scheduleId]">) {
  const { scheduleId } = await props.params;
  return (
    <Suspense fallback={<PageFallback />}>
      <ScheduleDetail scheduleId={scheduleId} />
    </Suspense>
  );
}
