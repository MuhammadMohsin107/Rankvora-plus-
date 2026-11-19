import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { FindingsInbox } from "@/features/fixes/findings-inbox";
import { FixesEmpty } from "@/features/fixes/fixes-empty";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { getStore, storeIds } from "@/services/core";
import { getFixesSetup, listFindingRows, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Fixes" };

export async function generateStaticParams() {
  return storeIds();
}

async function FixesInboxPageContent(props: PageProps<"/stores/[storeId]/fixes">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [rows, tasks, setup] = await Promise.all([listFindingRows(storeId), listTaskSummaries(storeId), getFixesSetup(storeId)]);
  const tabs = <FixesTabs storeId={storeId} findings={rows.length} tasks={tasks.length} />;

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Fixes" tabs={tabs} />
        <FixesEmpty storeId={storeId} storeName={store.name} kind="findings" hasAiPlatform={setup.hasAiPlatform} hasFindings={false} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Fixes" tabs={tabs} />
      <FindingsInbox storeId={storeId} rows={rows} />
    </>
  );
}

export default function FixesInboxPage(props: PageProps<"/stores/[storeId]/fixes">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FixesInboxPageContent {...props} />
    </Suspense>
  );
}
