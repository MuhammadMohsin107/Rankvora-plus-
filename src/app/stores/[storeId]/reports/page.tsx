import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ReportsView } from "@/features/reports/reports-view";
import { getStore, storeIds } from "@/services/core";
import { listHistorical, listReports } from "@/services/reports";

export const metadata: Metadata = { title: "Reports" };

export async function generateStaticParams() {
  return storeIds();
}

async function ReportsPageContent(props: PageProps<"/stores/[storeId]/reports">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [reports, history] = await Promise.all([listReports(storeId), listHistorical(storeId)]);

  if (reports.length === 0 && history.length === 0) {
    return (
      <>
        <PageHeader title="Reports" />
        <EmptyState
          icon="reports"
          title="No reports yet"
          description="Reports are created when an audit, a monitoring run or a comparison completes."
          action={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reports"
        actions={<ButtonLink href={`/stores/${storeId}/comparisons/new`} icon="compare">New comparison</ButtonLink>}
      />
      <ReportsView storeId={storeId} reports={reports} history={history} />
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
