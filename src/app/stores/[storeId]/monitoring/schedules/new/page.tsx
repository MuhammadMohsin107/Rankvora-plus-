import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { PageHeader } from "@/components/shell/page-header";
import { ScheduleForm } from "@/features/monitoring/schedule-form";
import { storeIds } from "@/services/core";

export const metadata: Metadata = { title: "New schedule" };

export async function generateStaticParams() {
  return storeIds();
}

export default function NewSchedulePage() {
  return (
    <>
      <PageHeader title="New schedule" />
      <Suspense fallback={<PageFallback />}>
        <ScheduleForm mode="create" />
      </Suspense>
    </>
  );
}
