"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useDemoCollection } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { STATUS } from "@/lib/status";
import type { AuditFinding, AuditTaskLink } from "@/types/audit";

import { FINDING_CATEGORY_LABEL, LANE_LABEL } from "./labels";

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "informational"] as const;
const affectedCount = (f: AuditFinding) => f.affectedUrls.length + f.affectedPromptIds.length;
const idOf = (row: { id: string }) => row.id;

const affectedText = (f: AuditFinding) => {
  const urls = f.affectedUrls.length;
  const prompts = f.affectedPromptIds.length;
  return [urls ? `${urls} ${urls === 1 ? "URL" : "URLs"}` : null, prompts ? `${prompts} ${prompts === 1 ? "prompt" : "prompts"}` : null].filter(Boolean).join(" · ") || "Site-wide";
};

/**
 * Findings register of an audit. Statuses and tasks include changes made in Fixes in this browser.
 * A row opens a detail drawer with the evidence trace and the linked Fixes tasks.
 */
export function FindingsTable({ findings, storeId, tasks = [] }: { findings: AuditFinding[]; storeId: string; tasks?: AuditTaskLink[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const { rows: statusRows } = useDemoCollection<AuditFinding>("findings", findings, idOf);
  const { rows: taskRows } = useDemoCollection<AuditTaskLink & { storeId?: string }>("tasks", tasks, idOf);
  const live = useMemo(() => {
    const byId = new Map(statusRows.map((r) => [r.id, r]));
    return findings.map((f) => ({ ...f, status: byId.get(f.id)?.status ?? f.status }));
  }, [findings, statusRows]);
  const open = live.find((f) => f.id === openId) ?? null;
  const tasksFor = (id: string) => taskRows.filter((t) => t.findingId === id);
  const href = (f: AuditFinding) => `/stores/${storeId}/fixes/findings/${f.id}`;

  const columns: Column<AuditFinding>[] = [
    {
      id: "title",
      header: "Finding",
      sort: (f) => f.title,
      cell: (f) => (
        <div className="min-w-0 max-w-[28rem]">
          <p className="font-medium text-fg">{f.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-helper text-fg-subtle">
            {f.id} · {FINDING_CATEGORY_LABEL[f.category]}
            {f.isNew ? <Badge tone="accent">New</Badge> : null}
          </p>
        </div>
      ),
    },
    { id: "severity", header: "Severity", sort: (f) => SEVERITY_ORDER.indexOf(f.severity), cell: (f) => <Status kind="severity" value={f.severity} /> },
    { id: "status", header: "Status", sort: (f) => f.status, cell: (f) => <Status kind="finding" value={f.status} />, hideBelow: "sm" },
    { id: "affected", header: "Affected", sort: affectedCount, cell: (f) => <span className="tnum text-fg-muted">{affectedText(f)}</span>, hideBelow: "md" },
    { id: "open", header: "Open", srOnlyHeader: true, align: "right", cell: (f) => <Link href={href(f)} className="text-label font-medium text-accent-text hover:underline">Fixes</Link> },
  ];

  const present = <T extends string>(values: T[]) => [...new Set(values)];

  return (
    <>
      <DataTable
        label="Findings register"
        data={live}
        columns={columns}
        rowKey={(f) => f.id}
        pageSize={10}
        mobileCards
        defaultSort={{ column: "severity", dir: "asc" }}
        onRowClick={(f) => setOpenId(f.id)}
        rowLabel={(f) => f.title}
        searchable={{ placeholder: "Search findings", text: (f) => `${f.title} ${f.id}` }}
        filters={[
          { id: "severity", label: "Severity", options: SEVERITY_ORDER.filter((s) => live.some((f) => f.severity === s)).map((s) => ({ value: s, label: STATUS.severity[s].label })), value: (f) => f.severity },
          { id: "status", label: "Status", options: present(live.map((f) => f.status)).map((s) => ({ value: s, label: STATUS.finding[s].label })), value: (f) => f.status },
          { id: "category", label: "Category", options: present(live.map((f) => f.category)).map((c) => ({ value: c, label: FINDING_CATEGORY_LABEL[c] })), value: (f) => f.category },
          { id: "lane", label: "Lane", options: present(live.map((f) => f.lane)).map((l) => ({ value: l, label: LANE_LABEL[l] })), value: (f) => f.lane },
        ]}
      />
      <Drawer open={open !== null} onClose={() => setOpenId(null)} title={open?.title ?? "Finding"} description={open ? `${open.id} · ${LANE_LABEL[open.lane]}` : undefined} size="md">
        {open ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Status kind="severity" value={open.severity} />
              <Status kind="finding" value={open.status} />
              <Status kind="confidence" value={open.confidence} />
            </div>
            <KeyValue
              columns={1}
              items={[
                { label: "Expected", value: open.expected },
                { label: "Observed", value: open.actual },
                { label: "Seen", value: <span className="tnum">{open.recurrenceCount} {open.recurrenceCount === 1 ? "time" : "times"}</span> },
              ]}
            />
            {open.affectedUrls.length + open.affectedPromptIds.length > 0 ? (
              <section aria-label="Affected" className="flex flex-col gap-1.5">
                <h3 className="text-helper font-semibold uppercase tracking-wide text-fg-subtle">Affected</h3>
                <ul className="flex flex-col gap-1">
                  {open.affectedUrls.map((u) => (
                    <li key={u}><Mono>{u}</Mono></li>
                  ))}
                  {open.affectedPromptIds.map((p) => (
                    <li key={p}>
                      <Link href={`/stores/${storeId}/prompts/${p}`} className="text-body-sm text-accent-text hover:underline">Prompt {p}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {open.evidenceIds ? (
              <section aria-label="Evidence trace" className="flex flex-col gap-1.5">
                <h3 className="text-helper font-semibold uppercase tracking-wide text-fg-subtle">Evidence trace</h3>
                <EvidenceTrace ids={open.evidenceIds} />
              </section>
            ) : null}
            <section aria-label="Fix tasks" className="flex flex-col gap-1.5">
              <h3 className="text-helper font-semibold uppercase tracking-wide text-fg-subtle">Fix tasks</h3>
              {tasksFor(open.id).length === 0 ? (
                <p className="text-body-sm text-fg-muted">No task yet. Create one from the finding in Fixes.</p>
              ) : (
                <ul className="divide-y divide-line rounded-control border border-line">
                  {tasksFor(open.id).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <Link href={`/stores/${storeId}/fixes/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-body-sm font-medium text-fg hover:underline">{t.title}</Link>
                      <Status kind="task" value={t.status as keyof typeof STATUS.task} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <ButtonLink href={href(open)} variant="primary" trailingIcon="arrow-right" className="self-start">Open in Fixes</ButtonLink>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
