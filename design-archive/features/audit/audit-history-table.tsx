"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { SimulatedBadge } from "@/components/ui/demo";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { AuditRow } from "@/types/audit";

import { AUDIT_TYPE_LABEL, LANE_LABEL, LANE_SHORT, STATUS_ORDER } from "./labels";
import { useAudits } from "./use-audits";

/** Audit history: seeded audits and audits created here, with live status. Filters: type, status, lane. */
export function AuditHistoryTable({ seeded, storeId }: { seeded: AuditRow[]; storeId: string }) {
  const router = useRouter();
  const { live } = useAudits(storeId, seeded);
  const href = (a: AuditRow) => `/stores/${storeId}/audits/${a.id}`;
  const statuses = useMemo(() => STATUS_ORDER.filter((s) => live.some((a) => a.status === s)), [live]);

  const columns: Column<AuditRow>[] = [
    {
      id: "title",
      header: "Audit",
      sort: (a) => a.title,
      cell: (a) => (
        <div className="min-w-0">
          <Link href={href(a)} className="font-medium text-fg hover:underline">{a.title}</Link>
          <p className="flex items-center gap-1.5 text-helper text-fg-subtle">{a.id} · {a.createdBy}{a.simulated ? <SimulatedBadge /> : null}</p>
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
    {
      id: "status",
      header: "Status",
      sort: (a) => STATUS_ORDER.indexOf(a.status),
      cell: (a) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Status kind="audit" value={a.status} />
          {a.paused && !a.snapshotId ? <Badge tone="warning" icon="pause">Paused</Badge> : null}
        </span>
      ),
    },
    { id: "started", header: "Started", sort: (a) => a.startedAt, cell: (a) => <span className="tnum whitespace-nowrap">{formatDateTime(a.startedAt)}</span>, hideBelow: "sm" },
    {
      id: "coverage",
      header: "Coverage",
      hideBelow: "lg",
      cell: (a) => (
        <span className="tnum whitespace-nowrap text-helper text-fg-muted" title={a.snapshotId ?? "No snapshot"}>
          {a.status === "draft" ? "Not started" : `${a.succeededJobs + (a.provisional ? a.failedJobs : 0)}/${a.plannedJobs} ${a.provisional ? "attempted" : "returned"}`}
          {a.pages ? ` · ${a.pages.n}/${a.pages.d} pages` : ""}
        </span>
      ),
    },
    { id: "findings", header: "Findings", align: "right", sort: (a) => a.findingsCreated, cell: (a) => <span className="tnum">{a.provisional || !a.snapshotId ? "—" : a.findingsCreated}</span>, hideBelow: "md" },
  ];

  return (
    <DataTable
      label="Audit history"
      data={live}
      columns={columns}
      rowKey={(a) => a.id}
      defaultSort={{ column: "started", dir: "desc" }}
      mobileCards
      rowLabel={(a) => a.title}
      searchable={{ placeholder: "Search audits", text: (a) => `${a.title} ${a.id} ${a.createdBy} ${a.snapshotId ?? ""}` }}
      filters={[
        { id: "type", label: "Type", options: [...new Set(live.map((a) => a.type))].map((t) => ({ value: t, label: AUDIT_TYPE_LABEL[t] })), value: (a) => a.type },
        { id: "status", label: "Status", options: statuses.map((s) => ({ value: s, label: STATUS.audit[s].label })), value: (a) => a.status },
        { id: "lane", label: "Lane", options: [{ value: "ai_visibility", label: LANE_LABEL.ai_visibility }, { value: "website_readiness", label: LANE_LABEL.website_readiness }], value: (a) => a.lanes },
      ]}
      onRowClick={(a) => router.push(href(a))}
      empty={<EmptyState icon="audit" title="No audits match" />}
    />
  );
}
