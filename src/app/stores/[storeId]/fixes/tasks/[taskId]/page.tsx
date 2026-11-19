import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TaskWorkspace } from "@/features/fixes/task-workspace";
import { getStore, storeIds } from "@/services/core";
import { getActor, getTaskDetail, listAssignees, taskStaticParams } from "@/services/fixes";

export const metadata: Metadata = { title: "Fix task" };

export async function generateStaticParams() {
  return taskStaticParams(storeIds().map((s) => s.storeId));
}

async function FixTaskPageContent(props: PageProps<"/stores/[storeId]/fixes/tasks/[taskId]">) {
  const { storeId, taskId } = await props.params;
  const store = await getStore(storeId);
  if (!store) notFound();

  const detail = await getTaskDetail(storeId, taskId);
  if (!detail) notFound();

  const [actor, assignees] = await Promise.all([getActor(), listAssignees()]);
  return <TaskWorkspace storeId={storeId} detail={detail} role={actor.role} actorName={actor.name} assignees={assignees} />;
}

export default function FixTaskPage(props: PageProps<"/stores/[storeId]/fixes/tasks/[taskId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <FixTaskPageContent {...props} />
    </Suspense>
  );
}
