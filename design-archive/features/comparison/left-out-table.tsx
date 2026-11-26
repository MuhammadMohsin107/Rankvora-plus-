"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { REASON_LABEL } from "@/features/comparison/engine";
import { leftOutRows, type LeftOutRow } from "@/features/comparison/left-out-rows";

// Re-export so existing client callers (the wizard) keep one import site.
export { leftOutRows, type LeftOutRow };

export function LeftOutTable({ rows, label = "Left out" }: { rows: LeftOutRow[]; label?: string }) {
  const columns: Column<LeftOutRow>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (r) => r.promptId,
      cell: (r) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate text-body-sm text-fg" title={r.promptText}>{r.promptText}</p>
          <p className="tnum text-helper text-fg-subtle">{r.promptId}{r.slot ? ` · ${r.slot}` : ""}</p>
        </div>
      ),
    },
    { id: "channel", header: "Platform", hideBelow: "md", cell: (r) => <span className="text-helper text-fg-muted">{r.channel}</span> },
    { id: "status", header: "Status", hideBelow: "sm", sort: (r) => r.status, cell: (r) => <Badge tone={r.status === "Excluded" ? "danger" : "neutral"}>{r.status}</Badge> },
    {
      id: "reason",
      header: "Reason",
      sort: (r) => r.reason,
      cell: (r) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone="warning" icon="alert-triangle">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
          <span className="text-helper text-fg-subtle">{r.detail}</span>
        </div>
      ),
    },
  ];
  const filters: TableFilter<LeftOutRow>[] = [
    { id: "status", label: "Status", options: [{ value: "Unmatched", label: "Unmatched" }, { value: "Excluded", label: "Excluded" }], value: (r) => r.status },
    { id: "reason", label: "Reason", options: [...new Set(rows.map((r) => r.reason))].map((value) => ({ value, label: REASON_LABEL[value] ?? value })), value: (r) => r.reason },
  ];
  return (
    <DataTable
      label={label}
      data={rows}
      columns={columns}
      rowKey={(r) => r.id}
      filters={filters}
      searchable={{ placeholder: "Search prompts", text: (r) => `${r.promptText} ${r.promptId}` }}
      pageSize={10}
      dense
      empty={<p className="p-2 text-center text-body-sm text-fg-muted">Every slot matched.</p>}
    />
  );
}
