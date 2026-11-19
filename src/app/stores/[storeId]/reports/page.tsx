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

export default async function ReportsPage(props: PageProps<"/stores/[storeId]/reports">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();
  const [reports, history] = await Promise.all([listReports(storeId), listHistorical(storeId)]);

  if (reports.length === 0 && history.length === 0) {
    return (
      <>
        <PageHeader title="Reports" subtitle={store.name} />
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
        subtitle={`${store.name} · audit, monitoring and comparison history`}
        actions={<ButtonLink href={`/stores/${storeId}/comparisons/new`} icon="compare">New comparison</ButtonLink>}
      />
      <ReportsView storeId={storeId} reports={reports} history={history} />
    </>
  );
}
