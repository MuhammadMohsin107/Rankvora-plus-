"use client";

import { useState, useSyncExternalStore } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useDemoCollection } from "@/demo-state";
import type { Role } from "@/types/core";
import type { FindingRow, TaskRow, TaskSummary } from "@/types/fixes";

import { detailFromRow } from "./local-task";
import { TaskWorkspace } from "./task-workspace";
import type { FixLinks } from "./use-task-model";

const NONE: TaskRow[] = [];
const idOf = (row: TaskRow) => row.id;
const subscribe = () => () => {};

type Props = { storeId: string; taskId: string; tasks: TaskSummary[]; findings: FindingRow[]; role: Role; actorName: string; links: FixLinks };

/** Task detail for an id that is not in the static data: a task created in this browser. */
export function LocalTaskView(props: Props) {
  // false on the server and during hydration, true afterwards: avoids a "not found" flash before local state loads.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const { rows } = useDemoCollection<TaskRow>("tasks", NONE, idOf);
  const row = rows.find((r) => r.id === props.taskId && r.storeId === props.storeId && r.seed);

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (!row) {
    return (
      <>
        <PageHeader title="Task not found" />
        <EmptyState
          icon="fixes"
          title="This task is not in this browser"
          description="Tasks created in the demo are stored locally and are gone after a reset."
          action={
            <ButtonLink href={`/stores/${props.storeId}/fixes/tasks`} variant="primary">
              Open tasks
            </ButtonLink>
          }
        />
      </>
    );
  }
  return <LocalBody {...props} row={row} />;
}

function LocalBody({ row, findings, ...rest }: Props & { row: TaskRow }) {
  // Frozen once: the seeded parts of a created task never change, live fields come from the overlay.
  const [detail] = useState(() => detailFromRow(row, findings.find((f) => f.id === row.findingId)?.status ?? "in_remediation"));
  return <TaskWorkspace storeId={rest.storeId} detail={detail} tasks={rest.tasks} role={rest.role} actorName={rest.actorName} links={rest.links} />;
}
