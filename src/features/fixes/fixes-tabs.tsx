"use client";

import { LinkTabs } from "@/components/ui/tabs";
import { useDemoCollection } from "@/demo-state";
import type { TaskRow, TaskSummary } from "@/types/fixes";

const NO_FINDINGS: { id: string; storeId?: string }[] = [];
const idOf = (row: { id: string }) => row.id;
const idOfTask = (row: TaskRow) => row.id;

/** Findings / Tasks / History switcher under the page header. Counts follow the local changes. */
export function FixesTabs({ storeId, findings, tasks }: { storeId: string; findings: number; tasks: readonly TaskSummary[] }) {
  const base = `/stores/${storeId}/fixes`;
  const createdFindings = useDemoCollection<{ id: string; storeId?: string }>("findings", NO_FINDINGS, idOf).rows.filter((r) => r.storeId === storeId).length;
  const taskRows = useDemoCollection<TaskRow>("tasks", tasks as TaskRow[], idOfTask).rows.filter((r) => r.storeId === storeId).length;
  return (
    <LinkTabs
      label="Fixes sections"
      items={[
        { href: base, label: "Findings", count: findings + createdFindings, exact: true },
        { href: `${base}/tasks`, label: "Tasks", count: taskRows },
        { href: `${base}/history`, label: "History" },
      ]}
    />
  );
}
