import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { NoHistory } from "@/features/comparison/no-history";
import { ComparisonsTable, type ComparisonRow } from "@/features/comparison/comparisons-table";
import { parseWindow } from "@/features/comparison/sides";
import { formatShortDate } from "@/lib/format";
import { COMPARISON_TYPES, listComparisons } from "@/services/comparison";
import { getStore, storeIds } from "@/services/core";

export const metadata: Metadata = { title: "Comparisons" };

export async function generateStaticParams() {
  return storeIds();
}

function refOf(reference: string): ComparisonRow["baseline"] {
  const window = parseWindow(reference);
  return window ? { text: `${formatShortDate(window.from)} – ${formatShortDate(window.to)}`, isId: false } : { text: reference, isId: true };
}

async function ComparisonsPageContent(props: PageProps<"/stores/[storeId]/comparisons">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const comparisons = await listComparisons(storeId);
  const base = `/stores/${storeId}/comparisons`;

  if (comparisons.length === 0) {
    return (
      <>
        <PageHeader title="Comparisons" />
        <NoHistory storeId={storeId} kind="comparisons" hasChannel={store.channelIds.length > 0} />
      </>
    );
  }

  const rows: ComparisonRow[] = comparisons.map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type,
    typeLabel: COMPARISON_TYPES.find((t) => t.value === c.type)?.label ?? c.type,
    baseline: refOf(c.baseline),
    current: refOf(c.current),
    comparability: c.comparability,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    methodologyVersion: c.methodologyVersion,
    reportId: c.reportId,
  }));

  return (
    <>
      <PageHeader
        title="Comparisons"
        actions={<ButtonLink href={`${base}/new`} variant="primary" icon="plus">New comparison</ButtonLink>}
      />
      <ComparisonsTable storeId={storeId} rows={rows} />
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
