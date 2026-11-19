"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { Mono } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import type { AuditSummary } from "@/types/audit";

import { AUDIT_TYPE_LABEL, LANE_LABEL, LANE_SHORT, formatMinutes } from "./labels";

export function AuditHistoryTable({ audits, storeId }: { audits: AuditSummary[]; storeId: string }) {
  const router = useRouter();
  const href = (a: AuditSummary) => `/stores/${storeId}/audits/${a.id}`;

  const columns: Column<AuditSummary>[] = [
    {
      id: "title",
      header: "Audit",
      sort: (a) => a.title,
      cell: (a) => (
        <div className="min-w-0">
          <Link href={href(a)} className="font-medium text-fg hover:underline">{a.title}</Link>
          <p className="text-xs text-fg-subtle">{a.id} · {a.createdBy}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", sort: (a) => a.type, cell: (a) => <Badge>{AUDIT_TYPE_LABEL[a.type]}</Badge>, hideBelow: "sm" },
    {
      id: "lanes",
      header: "Lanes",
      hideBelow: "md",
      cell: (a) => (
        <div className="flex gap-1">
          {a.lanes.map((lane) => (
            <Badge key={lane} tone="neutral" title={LANE_LABEL[lane]}>{LANE_SHORT[lane]}</Badge>
          ))}
        </div>
      ),
    },
    { id: "status", header: "Status", sort: (a) => a.status, cell: (a) => <Status kind="audit" value={a.status} /> },
    { id: "started", header: "Started", sort: (a) => a.startedAt, cell: (a) => <span className="tnum whitespace-nowrap">{formatDateTime(a.startedAt)}</span>, hideBelow: "sm" },
    {
      id: "duration",
      header: "Duration",
      sort: (a) => a.durationSeconds,
      cell: (a) => <span className="tnum whitespace-nowrap">{formatMinutes(a.durationSeconds)}{a.provisional ? " so far" : ""}</span>,
      hideBelow: "lg",
    },
    {
      id: "coverage",
      header: "Coverage",
      hideBelow: "lg",
      cell: (a) => (
        <div className="tnum whitespace-nowrap text-xs leading-relaxed text-fg-muted">
          <p>{a.provisional ? `${a.succeededJobs + a.failedJobs} / ${a.plannedJobs} attempted` : `${a.succeededJobs} / ${a.plannedJobs} succeeded`}</p>
          {a.pages ? <p>{a.pages.n} / {a.pages.d} pages</p> : null}
        </div>
      ),
    },
    {
      id: "findings",
      header: "Findings",
      align: "right",
      sort: (a) => a.findingsCreated,
      cell: (a) => <span className="tnum">{a.provisional ? "—" : a.findingsCreated}</span>,
      hideBelow: "md",
    },
    { id: "snapshot", header: "Snapshot", cell: (a) => (a.snapshotId ? <span className="whitespace-nowrap"><Mono>{a.snapshotId}</Mono></span> : <span className="text-fg-subtle">Pending</span>), hideBelow: "xl" },
  ];

  return (
    <DataTable
      label="Audit history"
      data={audits}
      columns={columns}
      rowKey={(a) => a.id}
      defaultSort={{ column: "started", dir: "desc" }}
      searchable={{ placeholder: "Search audits", text: (a) => `${a.title} ${a.id} ${a.createdBy} ${a.snapshotId ?? ""}` }}
      filters={[
        { id: "type", label: "Type", options: [...new Set(audits.map((a) => a.type))].map((t) => ({ value: t, label: AUDIT_TYPE_LABEL[t] })), value: (a) => a.type },
        {
          id: "status",
          label: "Status",
          options: [
            { value: "in_progress", label: "In progress" },
            { value: "completed", label: "Completed" },
            { value: "completed_with_warnings", label: "Completed with warnings" },
            { value: "partially_completed", label: "Partially completed" },
          ],
          value: (a) => a.status,
        },
      ]}
      onRowClick={(a) => router.push(href(a))}
      empty={<EmptyState icon="audit" title="No audits yet" action={<ButtonLink href={`/stores/${storeId}/audits/new`} variant="primary" icon="plus">Start audit</ButtonLink>} />}
    />
  );
}
