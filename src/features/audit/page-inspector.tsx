"use client";

import type { ReactNode } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Callout, KeyValue } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import type { CrawledPage, PageIssue } from "@/types/audit";

import { PAGE_TYPE_LABEL } from "./labels";

export function statusTone(code: number): "success" | "warning" | "danger" {
  return code >= 400 ? "danger" : code >= 300 ? "warning" : "success";
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** One crawled page: crawl facts, metadata, robots/canonical, schema, links, performance and check evidence. */
export function PageInspector({ page, issues }: { page: CrawledPage; issues: PageIssue[] }) {
  const ok = page.status < 400;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={statusTone(page.status)} icon={ok ? "check-circle" : "x-circle"}>HTTP {page.status}</Badge>
        <Badge>{PAGE_TYPE_LABEL[page.type]}</Badge>
        <Badge tone={page.indexable ? "success" : "neutral"} icon={page.indexable ? "check-circle" : "minus-circle"}>{page.indexable ? "Indexable" : "Not indexable"}</Badge>
      </div>

      <Group title="URL and crawl">
        <KeyValue
          columns={2}
          items={[
            { label: "URL", value: <Mono>{page.url}</Mono> },
            { label: "Final URL", value: page.finalUrl ? <Mono>{page.finalUrl}</Mono> : <span className="text-fg-muted">Same as URL</span> },
            { label: "Redirect hops", value: <span className="tnum">{page.redirectHops}</span> },
            { label: "Click depth", value: <span className="tnum">{page.depth}</span> },
            { label: "Content type", value: page.contentType },
            { label: "Size", value: <span className="tnum">{page.sizeKb} KB</span> },
            { label: "Rendering", value: page.rendered ? "JavaScript rendered" : "Raw HTML" },
            { label: "Crawled (UTC)", value: <span className="tnum">{formatDateTime(page.crawledAt)}</span> },
          ]}
        />
      </Group>

      <Group title="Title, description, headings">
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
          <p className="text-[13px] text-fg-muted">No HTML content to read on this response.</p>
        )}
      </Group>

      <Group title="Robots and canonical">
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
                  <span className="text-xs text-fg-muted">{page.canonicalSelf ? "Self-referencing" : "Points elsewhere"}</span>
                </span>
              ) : (
                <span className="text-fg-muted">None declared</span>
              ),
            },
          ]}
        />
      </Group>

      <Group title="Structured data">
        {page.schemaTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {page.schemaTypes.map((t) => (
              <Badge key={t} tone="neutral">{t}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-fg-muted">No JSON-LD found.</p>
        )}
        {page.schemaIssues.map((issue) => (
          <Callout key={issue} tone="danger">{issue}</Callout>
        ))}
      </Group>

      <Group title="Links">
        <KeyValue
          columns={4}
          items={[
            { label: "Inbound", value: <span className="tnum">{page.inlinks}</span> },
            { label: "Internal out", value: <span className="tnum">{page.outInternal}</span> },
            { label: "External out", value: <span className="tnum">{page.outExternal}</span> },
            { label: "Broken", value: <span className="tnum">{page.brokenLinks.length}</span> },
          ]}
        />
        {page.brokenLinks.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {page.brokenLinks.map((l) => (
              <li key={l} className="flex items-center gap-2 text-[13px]">
                <Icon name="x-circle" size={14} className="text-danger" />
                <Mono>{l}</Mono>
              </li>
            ))}
          </ul>
        ) : null}
      </Group>

      <Group title="Performance">
        {page.lab ? (
          <div className="rounded-control border border-line p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <Badge tone="info">Lab</Badge>PageSpeed, simulated mobile
            </p>
            <KeyValue columns={3} items={[{ label: "LCP", value: <span className="tnum">{seconds(page.lab.lcpMs)}</span> }, { label: "CLS", value: <span className="tnum">{page.lab.cls.toFixed(2)}</span> }, { label: "TBT", value: <span className="tnum">{page.lab.tbtMs} ms</span> }]} />
          </div>
        ) : (
          <p className="text-[13px] text-fg-muted">No lab measurement for this response.</p>
        )}
        <div className="rounded-control border border-line p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
            <Badge tone="neutral">Field</Badge>Chrome UX Report, 28 days
          </p>
          {page.field ? (
            <KeyValue columns={3} items={[{ label: "LCP", value: <span className="tnum">{seconds(page.field.lcpMs)}</span> }, { label: "CLS", value: <span className="tnum">{page.field.cls.toFixed(2)}</span> }, { label: "INP", value: <span className="tnum">{page.field.inpMs} ms</span> }]} />
          ) : (
            <p className="text-[13px] text-fg-muted">No field data. Too little traffic for this URL.</p>
          )}
        </div>
      </Group>

      <Group title="Evidence">
        {issues.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No failed or warning checks reference this page.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {issues.map((issue) => (
              <li key={issue.checkId} className="rounded-control border border-line p-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-fg">{issue.name}</p>
                  <Status kind="check" value={issue.status} />
                </div>
                <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-mono text-xs text-fg-muted [overflow-wrap:anywhere]">{issue.snippet}</pre>
              </li>
            ))}
          </ul>
        )}
      </Group>
    </div>
  );
}
