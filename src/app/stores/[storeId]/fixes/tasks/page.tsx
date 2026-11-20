import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { FixesEmpty } from "@/features/fixes/fixes-empty";
import { FixesTabs } from "@/features/fixes/fixes-tabs";
import { TaskBoard } from "@/features/fixes/task-board";
import { getStore, storeIds } from "@/services/core";
import { getActor, getFixesSetup, listAssignees, listFindingRows, listTaskSummaries } from "@/services/fixes";

export const metadata: Metadata = { title: "Fix tasks" };

export async function generateStaticParams() {
  return storeIds();
}

async function FixTasksPageContent(props: PageProps<"/stores/[storeId]/fixes/tasks">) {
  const { storeId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [tasks, findings, actor, setup, assignees] = await Promise.all([listTaskSummaries(storeId), listFindingRows(storeId), getActor(), getFixesSetup(storeId), listAssignees()]);
  const tabs = <FixesTabs storeId={storeId} findings={findings.length} tasks={tasks} />;

  // Tasks created in this browser are not in the static list, so only an empty finding list shows the empty state.
  if (tasks.length === 0 && findings.length === 0) {
    return (
      <>
        <PageHeader title="Fixes" tabs={tabs} />
        <FixesEmpty storeId={storeId} kind="tasks" hasAiPlatform={setup.hasAiPlatform} hasFindings={false} />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Fixes" tabs={tabs} />
      <TaskBoard storeId={storeId} tasks={tasks} findings={findings} role={actor.role} assignees={assignees} actorName={actor.name} />
    </>
  );
}

export default function FixTasksPage(props: PageProps<"/stores/[storeId]/fixes/tasks">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FixTasksPageContent {...props} />
    </Suspense>
  );
}
