"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatRelative, pluralize } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { FindingRow } from "@/types/fixes";

import { CATEGORY_LABEL } from "./fixes-shared";

const options = (map: Record<string, { label: string }>) => Object.entries(map).map(([value, meta]) => ({ value, label: meta.label }));
const rank = (keys: string[], key: string) => keys.indexOf(key);

const SEVERITY_ORDER = Object.keys(STATUS.severity);
const PRIORITY_ORDER = Object.keys(STATUS.priority);
const CONFIDENCE_ORDER = Object.keys(STATUS.confidence);

/** Findings inbox: filter, search, sort, and bulk "Create tasks" (demo, local state). */
export function FindingsInbox({ storeId, rows }: { storeId: string; rows: FindingRow[] }) {
  const toast = useToast();
  const [created, setCreated] = useState<Set<string>>(new Set());

  const eligible = (row: FindingRow) => !row.closed && row.tasks.length === 0 && !created.has(row.id);
  const base = `/stores/${storeId}/fixes`;

  const createTasks = (selected: FindingRow[], clear: () => void) => {
    const targets = selected.filter(eligible);
    const skipped = selected.length - targets.length;
    if (targets.length === 0) {
      toast.push({ title: "No tasks created", description: "Selected findings are closed or already have a task.", tone: "warning" });
      return;
    }
    setCreated((current) => new Set([...current, ...targets.map((t) => t.id)]));
    toast.push({
      title: `${pluralize(targets.length, "task")} created`,
      description: `${skipped ? `${skipped} skipped (closed or already linked). ` : ""}Demo action: status Suggested, not saved.`,
    });
    clear();
  };

  const filters: TableFilter<FindingRow>[] = [
    { id: "severity", label: "Severity", options: options(STATUS.severity), value: (r) => r.severity },
    { id: "priority", label: "Priority", options: options(STATUS.priority), value: (r) => r.priority },
    { id: "category", label: "Category", options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })), value: (r) => r.category },
    { id: "confidence", label: "Confidence", options: options(STATUS.confidence), value: (r) => r.confidence },
    { id: "status", label: "Status", options: options(STATUS.finding), value: (r) => r.status },
  ];

  const columns: Column<FindingRow>[] = [
    {
      id: "title",
      header: "Finding",
      sort: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-[26rem]">
          <Link href={`${base}/findings/${r.id}`} className="line-clamp-2 font-medium text-fg hover:text-accent-text hover:underline">
            {r.title}
          </Link>
          <p className="tnum mt-0.5 text-xs text-fg-subtle">
            {r.id} · seen {formatRelative(r.lastObservedAt)}
          </p>
        </div>
      ),
    },
    { id: "category", header: "Category", hideBelow: "lg", sort: (r) => r.category, cell: (r) => <span className="text-fg-muted">{CATEGORY_LABEL[r.category]}</span> },
    { id: "severity", header: "Severity", sort: (r) => rank(SEVERITY_ORDER, r.severity), cell: (r) => <Status kind="severity" value={r.severity} /> },
    { id: "priority", header: "Priority", sort: (r) => rank(PRIORITY_ORDER, r.priority), cell: (r) => <Status kind="priority" value={r.priority} /> },
    { id: "confidence", header: "Confidence", hideBelow: "xl", sort: (r) => rank(CONFIDENCE_ORDER, r.confidence), cell: (r) => <Status kind="confidence" value={r.confidence} /> },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Status kind="finding" value={r.status} /> },
    {
      id: "affected",
      header: "Affected",
      hideBelow: "md",
      sort: (r) => r.urlCount + r.promptCount,
      cell: (r) => (
        <span className="tnum whitespace-nowrap text-fg-muted">
          {r.urlCount} {r.urlCount === 1 ? "URL" : "URLs"} · {r.promptCount} {r.promptCount === 1 ? "prompt" : "prompts"}
        </span>
      ),
    },
    {
      id: "duplicate",
      header: "Duplicate",
      hideBelow: "xl",
      cell: (r) =>
        r.duplicate ? (
          <Badge tone="neutral" icon="copy" title={r.duplicate.reason}>
            Possible · {r.duplicate.ofId}
          </Badge>
        ) : (
          <span className="text-fg-subtle">None</span>
        ),
    },
    {
      id: "task",
      header: "Task",
      sort: (r) => r.tasks[0]?.id ?? (created.has(r.id) ? "~new" : "~"),
      cell: (r) =>
        r.tasks.length ? (
          <div className="flex flex-col items-start gap-1">
            {r.tasks.map((t) => (
              <Link key={t.id} href={`${base}/tasks/${t.id}`} className="inline-flex items-center gap-1.5 text-[13px] text-accent-text hover:underline">
                {t.id}
                <Status kind="task" value={t.status} compact />
              </Link>
            ))}
          </div>
        ) : created.has(r.id) ? (
          <Badge tone="accent" icon="sparkles">Suggested (demo)</Badge>
        ) : (
          <span className="text-fg-subtle">None</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => {
        const items: MenuItem[] = [
          { label: "Open finding", icon: "arrow-right", href: `${base}/findings/${r.id}` },
          {
            label: "Create task",
            icon: "plus",
            disabled: !eligible(r),
            disabledReason: r.closed ? "Finding is closed." : "Already has a task.",
            onSelect: () => {
              setCreated((current) => new Set(current).add(r.id));
              toast.push({ title: "Task created", description: `${r.id}: status Suggested. Demo action, not saved.` });
            },
          },
        ];
        if (r.tasks[0]) items.push({ label: `Open ${r.tasks[0].id}`, icon: "fixes", href: `${base}/tasks/${r.tasks[0].id}` });
        return <Menu trigger={<IconButton icon="more" label={`Actions for ${r.id}`} size="sm" />} items={items} />;
      },
    },
  ];

  return (
    <DataTable
      label="Findings"
      data={rows}
      rowKey={(r) => r.id}
      columns={columns}
      filters={filters}
      searchable={{ placeholder: "Search findings", text: (r) => `${r.title} ${r.id} ${CATEGORY_LABEL[r.category]}` }}
      defaultSort={{ column: "priority", dir: "asc" }}
      selectable
      pageSize={10}
      bulkActions={(selected, clear) => (
        <Button size="sm" variant="primary" icon="plus" onClick={() => createTasks(selected, clear)}>
          Create tasks
        </Button>
      )}
    />
  );
}
