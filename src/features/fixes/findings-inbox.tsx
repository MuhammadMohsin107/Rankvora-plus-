"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { DataTable, type Column } from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { FindingRow, TaskSummary } from "@/types/fixes";

import { canCreateTask, isTaskOpen } from "./fixes-logic";
import { CATEGORY_LABEL } from "./fixes-shared";
import { ListToolbar, type FilterDef } from "./list-toolbar";
import { useFindingActions } from "./use-finding-actions";
import { useFixData } from "./use-fix-data";

const options = (map: Record<string, { label: string }>) => Object.entries(map).map(([value, meta]) => ({ value, label: meta.label }));
const rank = (keys: string[], key: string) => keys.indexOf(key);

const SEVERITY_ORDER = Object.keys(STATUS.severity);
const PRIORITY_ORDER = Object.keys(STATUS.priority);

const PRIMARY: FilterDef[] = [
  { id: "severity", label: "Severity", options: options(STATUS.severity) },
  { id: "status", label: "Status", options: options(STATUS.finding) },
  { id: "category", label: "Category", options: Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })) },
  { id: "task", label: "Task", options: [{ value: "none", label: "No task" }, { value: "open", label: "Open task" }, { value: "any", label: "Has a task" }] },
];
const MORE: FilterDef[] = [
  { id: "priority", label: "Priority", options: options(STATUS.priority) },
  { id: "confidence", label: "Confidence", options: options(STATUS.confidence) },
  { id: "duplicate", label: "Duplicate", options: [{ value: "yes", label: "Possible duplicate" }, { value: "no", label: "Not a duplicate" }] },
];

function matches(row: FindingRow, values: Record<string, string>): boolean {
  if (values.severity && row.severity !== values.severity) return false;
  if (values.status && row.status !== values.status) return false;
  if (values.category && row.category !== values.category) return false;
  if (values.priority && row.priority !== values.priority) return false;
  if (values.confidence && row.confidence !== values.confidence) return false;
  if (values.duplicate && (values.duplicate === "yes") !== Boolean(row.duplicate)) return false;
  if (values.task) {
    const open = row.tasks.some((t) => isTaskOpen(t.status));
    if (values.task === "none" && row.tasks.length > 0) return false;
    if (values.task === "any" && row.tasks.length === 0) return false;
    if (values.task === "open" && !open) return false;
  }
  return true;
}

type Props = { storeId: string; rows: FindingRow[]; tasks: TaskSummary[]; actorName: string };

/** Findings inbox: six columns, four filters (the rest under "More filters"), review actions and Create task per row. */
export function FindingsInbox({ storeId, rows, tasks, actorName }: Props) {
  const fix = useFixData(storeId, tasks, rows, actorName);
  const actions = useFindingActions(fix);
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const base = `/stores/${storeId}/fixes`;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return fix.findings.filter((r) => matches(r, values) && (!needle || `${r.title} ${r.id} ${CATEGORY_LABEL[r.category]}`.toLowerCase().includes(needle)));
  }, [fix.findings, values, query]);

  const columns: Column<FindingRow>[] = [
    {
      id: "title",
      header: "Finding",
      sort: (r) => r.title.toLowerCase(),
      cell: (r) => (
        <div className="min-w-0 max-w-[28rem]">
          <Link href={`${base}/findings/${r.id}`} className="line-clamp-2 font-medium text-fg hover:text-accent-text hover:underline">
            {r.title}
          </Link>
          <p className="tnum mt-0.5 truncate text-helper text-fg-subtle">
            {r.id} · {CATEGORY_LABEL[r.category]} · seen {formatRelative(r.lastObservedAt)}
            {r.duplicate ? ` · possible duplicate of ${r.duplicate.ofId}` : ""}
          </p>
        </div>
      ),
    },
    {
      id: "severity",
      header: "Severity",
      sort: (r) => rank(SEVERITY_ORDER, r.severity) * 10 + rank(PRIORITY_ORDER, r.priority),
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Status kind="severity" value={r.severity} />
          <span className="tnum text-helper text-fg-subtle">{STATUS.priority[r.priority].label}</span>
        </div>
      ),
    },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Status kind="finding" value={r.status} /> },
    {
      id: "affected",
      header: "Affected",
      hideBelow: "lg",
      sort: (r) => r.urlCount + r.promptCount,
      cell: (r) => (
        <span className="tnum text-fg-muted">
          {r.urlCount} {r.urlCount === 1 ? "URL" : "URLs"}
          <br />
          {r.promptCount} {r.promptCount === 1 ? "prompt" : "prompts"}
        </span>
      ),
    },
    {
      id: "task",
      header: "Task",
      sort: (r) => r.tasks[0]?.id ?? "~",
      cell: (r) =>
        r.tasks.length ? (
          <div className="flex flex-col items-start gap-1">
            {r.tasks.slice(0, 2).map((t) => (
              <Link key={t.id} href={`${base}/tasks/${t.id}`} className="inline-flex items-center gap-1.5 text-label text-accent-text hover:underline">
                {t.id}
                <Status kind="task" value={t.status} compact />
              </Link>
            ))}
            {r.tasks.length > 2 ? <Badge>+{r.tasks.length - 2} more</Badge> : null}
          </div>
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
      cell: (r) => <Menu trigger={<IconButton icon="more" label={`Actions for ${r.id}`} size="sm" />} items={actions.menuItems(r)} />,
    },
  ];

  const clear = () => {
    setQuery("");
    setValues({});
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ListToolbar
        label="Findings"
        query={query}
        onQuery={setQuery}
        placeholder="Search findings"
        primary={PRIMARY}
        more={MORE}
        values={values}
        onChange={(id, value) => setValues((v) => ({ ...v, [id]: value }))}
        onClear={clear}
        shown={filtered.length}
        total={fix.findings.length}
      />
      <DataTable
        label="Findings"
        data={filtered}
        rowKey={(r) => r.id}
        columns={columns}
        rowLabel={(r) => r.title}
        defaultSort={{ column: "severity", dir: "asc" }}
        selectable
        mobileCards
        pageSize={10}
        empty={
          <p className="py-4 text-center text-body-sm text-fg-muted">
            No findings match.{" "}
            <Button variant="ghost" size="sm" onClick={clear}>
              Reset filters
            </Button>
          </p>
        }
        bulkActions={(selected, clearSelection) => (
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            onClick={() => {
              const targets = selected.filter((r) => canCreateTask(r.status) && r.tasks.every((t) => !isTaskOpen(t.status)));
              if (targets.length === 0) {
                fix.notify("No tasks created", "Selected findings are closed or already have an open task.", "warning");
                return;
              }
              for (const r of targets) {
                fix.createTask({
                  finding: { id: r.id, title: r.title, category: r.category, priority: r.priority, status: r.status, expected: r.context?.expected ?? "", actual: r.context?.actual ?? "", affectedUrls: r.context?.affectedUrls ?? [], verificationCriteria: r.context?.verificationCriteria ?? [] },
                  recommendation: r.context?.recommendation ?? null,
                  mode: r.context?.recommendation?.suggestedMode ?? "guidance",
                  assignee: null,
                  dueAt: null,
                });
              }
              clearSelection();
            }}
          >
            Create tasks
          </Button>
        )}
      />
      {actions.dialogs}
    </div>
  );
}
