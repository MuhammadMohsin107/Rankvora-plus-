import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { TaskBoard } from "@/features/fixes/task-board";
import { getStore, storeIds } from "@/services/core";
import { getActor, listFindingRows, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Fix tasks" };

export async function generateStaticParams() {
  return storeIds();
}

export default async function FixTasksPage(props: PageProps<"/stores/[storeId]/fixes/tasks">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [tasks, findings, actor] = await Promise.all([listTaskSummaries(storeId), listFindingRows(storeId), getActor()]);
  const base = `/stores/${storeId}`;
  const tabs = <FixesTabs storeId={storeId} findings={findings.length} tasks={tasks.length} />;

  if (tasks.length === 0) {
    return (
      <>
        <PageHeader title="Fix tasks" subtitle="Board and list" tabs={tabs} />
        <EmptyState
          icon="fixes"
          title="No tasks yet"
          description={findings.length ? "Create tasks from findings." : "Tasks come from audit findings."}
          action={
            findings.length ? (
              <ButtonLink href={`${base}/fixes`} variant="primary">Open findings</ButtonLink>
            ) : store.summary ? (
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
        title="Fix tasks"
        subtitle="Board and list"
        tabs={tabs}
        actions={<ButtonLink href={`${base}/fixes`} variant="primary" icon="plus">Create from findings</ButtonLink>}
      />
      <TaskBoard storeId={storeId} tasks={tasks} role={actor.role} />
    </>
  );
}
