"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Mono } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { ReportStatusBadge, ReportTypeBadge, reportTypeLabel } from "@/features/reports/report-parts";
import { formatDate } from "@/lib/format";
import type { StatusValue } from "@/lib/status";
import type { HistoricalRecord, ReportRecord } from "@/types/comparison";

function ReportsTable({ storeId, reports }: { storeId: string; reports: ReportRecord[] }) {
  const router = useRouter();
  const columns: Column<ReportRecord>[] = [
    { id: "type", header: "Type", sort: (r) => r.type, cell: (r) => <ReportTypeBadge type={r.type} /> },
    {
      id: "title",
      header: "Report",
      sort: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/stores/${storeId}/reports/${r.id}`} className="block max-w-sm truncate text-[13px] font-medium text-fg hover:underline" title={r.title}>
            {r.title}
          </Link>
          <p className="text-xs text-fg-subtle"><Mono>{r.sourceId}</Mono></p>
        </div>
      ),
    },
    { id: "period", header: "Period", hideBelow: "md", cell: (r) => <span className="tnum text-[13px] text-fg-muted">{r.period}</span> },
    { id: "version", header: "Version", hideBelow: "lg", sort: (r) => r.version, cell: (r) => <span className="text-[13px] text-fg-muted">{r.version}</span> },
    { id: "created", header: "Created", hideBelow: "sm", sort: (r) => r.createdAt, cell: (r) => <span className="tnum text-[13px] text-fg-muted">{formatDate(r.createdAt)}</span> },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <ReportStatusBadge status={r.status} /> },
  ];
  const filters: TableFilter<ReportRecord>[] = [
    { id: "type", label: "Type", options: (["audit", "monitoring", "comparison"] as const).map((value) => ({ value, label: reportTypeLabel(value) })), value: (r) => r.type },
    { id: "status", label: "Status", options: [{ value: "ready", label: "Ready" }, { value: "generating", label: "Generating" }, { value: "failed", label: "Failed" }], value: (r) => r.status },
  ];
  return (
    <DataTable
      label="Reports"
      data={reports}
      columns={columns}
      rowKey={(r) => r.id}
      searchable={{ placeholder: "Search reports", text: (r) => `${r.title} ${r.sourceId} ${r.period} ${r.version}` }}
      filters={filters}
      defaultSort={{ column: "created", dir: "desc" }}
      onRowClick={(r) => router.push(`/stores/${storeId}/reports/${r.id}`)}
    />
  );
}

const kindLabel = { audit: "Audit", monitoring: "Monitoring run", comparison: "Comparison" } as const;

function HistoryStatus({ record }: { record: HistoricalRecord }) {
  if (record.kind === "audit") return <Status kind="audit" value={record.status as StatusValue<"audit">} />;
  if (record.kind === "monitoring") return <Status kind="run" value={record.status as StatusValue<"run">} />;
  return <Status kind="comparison" value={record.status as StatusValue<"comparison">} />;
}

function HistoryTable({ storeId, records }: { storeId: string; records: HistoricalRecord[] }) {
  const columns: Column<HistoricalRecord>[] = [
    { id: "kind", header: "Kind", sort: (r) => r.kind, cell: (r) => <Badge tone="neutral">{kindLabel[r.kind]}</Badge> },
    {
      id: "title",
      header: "Record",
      sort: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={r.href} className="block max-w-sm truncate text-[13px] font-medium text-fg hover:underline" title={r.title}>{r.title}</Link>
          <p className="text-xs text-fg-subtle"><Mono>{r.id}</Mono>{r.snapshotId ? <> · <Mono>{r.snapshotId}</Mono></> : null}</p>
        </div>
      ),
    },
    { id: "date", header: "Date", sort: (r) => r.at, hideBelow: "sm", cell: (r) => <span className="tnum text-[13px] text-fg-muted">{formatDate(r.at)}</span> },
    { id: "status", header: "Status", cell: (r) => <HistoryStatus record={r} /> },
    {
      id: "links",
      header: "Links",
      align: "right",
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          {r.reportId ? <ButtonLink href={`/stores/${storeId}/reports/${r.reportId}`} variant="ghost" size="sm">Report</ButtonLink> : null}
          <ButtonLink href={r.href} variant="secondary" size="sm" trailingIcon="arrow-right">Open</ButtonLink>
        </div>
      ),
    },
  ];
  const filters: TableFilter<HistoricalRecord>[] = [
    { id: "kind", label: "Kind", options: Object.entries(kindLabel).map(([value, label]) => ({ value, label })), value: (r) => r.kind },
  ];
  return (
    <DataTable
      label="Historical records"
      data={records}
      columns={columns}
      rowKey={(r) => `${r.kind}-${r.id}`}
      searchable={{ placeholder: "Search records", text: (r) => `${r.title} ${r.id} ${r.snapshotId ?? ""}` }}
      filters={filters}
      defaultSort={{ column: "date", dir: "desc" }}
    />
  );
}

export function ReportsView({ storeId, reports, history }: { storeId: string; reports: ReportRecord[]; history: HistoricalRecord[] }) {
  return (
    <Tabs
      label="Reports and history"
      tabs={[
        { id: "reports", label: "Reports", count: reports.length, content: <ReportsTable storeId={storeId} reports={reports} /> },
        { id: "history", label: "Historical records", count: history.length, content: <HistoryTable storeId={storeId} records={history} /> },
      ]}
    />
  );
}

