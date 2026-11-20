import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { PageHeader } from "@/components/shell/page-header";
import { NoHistory } from "@/features/comparison/no-history";
import { NewComparisonWizard } from "@/features/comparison/wizard";
import { getWizardData, listComparisons, wizardCatalog } from "@/services/comparison";
import { getCurrentUser, getStore, listPromptGroups, listPromptsBase, storeIds } from "@/services/core";

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

  if (data.snapshots.length < 2) {
    return (
      <>
        <PageHeader title="New comparison" />
        <NoHistory storeId={storeId} kind="snapshots" hasChannel={store.channelIds.length > 0} />
      </>
    );
  }

  const [prompts, groups, records, user] = await Promise.all([listPromptsBase(storeId), listPromptGroups(storeId), listComparisons(storeId), getCurrentUser()]);

  return (
    <>
      <PageHeader title="New comparison" />
      <NewComparisonWizard storeId={storeId} data={data} catalog={wizardCatalog(storeId)} prompts={prompts} groups={groups} records={records} createdBy={user.name} />
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
