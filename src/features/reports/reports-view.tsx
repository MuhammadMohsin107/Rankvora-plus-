"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Field, Select, Checkbox } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { Dialog } from "@/components/ui/overlay";
import { DataTable, type Column, type TableFilter } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { simulatedToast } from "@/demo-state";
import { ReportStatusBadge, ReportTypeBadge, reportTypeLabel } from "@/features/reports/report-parts";
import { useReports } from "@/features/reports/report-state";
import { DEMO_NOW, formatDate } from "@/lib/format";
import type { ReportSource } from "@/services/reports";
import type { ReportKind, ReportRow } from "@/types/shared-records";

const DAY = 86_400_000;
const TYPES: ReportKind[] = ["audit", "monitoring", "comparison"];
const SOURCE_NOUN: Record<ReportKind, string> = { audit: "Audit", monitoring: "Monitoring run", comparison: "Comparison" };

/** Pure: which period buckets a report falls into, relative to the demo clock. A 10-day-old report is in "30d" and "90d". */
export function periodBuckets(createdAt: string, now: string = DEMO_NOW): string[] {
  const age = (Date.parse(now) - Date.parse(createdAt)) / DAY;
  if (!Number.isFinite(age)) return [];
  return age <= 30 ? ["30d", "90d"] : age <= 90 ? ["90d"] : [];
}

function GenerateDialog({ open, onClose, sources, onCreate }: { open: boolean; onClose: () => void; sources: ReportSource[]; onCreate: (source: ReportSource) => void }) {
  const types = TYPES.filter((t) => sources.some((s) => s.type === t));
  const [type, setType] = useState<ReportKind>(types[0] ?? "audit");
  const options = useMemo(() => sources.filter((s) => s.type === type), [sources, type]);
  const [sourceId, setSourceId] = useState("");
  const chosen = options.find((s) => s.id === sourceId) ?? options[0];
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Generate report"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!chosen} onClick={() => chosen && onCreate(chosen)}>Generate</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Report type">
          {(p) => (
            <Select id={p.id} value={type} onChange={(e) => { setType(e.target.value as ReportKind); setSourceId(""); }}>
              {types.map((t) => <option key={t} value={t}>{reportTypeLabel(t)}</option>)}
            </Select>
          )}
        </Field>
        <Field label={SOURCE_NOUN[type]} hint={chosen?.hasReport ? "A report exists. This creates a new version." : undefined}>
          {(p) => (
            <Select id={p.id} aria-describedby={p.describedBy} value={chosen?.id ?? ""} onChange={(e) => setSourceId(e.target.value)}>
              {options.map((s) => <option key={s.id} value={s.id}>{s.title} · {formatDate(s.date)}</option>)}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}

/** Reports of one website: filters, generate, retry and archive. Rows created here persist in this browser (demo-state). */
export function ReportsView({ storeId, reports, sources }: { storeId: string; reports: ReportRow[]; sources: ReportSource[] }) {
  const router = useRouter();
  const toast = useToast();
  const api = useReports(storeId, reports);
  const [dialog, setDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const rows = useMemo(() => (showArchived ? api.rows : api.rows.filter((r) => !r.archived)), [api.rows, showArchived]);
  const archivedCount = api.rows.filter((r) => r.archived).length;
  const href = (id: string) => `/stores/${storeId}/reports/${id}`;

  const create = (source: ReportSource) => {
    const row = api.generate({ type: source.type, sourceId: source.id, title: source.title, period: source.period, version: source.version, sourceHref: source.href });
    setDialog(false);
    toast.push(simulatedToast("Report generation started"));
    router.push(href(row.id));
  };

  const columns: Column<ReportRow>[] = [
    {
      id: "title",
      header: "Report",
      sort: (r) => r.title,
      cell: (r) => (
        <div className="min-w-0">
          <Link href={href(r.id)} className="block max-w-sm truncate text-body-sm font-medium text-fg hover:underline" title={r.title}>{r.title}</Link>
          {r.archived ? <Badge tone="neutral">Archived</Badge> : null}
        </div>
      ),
    },
    { id: "type", header: "Type", hideBelow: "sm", sort: (r) => r.type, cell: (r) => <ReportTypeBadge type={r.type} /> },
    { id: "period", header: "Period", hideBelow: "md", cell: (r) => <span className="tnum text-body-sm text-fg-muted">{r.period}</span> },
    { id: "created", header: "Created", hideBelow: "lg", sort: (r) => r.createdAt, cell: (r) => <span className="tnum text-body-sm text-fg-muted">{formatDate(r.createdAt)}</span> },
    { id: "status", header: "Status", sort: (r) => r.status, cell: (r) => <ReportStatusBadge status={r.status} /> },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => (
        <Menu
          label={`Actions for ${r.title}`}
          trigger={<IconButton icon="more" label={`Actions for ${r.title}`} size="sm" />}
          items={[
            { label: "Open", icon: "arrow-right", href: href(r.id) },
            ...(r.status === "failed" ? [{ label: "Retry", icon: "refresh" as const, onSelect: () => { api.retry(r.id); toast.push(simulatedToast("Report generation restarted")); } }] : []),
            { type: "separator" as const },
            r.archived
              ? { label: "Restore", icon: "undo" as const, onSelect: () => { api.setArchived(r.id, false); toast.push(simulatedToast("Report restored")); } }
              : { label: "Archive", icon: "minus-circle" as const, onSelect: () => { api.setArchived(r.id, true); toast.push(simulatedToast("Report archived")); } },
          ]}
        />
      ),
    },
  ];

  const filters: TableFilter<ReportRow>[] = [
    { id: "type", label: "Type", options: TYPES.map((value) => ({ value, label: reportTypeLabel(value) })), value: (r) => r.type },
    { id: "status", label: "Status", options: [{ value: "ready", label: "Ready" }, { value: "generating", label: "Generating" }, { value: "failed", label: "Failed" }], value: (r) => r.status },
    { id: "period", label: "Period", options: [{ value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }], value: (r) => periodBuckets(r.createdAt) },
  ];

  const canGenerate = sources.length > 0;
  if (api.rows.length === 0) {
    return (
      <EmptyState
        icon="reports"
        title="No reports yet"
        description={canGenerate ? undefined : "Run an audit or a monitoring run first."}
        action={canGenerate ? <Button variant="primary" icon="plus" onClick={() => setDialog(true)}>Generate report</Button> : <ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary">Start audit</ButtonLink>}
      />
    );
  }

  return (
    <>
      {canGenerate ? (
        <HeaderAction>
          <Button variant="primary" icon="plus" onClick={() => setDialog(true)}>Generate report</Button>
        </HeaderAction>
      ) : null}
      <DataTable
        label="Reports"
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        rowLabel={(r) => r.title}
        searchable={{ placeholder: "Search reports", text: (r) => `${r.title} ${r.sourceId} ${r.period}` }}
        filters={filters}
        defaultSort={{ column: "created", dir: "desc" }}
        onRowClick={(r) => router.push(href(r.id))}
        mobileCards
        toolbarExtra={archivedCount > 0 ? <Checkbox label={`Show archived (${archivedCount})`} checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> : undefined}
        empty={<EmptyState icon="search" title="No reports match" description="Clear a filter or change the search." />}
      />
      <GenerateDialog open={dialog} onClose={() => setDialog(false)} sources={sources} onCreate={create} />
    </>
  );
}
