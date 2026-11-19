"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Status } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Mono } from "@/components/ui/misc";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { Comparability, ComparisonStatusValue, ComparisonType } from "@/types/comparison";

type RefValue = { text: string; isId: boolean };

export type ComparisonRow = {
  id: string;
  title: string;
  type: ComparisonType;
  typeLabel: string;
  baseline: RefValue;
  current: RefValue;
  status: ComparisonStatusValue;
  comparability: Comparability;
  createdBy: string;
  createdAt: string;
  methodologyVersion: string;
  reportId: string | null;
};

function Ref({ value }: { value: RefValue }) {
  return value.isId ? <Mono>{value.text}</Mono> : <span className="tnum text-[13px] text-fg">{value.text}</span>;
}

function unique<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

export function ComparisonsTable({ storeId, rows }: { storeId: string; rows: ComparisonRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const base = `/stores/${storeId}/comparisons`;

  const columns: Column<ComparisonRow>[] = [
    {
      id: "title",
      header: "Comparison",
      sort: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`${base}/${r.id}`} className="block max-w-xs truncate text-[13px] font-medium text-fg hover:underline" title={r.title}>
            {r.title}
          </Link>
          <p className="text-xs text-fg-subtle">{r.typeLabel}</p>
        </div>
      ),
    },
    {
      id: "range",
      header: "Baseline → current",
      hideBelow: "md",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Ref value={r.baseline} />
          <span aria-hidden="true" className="text-fg-subtle">→</span>
          <span className="sr-only">to</span>
          <Ref value={r.current} />
        </div>
      ),
    },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <Status kind="comparison" value={r.status} /> },
    { id: "comparability", header: "Comparability", sort: (r) => r.comparability, hideBelow: "sm", cell: (r) => <Status kind="comparability" value={r.comparability} /> },
    { id: "createdBy", header: "Created by", hideBelow: "lg", sort: (r) => r.createdBy, cell: (r) => <span className="text-[13px] text-fg-muted">{r.createdBy}</span> },
    { id: "createdAt", header: "Created", hideBelow: "lg", sort: (r) => r.createdAt, cell: (r) => <span className="tnum text-[13px] text-fg-muted">{formatDate(r.createdAt)}</span> },
    { id: "method", header: "Method", hideBelow: "xl", cell: (r) => <span className="tnum text-[13px] text-fg-muted">v{r.methodologyVersion}</span> },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Menu
            trigger={<IconButton icon="more" label={`Actions for ${r.title}`} size="sm" />}
            items={[
              { label: "Open comparison", icon: "arrow-right", href: `${base}/${r.id}` },
              ...(r.reportId ? [{ label: "Open report", icon: "reports" as const, href: `/stores/${storeId}/reports/${r.reportId}` }] : []),
              { label: "Export CSV", icon: "download", onSelect: () => toast.push({ title: "CSV export started", description: `${r.id}: row-level and aggregate files.`, tone: "info" }) },
              { type: "separator" },
              { label: "Run a new comparison", icon: "plus", href: `${base}/new` },
            ]}
          />
        </div>
      ),
    },
  ];

  const filters: TableFilter<ComparisonRow>[] = [
    { id: "type", label: "Type", options: unique(rows.map((r) => r.type)).map((value) => ({ value, label: rows.find((r) => r.type === value)!.typeLabel })), value: (r) => r.type },
    { id: "status", label: "Status", options: unique(rows.map((r) => r.status)).map((value) => ({ value, label: STATUS.comparison[value].label })), value: (r) => r.status },
    { id: "comparability", label: "Comparability", options: unique(rows.map((r) => r.comparability)).map((value) => ({ value, label: STATUS.comparability[value].label })), value: (r) => r.comparability },
  ];

  return (
    <DataTable
      label="Comparisons"
      data={rows}
      columns={columns}
      rowKey={(r) => r.id}
      searchable={{ placeholder: "Search comparisons", text: (r) => `${r.title} ${r.typeLabel} ${r.baseline.text} ${r.current.text} ${r.createdBy}` }}
      filters={filters}
      defaultSort={{ column: "createdAt", dir: "desc" }}
      onRowClick={(r) => router.push(`${base}/${r.id}`)}
    />
  );
}
