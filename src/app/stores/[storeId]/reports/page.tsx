import { Suspense } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageFallback } from "@/components/shell/page-fallback";
import { PageHeader } from "@/components/shell/page-header";
import { ReportsView } from "@/features/reports/reports-view";
import { getStore, storeIds } from "@/services/core";
import { listReportRows, listReportSources } from "@/services/reports";

export const metadata: Metadata = { title: "Reports" };

export async function generateStaticParams() {
  return storeIds();
}

async function ReportsPageContent(props: PageProps<"/stores/[storeId]/reports">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [reports, sources] = await Promise.all([listReportRows(storeId), listReportSources(storeId)]);
  return (
    <>
      <PageHeader title="Reports" />
      <ReportsView storeId={storeId} reports={reports} sources={sources} />
    </>
  );
}

export default function ReportsPage(props: PageProps<"/stores/[storeId]/reports">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ReportsPageContent {...props} />
    </Suspense>
  );
}
