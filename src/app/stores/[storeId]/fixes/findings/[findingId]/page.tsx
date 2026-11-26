import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FindingDetail } from "@/features/fixes/finding-detail";
import { LocalFindingView } from "@/features/fixes/local-finding-view";
import { getStore, storeIds } from "@/services/core";
import { findingStaticParams, getActor, getFindingDetail, listFindingRows, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Finding" };

export async function generateStaticParams() {
  return findingStaticParams(storeIds().map((s) => s.storeId));
}

async function FindingPageContent(props: PageProps<"/stores/[storeId]/fixes/findings/[findingId]">) {
  const { storeId, findingId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [data, rows, tasks, actor] = await Promise.all([getFindingDetail(storeId, findingId), listFindingRows(storeId), listTaskSummaries(storeId), getActor()]);

  // Findings created in this browser (for example by a simulated audit) are looked up in the local demo state.
  if (!data) return <LocalFindingView storeId={storeId} findingId={findingId} tasks={tasks} actorName={actor.name} />;

  const row = rows.find((r) => r.id === findingId);
  if (!row) notFound();
  return <FindingDetail storeId={storeId} data={data} row={row} tasks={tasks} role={actor.role} actorName={actor.name} />;
}

export default function FindingPage(props: PageProps<"/stores/[storeId]/fixes/findings/[findingId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FindingPageContent {...props} />
    </Suspense>
  );
}
