import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { FindingsInbox } from "@/features/fixes/findings-inbox";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { getStore, storeIds } from "@/services/core";
import { getFixesCounts, listFindingRows } from "@/services/fixes";

export const metadata: Metadata = { title: "Fixes" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function FixesInboxPage(props: PageProps<"/stores/[storeId]/fixes">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [rows, counts] = await Promise.all([listFindingRows(storeId), getFixesCounts(storeId)]);
  const base = `/stores/${storeId}`;
  const tabs = <FixesTabs storeId={storeId} findings={rows.length} tasks={counts.openTasks} />;

  if (rows.length === 0) {
    const ready = store.summary !== null;
    return (
      <>
        <PageHeader title="Fixes" subtitle="Findings and tasks" tabs={tabs} />
        <EmptyState
          icon="fixes"
          title="No findings yet"
          description={ready ? "Run an audit to find what to fix." : "Finish setup, then run an audit."}
          action={
            ready ? (
              <ButtonLink href={`${base}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>
            ) : (
              <ButtonLink href={`${base}/settings`} variant="primary">Continue setup</ButtonLink>
            )
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Fixes"
        subtitle="Findings and tasks"
        tabs={tabs}
        actions={<ButtonLink href={`${base}/fixes/tasks`} variant="secondary" icon="columns">Task board</ButtonLink>}
      />

      <div className="flex flex-col gap-5">
        <MetricGrid>
          <MetricCell>
            <Metric label="Open findings" value={String(counts.openFindings)} basis="not closed" />
          </MetricCell>
          <MetricCell>
            <Metric label="Without a task" value={String(counts.withoutTask)} basis="open findings" />
          </MetricCell>
          <MetricCell>
            <Metric label="Open tasks" value={String(counts.openTasks)} basis="not done" />
          </MetricCell>
          <MetricCell>
            <Metric label="Awaiting verification" value={String(counts.awaitingVerification)} basis="applied, not verified" />
          </MetricCell>
        </MetricGrid>

        <FindingsInbox storeId={storeId} rows={rows} />
      </div>
    </>
  );
}
