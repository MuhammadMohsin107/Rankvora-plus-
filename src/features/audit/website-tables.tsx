"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import type { CrawledPage, PageIssue, WebsiteCheck } from "@/types/audit";

import { CHECK_GROUP_LABEL, CHECK_KIND_LABEL, PAGE_TYPE_LABEL } from "./labels";
import { PageInspector, statusTone } from "./page-inspector";

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function ChecksTable({ checks, storeId }: { checks: WebsiteCheck[]; storeId: string }) {
  const [open, setOpen] = useState<WebsiteCheck | null>(null);
  const groups = [...new Set(checks.map((c) => c.group))];

  const columns: Column<WebsiteCheck>[] = [
    { id: "group", header: "Group", sort: (c) => groups.indexOf(c.group), cell: (c) => <span className="whitespace-nowrap text-fg-muted">{CHECK_GROUP_LABEL[c.group]}</span>, hideBelow: "md" },
    {
      id: "name",
      header: "Check",
      sort: (c) => c.name,
      cell: (c) => (
        <div className="min-w-0 max-w-[26rem]">
          <p className="text-[13px] font-medium text-fg">{c.name}</p>
          <p className="text-xs text-fg-subtle md:hidden">{CHECK_GROUP_LABEL[c.group]}</p>
        </div>
      ),
    },
    { id: "kind", header: "Lane metric", sort: (c) => c.kind, cell: (c) => <Badge>{CHECK_KIND_LABEL[c.kind]}</Badge>, hideBelow: "lg" },
    { id: "status", header: "Result", sort: (c) => c.status, cell: (c) => <Status kind="check" value={c.status} /> },
    {
      id: "affected",
      header: "Affected",
      align: "right",
      sort: (c) => c.affected,
      cell: (c) => <span className="tnum whitespace-nowrap text-fg-muted">{c.affected === null ? "Site-wide" : `${c.affected} ${c.affected === 1 ? "page" : "pages"}`}</span>,
      hideBelow: "sm",
    },
    { id: "evidence", header: "Evidence", srOnlyHeader: true, align: "right", cell: (c) => <Button variant="ghost" size="sm" onClick={() => setOpen(c)}>Evidence</Button> },
  ];

  return (
    <>
      <DataTable
        label="Website checks"
        data={checks}
        columns={columns}
        rowKey={(c) => c.id}
        pageSize={10}
        defaultSort={{ column: "group", dir: "asc" }}
        searchable={{ placeholder: "Search checks", text: (c) => `${c.name} ${CHECK_GROUP_LABEL[c.group]}` }}
        filters={[
          { id: "group", label: "Group", options: groups.map((g) => ({ value: g, label: CHECK_GROUP_LABEL[g] })), value: (c) => c.group },
          { id: "kind", label: "Lane metric", options: [{ value: "technical", label: "Technical" }, { value: "content", label: "Content quality" }], value: (c) => c.kind },
          {
            id: "status",
            label: "Result",
            options: [...new Set(checks.map((c) => c.status))].map((s) => ({ value: s, label: s.replace(/_/g, " ").replace(/^./, (m) => m.toUpperCase()) })),
            value: (c) => c.status,
          },
        ]}
        onRowClick={(c) => setOpen(c)}
        mobileCards
        rowLabel={(c) => c.name}
        empty={<EmptyState icon="audit" title="No checks in this audit" />}
      />
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open?.name ?? "Check"} description={open ? CHECK_GROUP_LABEL[open.group] : undefined} size="md">
        {open ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Status kind="check" value={open.status} />
              <Badge>{CHECK_KIND_LABEL[open.kind]}</Badge>
              <Badge tone="neutral">{open.affected === null ? "Site-wide" : `${open.affected} affected`}</Badge>
            </div>
            <section aria-label="Evidence">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Evidence · {open.evidence.label}</h3>
              <pre className="whitespace-pre-wrap break-words rounded-control border border-line bg-surface-2/60 p-3 font-mono text-xs text-fg [overflow-wrap:anywhere]">{open.evidence.snippet}</pre>
            </section>
            {open.affectedPaths.length > 0 ? (
              <section aria-label="Affected pages">
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Examples</h3>
                <ul className="flex flex-col gap-1">
                  {open.affectedPaths.map((p) => (
                    <li key={p}><Mono>{p}</Mono></li>
                  ))}
                </ul>
              </section>
            ) : null}
            {open.status === "not_assessed" || open.status === "inconclusive" || open.status === "blocked" || open.status === "error" ? (
              <Callout tone="info">No determinate result, so it counts against check coverage, not toward a pass rate.</Callout>
            ) : null}
            {open.findingId ? (
              <Link href={`/stores/${storeId}/fixes/findings/${open.findingId}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                Open finding {open.findingId}
              </Link>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

const statusClass = (code: number) => (code >= 500 ? "5xx" : code >= 400 ? "4xx" : code >= 300 ? "3xx" : "2xx");

const noSubscribe = () => () => {};
const pageParam = () => new URLSearchParams(window.location.search).get("page");

export function PagesTable({ pages, issues, storeId }: { pages: CrawledPage[]; issues: Record<string, PageIssue[]>; storeId: string }) {
  // A link with ?page=<url or path> (from a finding's evidence) opens that page's inspector. Once a person opens or closes one, their choice wins.
  const linked = useSyncExternalStore(noSubscribe, pageParam, () => null);
  const [picked, setOpen] = useState<CrawledPage | null | undefined>(undefined);
  const open = picked !== undefined ? picked : linked ? (pages.find((p) => p.url === linked || p.finalUrl === linked || p.path === linked) ?? null) : null;

  const columns: Column<CrawledPage>[] = [
    {
      id: "path",
      header: "Page",
      sort: (p) => p.path,
      cell: (p) => (
        <div className="min-w-0 max-w-[20rem]">
          <p className="truncate font-mono text-xs text-fg" title={p.url}>{p.path}</p>
          <p className="text-xs text-fg-subtle">{PAGE_TYPE_LABEL[p.type]}</p>
        </div>
      ),
    },
    { id: "status", header: "HTTP", sort: (p) => p.status, cell: (p) => <Badge tone={statusTone(p.status)}><span className="tnum">{p.status}</span></Badge> },
    {
      id: "indexable",
      header: "Indexing",
      sort: (p) => Number(p.indexable),
      cell: (p) => (p.indexable ? <Badge tone="success" icon="check-circle">Indexable</Badge> : <Badge tone="neutral" icon="minus-circle">Not indexable</Badge>),
      hideBelow: "sm",
    },
    { id: "title", header: "Title", cell: (p) => <span className="block max-w-[18rem] truncate text-fg-muted" title={p.title ?? undefined}>{p.title ?? "—"}</span>, hideBelow: "lg" },
    {
      id: "schema",
      header: "Schema",
      hideBelow: "xl",
      cell: (p) =>
        p.schemaTypes.length ? (
          <span className="text-xs text-fg-muted">
            {p.schemaTypes.slice(0, 2).join(", ")}
            {p.schemaTypes.length > 2 ? ` +${p.schemaTypes.length - 2}` : ""}
          </span>
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      id: "lcp",
      header: "LCP (lab)",
      align: "right",
      sort: (p) => p.lab?.lcpMs ?? null,
      hideBelow: "md",
      cell: (p) => (p.lab ? <span className="tnum whitespace-nowrap" title={p.field ? "Field data is also available in the inspector" : "No field data for this URL"}>{(p.lab.lcpMs / 1000).toFixed(1)} s</span> : <span className="text-fg-subtle">—</span>),
    },
    {
      id: "issues",
      header: "Issues",
      align: "right",
      sort: (p) => issues[p.id]?.length ?? 0,
      cell: (p) => {
        const n = issues[p.id]?.length ?? 0;
        return n > 0 ? <Badge tone="warning" icon="alert-triangle">{n}</Badge> : <span className="text-fg-subtle">None</span>;
      },
    },
    { id: "inspect", header: "Inspect", srOnlyHeader: true, align: "right", cell: (p) => <Button variant="ghost" size="sm" onClick={() => setOpen(p)}>Inspect</Button> },
  ];

  return (
    <>
      <DataTable
        label="Crawled pages"
        data={pages}
        columns={columns}
        rowKey={(p) => p.id}
        pageSize={10}
        defaultSort={{ column: "path", dir: "asc" }}
        searchable={{ placeholder: "Search pages", text: (p) => `${p.path} ${p.title ?? ""}` }}
        filters={[
          { id: "type", label: "Page type", options: [...new Set(pages.map((p) => p.type))].map((t) => ({ value: t, label: PAGE_TYPE_LABEL[t] })), value: (p) => p.type },
          { id: "http", label: "HTTP", options: [...new Set(pages.map((p) => statusClass(p.status)))].sort().map((c) => ({ value: c, label: c })), value: (p) => statusClass(p.status) },
          { id: "indexing", label: "Indexing", options: [{ value: "yes", label: "Indexable" }, { value: "no", label: "Not indexable" }], value: (p) => (p.indexable ? "yes" : "no") },
          { id: "issues", label: "Issues", options: [{ value: "with", label: "With issues" }, { value: "none", label: "No issues" }], value: (p) => ((issues[p.id]?.length ?? 0) > 0 ? "with" : "none") },
        ]}
        onRowClick={(p) => setOpen(p)}
        mobileCards
        rowLabel={(p) => p.path}
        empty={<EmptyState icon="globe" title="No pages crawled yet" />}
      />
      <Drawer open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? open?.path ?? "Page"} size="lg">
        {open ? <PageInspector page={open} issues={issues[open.id] ?? []} storeId={storeId} /> : null}
      </Drawer>
    </>
  );
}
