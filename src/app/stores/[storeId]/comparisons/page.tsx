import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { ComparisonsTable } from "@/features/comparison/comparisons-table";
import { aggregateCsv } from "@/features/comparison/export";
import { NoHistory } from "@/features/comparison/no-history";
import { getComparisonDetail, listComparisons, listSnapshots } from "@/services/comparison";
import { getStore, storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Comparisons" };

export async function generateStaticParams() {
  return storeIds();
}

async function ComparisonsPageContent(props: PageProps<"/stores/[storeId]/comparisons">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [records, snapshots] = await Promise.all([listComparisons(storeId), listSnapshots(storeId)]);
  const base = `/stores/${storeId}/comparisons`;

  if (records.length === 0 && snapshots.length < 2) {
    return (
      <>
        <PageHeader title="Comparisons" />
        <NoHistory storeId={storeId} kind="comparisons" hasChannel={store.channelIds.length > 0} />
      </>
    );
  }

  const csvById: Record<string, string> = {};
  for (const record of records) {
    const detail = await getComparisonDetail(storeId, record.id);
    if (detail && detail.result.verdict !== "not_comparable") csvById[record.id] = aggregateCsv(detail.result);
  }

  return (
    <>
      <HeaderAction>
        <ButtonLink href={`${base}/new`} variant="primary" icon="plus">New comparison</ButtonLink>
      </HeaderAction>
      <PageHeader title="Comparisons" />
      <ComparisonsTable storeId={storeId} records={records} snapshots={snapshots} csvById={csvById} />
    </>
  );
}

export default function ComparisonsPage(props: PageProps<"/stores/[storeId]/comparisons">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ComparisonsPageContent {...props} />
    </Suspense>
  );
}
