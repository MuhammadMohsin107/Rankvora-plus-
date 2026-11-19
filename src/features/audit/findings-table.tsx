"use client";

import Link from "next/link";

import { Badge, Status } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/table";
import { STATUS } from "@/lib/status";
import type { AuditFinding } from "@/types/audit";

import { FINDING_CATEGORY_LABEL } from "./labels";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"] as const;
const affectedCount = (f: AuditFinding) => f.affectedUrls.length + f.affectedPromptIds.length;

/** Findings register at the audit snapshot. Each row opens the shared finding detail in Fixes. */
export function FindingsTable({ findings, storeId }: { findings: AuditFinding[]; storeId: string }) {
  const href = (f: AuditFinding) => `/stores/${storeId}/fixes/findings/${f.id}`;
  const columns: Column<AuditFinding>[] = [
    {
      id: "title",
      header: "Finding",
      sort: (f) => f.title,
      cell: (f) => (
        <div className="min-w-0 max-w-[28rem]">
          <Link href={href(f)} className="font-medium text-fg hover:underline">{f.title}</Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
            {f.id}
            {f.isNew ? <Badge tone="accent">New in this audit</Badge> : null}
          </p>
        </div>
      ),
    },
    { id: "category", header: "Category", sort: (f) => f.category, cell: (f) => <span className="whitespace-nowrap text-fg-muted">{FINDING_CATEGORY_LABEL[f.category]}</span>, hideBelow: "md" },
    { id: "severity", header: "Severity", sort: (f) => SEVERITY_ORDER.indexOf(f.severity), cell: (f) => <Status kind="severity" value={f.severity} /> },
    { id: "priority", header: "Priority", sort: (f) => f.priority, cell: (f) => <Status kind="priority" value={f.priority} />, hideBelow: "lg" },
    { id: "confidence", header: "Confidence", sort: (f) => ["high", "medium", "low"].indexOf(f.confidence), cell: (f) => <Status kind="confidence" value={f.confidence} />, hideBelow: "xl" },
    { id: "status", header: "Status", sort: (f) => f.status, cell: (f) => <Status kind="finding" value={f.status} />, hideBelow: "sm" },
    {
      id: "affected",
      header: "Affected",
      align: "right",
      sort: affectedCount,
      cell: (f) => {
        const urls = f.affectedUrls.length;
        const prompts = f.affectedPromptIds.length;
        return (
          <span className="tnum whitespace-nowrap text-fg-muted">
            {[urls ? `${urls} ${urls === 1 ? "URL" : "URLs"}` : null, prompts ? `${prompts} ${prompts === 1 ? "prompt" : "prompts"}` : null].filter(Boolean).join(" · ") || "—"}
          </span>
        );
      },
      hideBelow: "md",
    },
  ];

  return (
    <DataTable
      label="Findings register"
      data={findings}
      columns={columns}
      rowKey={(f) => f.id}
      pageSize={10}
      defaultSort={{ column: "severity", dir: "asc" }}
      searchable={{ placeholder: "Search findings", text: (f) => `${f.title} ${f.id}` }}
      filters={[
        { id: "severity", label: "Severity", options: SEVERITY_ORDER.filter((s) => findings.some((f) => f.severity === s)).map((s) => ({ value: s, label: STATUS.severity[s].label })), value: (f) => f.severity },
        { id: "category", label: "Category", options: [...new Set(findings.map((f) => f.category))].map((c) => ({ value: c, label: FINDING_CATEGORY_LABEL[c] })), value: (f) => f.category },
        { id: "status", label: "Status", options: [...new Set(findings.map((f) => f.status))].map((s) => ({ value: s, label: STATUS.finding[s].label })), value: (f) => f.status },
        { id: "new", label: "Origin", options: [{ value: "new", label: "New in this audit" }, { value: "existing", label: "Existing" }], value: (f) => (f.isNew ? "new" : "existing") },
      ]}
    />
  );
}
