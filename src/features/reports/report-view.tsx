"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, KeyValue, Metric, MetricCell } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { ResponseButton } from "@/features/responses/response-drawer";
import { formatDateTime, formatRate } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { ReportCell, ReportDocument, ReportMetric, ReportTable } from "@/types/shared-records";

const gridCols = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" } as const;

function MetricView({ metric, versus }: { metric: ReportMetric; versus: string }) {
  if (metric.n === null) return <Metric label={metric.label} value="N/A" naReason={metric.naReason ?? "Not available"} />;
  if (metric.d === null) return <Metric label={metric.label} value={String(metric.n)} />;
  const previous = metric.previous;
  const change = previous && previous.d > 0 && metric.d > 0 ? pointChange(previous, { n: metric.n, d: metric.d }) : null;
  return (
    <Metric
      label={metric.label}
      numerator={metric.n}
      denominator={metric.d}
      unit={metric.unit}
      basis={metric.basis}
      delta={change !== null ? { points: change, versus } : undefined}
    />
  );
}

const cellText = (cell: ReportCell | undefined) => {
  if (cell === null || cell === undefined) return "N/A";
  if (typeof cell === "object") return cell.d === 0 ? "N/A" : `${cell.n} / ${cell.d} (${formatRate(cell.n, cell.d)})`;
  return String(cell);
};

function TableView({ table }: { table: ReportTable }) {
  return (
    <Card as="section">
      <CardHeader title={table.title} />
      <CardBody className="pt-0">
        <div className="ui-scroll overflow-x-auto">
          <table className="tnum w-full border-collapse text-body-sm">
            <caption className="sr-only">{table.title}</caption>
            <thead>
              <tr className="border-b border-line text-fg-subtle">
                {table.columns.map((c) => (
                  <th key={c.id} scope="col" className={`py-1.5 pr-4 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0">
                  {table.columns.map((c, i) =>
                    i === 0 ? (
                      <th key={c.id} scope="row" className="py-2 pr-4 text-left font-normal text-fg">{cellText(row[c.id])}</th>
                    ) : (
                      <td key={c.id} className={`whitespace-nowrap py-2 pr-4 text-fg ${c.align === "right" ? "text-right" : ""}`}>{cellText(row[c.id])}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

function Details({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-line first:border-t-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-card py-2 text-body-sm font-medium text-fg hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-fg-subtle transition-transform duration-[var(--dur-fast)] group-open:rotate-90">›</span>
      </summary>
      <div className="px-card pb-4">{children}</div>
    </details>
  );
}

/**
 * The report on screen: summary and headline metrics, tables, evidence, then scope, limitations and method.
 * Rendered from a ReportDocument; the exports are generated from the same document.
 */
export function ReportView({ doc }: { doc: ReportDocument }) {
  const versus = doc.type === "comparison" ? "vs baseline" : "vs previous run";
  const metricCols = Math.min(4, Math.max(1, doc.metrics.length)) as 1 | 2 | 3 | 4;
  return (
    <div className="flex flex-col gap-5 report-document">
      <Card as="section">
        <CardHeader title="Summary" actions={doc.verdict ? <Badge tone={doc.verdict.tone}>{doc.verdict.label}</Badge> : undefined} />
        <CardBody className="flex flex-col gap-4 pt-0">
          <ul className="flex flex-col gap-1 text-body text-fg">
            {doc.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {doc.metrics.length > 0 ? (
            <div className={`grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-card border border-line bg-line ${gridCols[metricCols]}`}>
              {doc.metrics.map((m) => (
                <MetricCell key={m.id}>
                  <MetricView metric={m} versus={versus} />
                </MetricCell>
              ))}
            </div>
          ) : null}
          {doc.coverage.length > 0 ? (
            <p className="tnum text-helper text-fg-muted">
              {doc.coverage.map((c) => `${c.label} ${c.n} of ${c.d}`).join(" · ")}
            </p>
          ) : null}
          <p className="tnum text-helper text-fg-subtle">
            Generated {formatDateTime(doc.generatedAt)} UTC · {doc.version} ·{" "}
            <Link href={doc.source.href} className="font-medium text-accent-text hover:underline">{doc.source.label} <Mono>{doc.source.id}</Mono></Link>
          </p>
        </CardBody>
      </Card>

      {doc.tables.map((table) => (
        <TableView key={table.id} table={table} />
      ))}

      {doc.evidence.length > 0 ? (
        <Card as="section">
          <CardHeader title="Evidence" subtitle="Original answers are read-only" />
          <CardBody className="pt-0">
            <ul className="divide-y divide-line rounded-control border border-line">
              {doc.evidence.map((item) => (
                <li key={item.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="max-w-xl truncate text-body-sm font-medium text-fg" title={item.title}>{item.title}</p>
                      {item.note ? <p className="text-helper text-fg-muted">{item.note}</p> : null}
                    </div>
                    {item.response ? <ResponseButton response={item.response} evidence={item.ids}>View response</ResponseButton> : null}
                  </div>
                  <EvidenceTrace ids={item.ids} variant="compact" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card as="section">
        <CardHeader title="Scope and method" />
        <div>
          <Details title="Limitations" open>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body-sm text-fg-muted">
              {doc.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Details>
          <Details title="Scope">
            <KeyValue columns={2} items={doc.scope.map((s) => ({ label: s.label, value: <span className="tnum">{s.value}</span> }))} />
          </Details>
          <Details title="Methodology and version">
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body-sm text-fg-muted">
              {doc.methodology.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {doc.source.snapshotIds.length > 0 ? <p className="mt-2 text-helper text-fg-subtle">Snapshots: {doc.source.snapshotIds.join(", ")}</p> : null}
          </Details>
        </div>
      </Card>
    </div>
  );
}
