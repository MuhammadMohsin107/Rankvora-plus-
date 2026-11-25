"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { ResponseButton } from "@/features/responses/response-drawer";
import { formatDateTime, formatRate } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { ReportCell, ReportDocument, ReportMetric, ReportTable } from "@/types/shared-records";

/** One row on wide screens whatever the count, so no empty cell is left in the grid. */
const gridCols = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4", 5: "sm:grid-cols-2 xl:grid-cols-5", 6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" } as const;

function MetricView({ metric, versus, hideBasis }: { metric: ReportMetric; versus: string; hideBasis?: boolean }) {
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
      basis={hideBasis ? undefined : metric.basis}
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
      <CardBody className="pb-1.5 pt-1">
        {/* Focusable so a wide table can be scrolled with the keyboard on narrow screens. */}
        <div className="ui-scroll overflow-x-auto" tabIndex={0} role="group" aria-label={`${table.title}, scrollable table`}>
          <table className="tnum w-full border-collapse text-body-sm">
            <caption className="sr-only">{table.title}</caption>
            <thead>
              <tr className="border-b border-line text-fg-subtle">
                {table.columns.map((c) => (
                  <th key={c.id} scope="col" className={`py-1 pr-4 font-medium ${c.align === "right" ? "text-right" : "text-left"}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0">
                  {table.columns.map((c, i) =>
                    i === 0 ? (
                      <th key={c.id} scope="row" className="py-1.5 pr-4 text-left font-normal text-fg">{cellText(row[c.id])}</th>
                    ) : (
                      <td key={c.id} className={`whitespace-nowrap py-1.5 pr-4 text-fg ${c.align === "right" ? "text-right" : ""}`}>{cellText(row[c.id])}</td>
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

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group border-t border-line first-of-type:border-t-0">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-card py-1.5 text-body-sm font-medium text-fg hover:bg-surface-2 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
        {title}
        <span aria-hidden="true" className="text-fg-subtle transition-transform duration-[var(--dur-fast)] group-open:rotate-90">›</span>
      </summary>
      <div className="px-card pb-3">{children}</div>
    </details>
  );
}

/**
 * The report on screen, kept compact: headline metrics, tables, evidence, then scope, limitations and method (closed).
 * Rendered from a ReportDocument; the exports are generated from the same document and keep the full summary.
 * The page shows `note` instead of the summary, so no number is written twice. The version is in the page header.
 */
export function ReportView({ doc }: { doc: ReportDocument }) {
  const versus = doc.type === "comparison" ? "vs baseline" : "vs previous run";
  const metricCols = Math.min(6, Math.max(1, doc.metrics.length)) as keyof typeof gridCols;
  // When every rate rests on the same basis, it is written once under the metrics.
  const rates = doc.metrics.filter((m) => m.n !== null && m.d !== null);
  const sharedBasis = rates.length > 1 && rates.every((m) => m.basis === rates[0].basis) ? rates[0].basis : undefined;
  return (
    <div className="flex flex-col gap-2.5 report-document">
      <Card as="section">
        <h2 className="sr-only">Summary</h2>
        <CardBody className="flex flex-col gap-2 py-3">
          {doc.verdict || doc.note ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {doc.verdict ? <Badge tone={doc.verdict.tone}>{doc.verdict.label}</Badge> : null}
              {doc.note ? <p className="text-body-sm text-fg">{doc.note}</p> : null}
            </div>
          ) : null}
          {doc.metrics.length > 0 ? (
            <div className={`grid grid-cols-[minmax(0,1fr)] gap-px overflow-hidden rounded-control border border-line bg-line ${gridCols[metricCols]}`}>
              {doc.metrics.map((m) => (
                <div key={m.id} className="bg-surface px-3 py-2">
                  <MetricView metric={m} versus={versus} hideBasis={Boolean(sharedBasis)} />
                </div>
              ))}
            </div>
          ) : null}
          <p className="tnum text-helper text-fg-muted">
            {sharedBasis ? `Basis: ${sharedBasis} · ` : ""}
            {doc.coverage.map((c) => `${c.label} ${c.n} of ${c.d} · `).join("")}
            Generated {formatDateTime(doc.generatedAt)} UTC ·{" "}
            <Link href={doc.source.href} className="font-medium text-accent-text hover:underline">{doc.source.label} <Mono>{doc.source.id}</Mono></Link>
          </p>
        </CardBody>
      </Card>

      {doc.tables.map((table) => (
        <TableView key={table.id} table={table} />
      ))}

      {doc.evidence.length > 0 ? (
        <Card as="section">
          <CardHeader title="Evidence" actions={<span className="text-helper text-fg-muted">Original answers are read-only</span>} />
          <CardBody className="pb-3 pt-2">
            <ul className="divide-y divide-line rounded-control border border-line">
              {doc.evidence.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 px-3 py-1.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="max-w-full truncate text-body-sm font-medium text-fg sm:max-w-xl" title={item.title}>{item.title}</p>
                    {item.note ? <p className="text-helper text-fg-muted">{item.note}</p> : null}
                    {item.response ? (
                      <span className="ml-auto">
                        <ResponseButton response={item.response} evidence={item.ids}>View response</ResponseButton>
                      </span>
                    ) : null}
                  </div>
                  <EvidenceTrace ids={item.ids} variant="compact" />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card as="section">
        <h2 className="sr-only">Scope and method</h2>
        <div className="overflow-hidden rounded-card">
          <Details title={`Limitations (${doc.limitations.length})`}>
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
