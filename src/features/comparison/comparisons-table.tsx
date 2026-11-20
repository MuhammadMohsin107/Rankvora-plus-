"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { filterCount, sideTitle, TYPE_NAME } from "@/features/comparison/definition";
import { useComparisonState } from "@/features/comparison/use-comparison-state";
import { downloadText } from "@/features/reports/download";
import { formatDate } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { ComparisonRecord, SnapshotRef } from "@/types/comparison";

type Props = {
  storeId: string;
  /** Seeded comparisons from the server. Comparisons created in this browser are added on the client. */
  records: ComparisonRecord[];
  snapshots: SnapshotRef[];
  /** Metric CSV of each seeded comparison, built by the same export builder as the detail page. */
  csvById: Record<string, string>;
};

type Scope = "active" | "archived" | "all";

/** Comparisons of one website: seeded and created here, with archive and restore. */
export function ComparisonsTable({ storeId, records, snapshots, csvById }: Props) {
  const router = useRouter();
  const toast = useToast();
  const state = useComparisonState(storeId, records);
  const [scope, setScope] = useState<Scope>("active");
  const base = `/stores/${storeId}/comparisons`;

  const rows = useMemo(() => state.rows.filter((r) => (scope === "all" ? true : scope === "archived" ? r.archived : !r.archived)), [state.rows, scope]);
  const archivedCount = state.rows.filter((r) => r.archived).length;

  const columns: Column<ComparisonRecord>[] = [
    {
      id: "title",
      header: "Comparison",
      sort: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`${base}/${r.id}`} className="block max-w-sm truncate text-body-sm font-medium text-fg hover:underline" title={r.title}>
            {r.title}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2 text-helper text-fg-subtle">
            {TYPE_NAME[r.type]}
            {filterCount(r.filters) > 0 ? <span>· scoped</span> : null}
            {r.archived ? <Badge tone="neutral">Archived</Badge> : null}
            {r.simulated ? <Badge tone="neutral">Created here</Badge> : null}
          </p>
        </div>
      ),
    },
    {
      id: "range",
      header: "Baseline to current",
      hideBelow: "lg",
      cell: (r) => (
        <p className="tnum max-w-xs text-body-sm text-fg-muted">
          {sideTitle(r.baseline, snapshots)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {sideTitle(r.current, snapshots)}
        </p>
      ),
    },
    { id: "comparability", header: "Result", sort: (r) => r.comparability, cell: (r) => <Status kind="comparability" value={r.comparability} /> },
    {
      id: "matched",
      header: "Matched",
      hideBelow: "md",
      sort: (r) => (r.matched && r.matched.d > 0 ? r.matched.n / r.matched.d : -1),
      cell: (r) => <span className="tnum text-body-sm text-fg-muted">{r.matched ? `${r.matched.n} of ${r.matched.d} slots` : "—"}</span>,
    },
    {
      id: "createdAt",
      header: "Created",
      hideBelow: "xl",
      sort: (r) => r.createdAt,
      cell: (r) => (
        <div className="text-body-sm text-fg-muted">
          <span className="tnum">{formatDate(r.createdAt)}</span>
          <span className="block text-helper text-fg-subtle">{r.createdBy}</span>
        </div>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => {
        const csv = csvById[r.id];
        const items: MenuItem[] = [
          { label: "Open", icon: "compare", href: `${base}/${r.id}` },
          ...(r.reportId ? [{ label: "Open report", icon: "reports" as const, href: `/stores/${storeId}/reports/${r.reportId}` }] : []),
          ...(csv
            ? [
                {
                  label: "Export metrics (CSV)",
                  icon: "download" as const,
                  onSelect: () => {
                    downloadText(`${r.id}-metrics.csv`, "text/csv", csv);
                    toast.push({ title: `Downloaded ${r.id}-metrics.csv`, tone: "success" as const });
                  },
                },
              ]
            : []),
          { type: "separator" as const },
          r.archived
            ? { label: "Restore", icon: "refresh" as const, onSelect: () => state.setArchived(r, false) }
            : { label: "Archive", icon: "minus-circle" as const, onSelect: () => state.setArchived(r, true) },
        ];
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <Menu trigger={<IconButton icon="more" label={`Actions for ${r.title}`} size="sm" />} items={items} />
          </div>
        );
      },
    },
  ];

  const unique = <T extends string>(values: T[]) => [...new Set(values)];
  const filters: TableFilter<ComparisonRecord>[] = [
    { id: "type", label: "Type", options: unique(state.rows.map((r) => r.type)).map((value) => ({ value, label: TYPE_NAME[value] })), value: (r) => r.type },
    { id: "comparability", label: "Result", options: unique(state.rows.map((r) => r.comparability)).map((value) => ({ value, label: STATUS.comparability[value].label })), value: (r) => r.comparability },
  ];

  return (
    <DataTable
      label="Comparisons"
      data={rows}
      columns={columns}
      rowKey={(r) => r.id}
      rowLabel={(r) => r.title}
      searchable={{ placeholder: "Search comparisons", text: (r) => `${r.title} ${TYPE_NAME[r.type]} ${r.createdBy}` }}
      filters={filters}
      toolbarExtra={
        <Segmented
          label="Show"
          size="sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: "active", label: "Active" },
            { value: "archived", label: `Archived${archivedCount ? ` (${archivedCount})` : ""}` },
            { value: "all", label: "All" },
          ]}
        />
      }
      defaultSort={{ column: "createdAt", dir: "desc" }}
      onRowClick={(r) => router.push(`${base}/${r.id}`)}
      mobileCards
      empty={<p className="p-2 text-center text-body-sm text-fg-muted">{scope === "archived" ? "No archived comparisons." : "No comparisons match."}</p>}
    />
  );
}
