import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { SplitLayout } from "@/components/shell/page-header";
import { cn } from "@/lib/cn";
import type { ReportStatus, ReportType } from "@/types/comparison";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  if (status === "ready") return <Badge tone="success" icon="check-circle">Ready</Badge>;
  if (status === "generating") return <Badge tone="accent" icon="loader">Generating</Badge>;
  return <Badge tone="danger" icon="x-circle">Failed</Badge>;
}

const typeMeta = {
  audit: { label: "Audit", icon: "audit" },
  monitoring: { label: "Monitoring", icon: "monitoring" },
  comparison: { label: "Comparison", icon: "compare" },
} as const;

export function ReportTypeBadge({ type }: { type: ReportType }) {
  return <Badge tone="neutral" icon={typeMeta[type].icon}>{typeMeta[type].label}</Badge>;
}

export const reportTypeLabel = (type: ReportType) => typeMeta[type].label;

/** A numbered report section with an anchor, so the contents list can link to it. */
export function ReportSection({ id, number, title, subtitle, info, actions, children }: { id: string; number: number; title: string; subtitle?: string; info?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24">
      <Card as="section">
        <CardHeader title={`${number}. ${title}`} subtitle={subtitle} info={info} actions={actions} />
        <CardBody className="flex flex-col gap-4">{children}</CardBody>
      </Card>
    </div>
  );
}

const stripColumns = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" } as const;

/** MetricGrid with a fixed column count (use with MetricCell). */
export function MetricStrip({ columns, children }: { columns: 2 | 3 | 4; children: ReactNode }) {
  return <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-card border border-line bg-line shadow-card", stripColumns[columns])}>{children}</div>;
}

/** Limitations are always present, in every report type. */
export function Limitations({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] text-fg-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export type SourceLink = { label: string; id: string; href: string };

export function SourceLinks({ sources }: { sources: SourceLink[] }) {
  return (
    <ul className="divide-y divide-line rounded-control border border-line">
      {sources.map((source) => (
        <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-xs text-fg-subtle">{source.label}</span>
          <Link href={source.href} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-text hover:underline">
            <Mono>{source.id}</Mono>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Report page frame: sections in the main column, the contents list on the side. Provenance lives in the last section. */
export function ReportFrame({ sections, children }: { sections: { id: string; title: string }[]; children: ReactNode }) {
  return (
    <SplitLayout
      main={children}
      aside={
        <div className="xl:sticky xl:top-36 xl:self-start">
          <Card>
            <CardHeader title="On this page" as="h3" />
            <CardBody className="pt-2">
              <nav aria-label="Report sections">
                <ol className="flex flex-col gap-0.5">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="flex items-baseline gap-2 rounded px-1.5 py-1 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
                        <span className="tnum w-4 shrink-0 text-xs text-fg-subtle">{index + 1}</span>
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </CardBody>
          </Card>
        </div>
      }
    />
  );
}
