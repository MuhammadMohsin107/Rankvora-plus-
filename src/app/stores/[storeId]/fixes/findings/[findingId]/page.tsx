import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FindingDetail } from "@/features/fixes/finding-detail";
import { getStore, storeIds } from "@/services/core";
import { findingStaticParams, getActor, getFindingDetail, listAssignees } from "@/services/fixes";

export const metadata: Metadata = { title: "Finding" };

export async function generateStaticParams() {
  return findingStaticParams(storeIds().map((s) => s.storeId));
}

async function FindingPageContent(props: PageProps<"/stores/[storeId]/fixes/findings/[findingId]">) {
  const { storeId, findingId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const data = await getFindingDetail(storeId, findingId);
  if (!data) notFound();

  const [actor, assignees] = await Promise.all([getActor(), listAssignees()]);
  return <FindingDetail storeId={storeId} data={data} role={actor.role} assignees={assignees} />;
}

export default function FindingPage(props: PageProps<"/stores/[storeId]/fixes/findings/[findingId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FindingPageContent {...props} />
    </Suspense>
  );
}
