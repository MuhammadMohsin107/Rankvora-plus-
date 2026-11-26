import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { RunsTable } from "@/features/monitoring/runs-table";
import { storeIds } from "@/services/core";

export const metadata: Metadata = { title: "History" };

export async function generateStaticParams() {
  return storeIds();
}

export default function RunsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RunsTable />
    </Suspense>
  );
}
