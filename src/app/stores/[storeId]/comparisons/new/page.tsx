import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { NoHistory } from "@/features/comparison/no-history";
import { NewComparisonWizard } from "@/features/comparison/wizard";
import { getWizardData, wizardCatalog } from "@/services/comparison";
import { getStore, storeIds } from "@/services/core";

export const metadata: Metadata = { title: "New comparison" };

export async function generateStaticParams() {
  return storeIds();
}

async function NewComparisonPageContent(props: PageProps<"/stores/[storeId]/comparisons/new">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const data = await getWizardData(storeId);
  if (!data) notFound();

  const header = (
    <PageHeader title="New comparison" />
  );

  if (data.snapshots.length < 2) {
    return (
      <>
        {header}
        <NoHistory storeId={storeId} kind="snapshots" hasChannel={store.channelIds.length > 0} />
      </>
    );
  }

  return (
    <>
      {header}
      <NewComparisonWizard storeId={storeId} data={data} catalog={wizardCatalog(storeId)} />
    </>
  );
}

export default function NewComparisonPage(props: PageProps<"/stores/[storeId]/comparisons/new">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <NewComparisonPageContent {...props} />
    </Suspense>
  );
}
