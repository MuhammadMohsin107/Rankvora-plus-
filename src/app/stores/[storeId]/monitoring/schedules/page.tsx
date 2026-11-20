import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { SchedulesTable } from "@/features/monitoring/schedules-table";
import { storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Schedules" };

export async function generateStaticParams() {
  return storeIds();
}

export default function SchedulesPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <SchedulesTable />
    </Suspense>
  );
}
