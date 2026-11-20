import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { FixesHistory } from "@/features/fixes/fixes-history";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { getStore, storeIds } from "@/services/core";
import { getActor, listFindingRows, listSeededHistory, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Fixes history" };

export async function generateStaticParams() {
  return storeIds();
}

async function FixesHistoryPageContent(props: PageProps<"/stores/[storeId]/fixes/history">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [seeded, findings, tasks, actor] = await Promise.all([listSeededHistory(storeId), listFindingRows(storeId), listTaskSummaries(storeId), getActor()]);
  const items = seeded.map((s) => ({ id: s.id, at: s.at, kind: s.kind, title: s.title, detail: s.detail, actor: s.actor, taskId: s.taskId, findingId: s.findingId }));

  return (
    <>
      <PageHeader title="Fixes" tabs={<FixesTabs storeId={storeId} findings={findings.length} tasks={tasks} />} />
      <FixesHistory storeId={storeId} seeded={items} actorName={actor.name} />
    </>
  );
}

export default function FixesHistoryPage(props: PageProps<"/stores/[storeId]/fixes/history">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FixesHistoryPageContent {...props} />
    </Suspense>
  );
}
