import { Suspense } from "react";

import type { Metadata } from "next";

import { PageFallback } from "@/components/shell/page-fallback";
import { RunDetailView } from "@/features/monitoring/run-detail-view";
import { getRunDetail, runParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Run" };

export async function generateStaticParams() {
  return runParams();
}

/** Seeded runs load their job detail here. A run created in the browser has no server record: the view resolves it from the client state. */
async function RunDetailPageContent(props: PageProps<"/stores/[storeId]/monitoring/runs/[runId]">) {
  const { storeId, runId } = await props.params;
  const detail = await getRunDetail(storeId, runId);
  return <RunDetailView runId={runId} detail={detail} />;
}

export default function RunDetailPage(props: PageProps<"/stores/[storeId]/monitoring/runs/[runId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <RunDetailPageContent {...props} />
    </Suspense>
  );
}
