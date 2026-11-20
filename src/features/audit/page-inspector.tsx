"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Callout, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import type { CrawledPage, PageIssue } from "@/types/audit";

import { PAGE_TYPE_LABEL } from "./labels";

export function statusTone(code: number): "success" | "warning" | "danger" {
  return code >= 400 ? "danger" : code >= 300 ? "warning" : "success";
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Short excerpt assembled from what the crawl read: headline, description and section headings. */
export function contentPreview(page: CrawledPage): string {
  if (!page.title) return "No HTML content to read on this response.";
  const parts = [page.h1[0] ?? page.title, page.metaDescription ?? "", page.h2.length > 0 ? `Sections: ${page.h2.join(", ")}.` : "", `About ${page.words} words.`];
  return parts.filter(Boolean).join(" ");
}

function Pane({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 pt-4">{children}</div>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h3 className="text-helper font-semibold uppercase tracking-wide text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

/** One crawled page, in tabs: Overview, Metadata, Technical, Structured data, Performance, Evidence. */
export function PageInspector({ page, issues, storeId }: { page: CrawledPage; issues: PageIssue[]; storeId?: string }) {
  const ok = page.status < 400;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusTone(page.status)} icon={ok ? "check-circle" : "x-circle"}>HTTP {page.status}</Badge>
        <Badge>{PAGE_TYPE_LABEL[page.type]}</Badge>
        <Badge tone={page.indexable ? "success" : "neutral"} icon={page.indexable ? "check-circle" : "minus-circle"}>{page.indexable ? "Indexable" : "Not indexable"}</Badge>
        {issues.length > 0 ? <Badge tone="warning" icon="alert-triangle">{issues.length} {issues.length === 1 ? "issue" : "issues"}</Badge> : null}
      </div>
      <Tabs
        label="Page details"
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <Pane>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "URL", value: <Mono>{page.url}</Mono> },
                    { label: "Final URL", value: page.finalUrl ? <Mono>{page.finalUrl}</Mono> : <span className="text-fg-muted">Same as URL</span> },
                    { label: "Crawled (UTC)", value: <span className="tnum">{formatDateTime(page.crawledAt)}</span> },
                  ]}
                />
                <Group title="Content preview">
                  <p className="rounded-control border border-line bg-surface-2 p-3 text-body-sm text-fg">{contentPreview(page)}</p>
                </Group>
                <Group title="Performance summary">
                  <p className="tnum text-body-sm text-fg">
                    {page.lab ? `Lab LCP ${seconds(page.lab.lcpMs)} · CLS ${page.lab.cls.toFixed(2)}` : "No lab measurement"} · {page.field ? `field LCP ${seconds(page.field.lcpMs)}` : "no field data"}
                  </p>
                </Group>
              </Pane>
            ),
          },
          {
            id: "metadata",
            label: "Metadata",
            content: (
              <Pane>
                {page.title ? (
                  <KeyValue
                    columns={1}
                    items={[
                      { label: `Title · ${page.title.length} characters`, value: page.title },
                      { label: page.metaDescription ? `Meta description · ${page.metaDescription.length} characters` : "Meta description", value: page.metaDescription ?? <Badge tone="warning" icon="alert-triangle">Missing</Badge> },
                      { label: "H1", value: page.h1.length ? page.h1.join(" · ") : <span className="text-fg-muted">None</span> },
                      { label: "H2", value: page.h2.length ? page.h2.join(" · ") : <span className="text-fg-muted">None</span> },
                      { label: "Words", value: <span className="tnum">{page.words}</span> },
                    ]}
                  />
                ) : (
                  <p className="text-body-sm text-fg-muted">No HTML content to read on this response.</p>
                )}
              </Pane>
            ),
          },
          {
            id: "technical",
            label: "Technical",
            content: (
              <Pane>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "Meta robots", value: page.metaRobots ?? <span className="text-fg-muted">Not set</span> },
                    { label: "X-Robots-Tag", value: page.xRobots ?? <span className="text-fg-muted">Not set</span> },
                    {
                      label: "Canonical",
                      value: page.canonical ? (
                        <span className="flex flex-col gap-1">
                          <Mono>{page.canonical}</Mono>
                          <span className="text-helper text-fg-muted">{page.canonicalSelf ? "Self-referencing" : "Points elsewhere"}</span>
                        </span>
                      ) : (
                        <span className="text-fg-muted">None declared</span>
                      ),
                    },
                    { label: "Redirect hops · click depth", value: <span className="tnum">{page.redirectHops} · {page.depth}</span> },
                    { label: "Rendering", value: page.rendered ? "JavaScript rendered" : "Raw HTML" },
                  ]}
                />
                <Group title="Internal links">
                  <KeyValue columns={3} items={[{ label: "Inbound", value: <span className="tnum">{page.inlinks}</span> }, { label: "Out, internal", value: <span className="tnum">{page.outInternal}</span> }, { label: "Out, external", value: <span className="tnum">{page.outExternal}</span> }]} />
                  {page.brokenLinks.length > 0 ? (
                    <ul className="flex flex-col gap-1">
                      {page.brokenLinks.map((l) => (
                        <li key={l} className="flex items-center gap-2 text-body-sm">
                          <Icon name="x-circle" size={14} className="text-danger-icon" />
                          <Mono>{l}</Mono>
                          <span className="text-helper text-fg-muted">broken</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Group>
              </Pane>
            ),
          },
          {
            id: "schema",
            label: "Structured data",
            content: (
              <Pane>
                {page.schemaTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {page.schemaTypes.map((t) => (
                      <Badge key={t} tone="neutral">{t}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-body-sm text-fg-muted">No JSON-LD found.</p>
                )}
                {page.schemaTypes.length > 0 ? (
                  <KeyValue columns={1} items={[{ label: "Matches visible content", value: page.schemaIssues.length === 0 ? <Badge tone="success" icon="check-circle">Yes</Badge> : <Badge tone="danger" icon="x-circle">No, see issues</Badge> }]} />
                ) : null}
                {page.schemaIssues.map((issue) => (
                  <Callout key={issue} tone="danger">{issue}</Callout>
                ))}
                <p className="text-helper text-fg-muted">Valid markup does not guarantee rich results. Check the live page with Google&apos;s Rich Results Test.</p>
              </Pane>
            ),
          },
          {
            id: "performance",
            label: "Performance",
            content: (
              <Pane>
                <Group title="Lab · PageSpeed, simulated mobile">
                  {page.lab ? <KeyValue columns={3} items={[{ label: "LCP", value: <span className="tnum">{seconds(page.lab.lcpMs)}</span> }, { label: "CLS", value: <span className="tnum">{page.lab.cls.toFixed(2)}</span> }, { label: "TBT", value: <span className="tnum">{page.lab.tbtMs} ms</span> }]} /> : <p className="text-body-sm text-fg-muted">No lab measurement for this response.</p>}
                </Group>
                <Group title="Field · Chrome UX Report, 28 days">
                  {page.field ? <KeyValue columns={3} items={[{ label: "LCP", value: <span className="tnum">{seconds(page.field.lcpMs)}</span> }, { label: "CLS", value: <span className="tnum">{page.field.cls.toFixed(2)}</span> }, { label: "INP", value: <span className="tnum">{page.field.inpMs} ms</span> }]} /> : <p className="text-body-sm text-fg-muted">No field data. Too little traffic for this URL.</p>}
                </Group>
              </Pane>
            ),
          },
          {
            id: "evidence",
            label: `Evidence (${issues.length})`,
            content: (
              <Pane>
                {issues.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">No failed or warning checks reference this page.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {issues.map((issue) => (
                      <li key={issue.checkId} className="rounded-control border border-line p-3">
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-body-sm font-medium text-fg">{issue.name}</p>
                          <Status kind="check" value={issue.status} />
                        </div>
                        <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-mono text-xs text-fg-muted [overflow-wrap:anywhere]">{issue.snippet}</pre>
                        {issue.findingId && storeId ? (
                          <Link href={`/stores/${storeId}/fixes/findings/${issue.findingId}`} className="mt-2 inline-flex items-center gap-1 text-label font-medium text-accent-text hover:underline">
                            Open finding {issue.findingId}
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Pane>
            ),
          },
        ]}
      />
    </div>
  );
}
