import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FindingsInbox } from "@/features/fixes/findings-inbox";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { getStore, storeIds } from "@/services/core";
import { listFindingRows, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Fixes" };

export async function generateStaticParams() {
  return storeIds();
}

async function FixesInboxPageContent(props: PageProps<"/stores/[storeId]/fixes">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [rows, tasks] = await Promise.all([listFindingRows(storeId), listTaskSummaries(storeId)]);
  const base = `/stores/${storeId}`;
  const tabs = <FixesTabs storeId={storeId} findings={rows.length} tasks={tasks.length} />;

  if (rows.length === 0) {
    const ready = store.summary !== null;
    return (
      <>
        <PageHeader title="Fixes" tabs={tabs} />
        <EmptyState
          icon="fixes"
          title="No findings yet"
          description={ready ? undefined : "Finish setup, then run an audit."}
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
