import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocalTaskView } from "@/features/fixes/local-task-view";
import { TaskWorkspace } from "@/features/fixes/task-workspace";
import { getStore, storeIds } from "@/services/core";
import { getActor, getFixLinks, getTaskDetail, listAssignees, listFindingRows, listTaskSummaries, taskStaticParams } from "@/services/fixes";

export const metadata: Metadata = { title: "Fix task" };

export async function generateStaticParams() {
  return taskStaticParams(storeIds().map((s) => s.storeId));
}

async function FixTaskPageContent(props: PageProps<"/stores/[storeId]/fixes/tasks/[taskId]">) {
  const { storeId, taskId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const [detail, tasks, actor, assignees, links] = await Promise.all([getTaskDetail(storeId, taskId), listTaskSummaries(storeId), getActor(), listAssignees(), getFixLinks(storeId)]);

  // Tasks created in this browser are not in the static data: a client view looks the id up in the local demo state.
  if (!detail) {
    const findings = await listFindingRows(storeId);
    return <LocalTaskView storeId={storeId} taskId={taskId} tasks={tasks} findings={findings} role={actor.role} actorName={actor.name} assignees={assignees} links={links} />;
  }

  return <TaskWorkspace storeId={storeId} detail={detail} tasks={tasks} role={actor.role} actorName={actor.name} assignees={assignees} links={links} />;
}

export default function FixTaskPage(props: PageProps<"/stores/[storeId]/fixes/tasks/[taskId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FixTaskPageContent {...props} />
    </Suspense>
  );
}
