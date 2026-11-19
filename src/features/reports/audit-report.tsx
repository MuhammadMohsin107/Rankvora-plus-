import Link from "next/link";

import { Badge, Status } from "@/components/ui/badge";
import { Card, CardBody, KeyValue, Metric, MetricCell } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { ResponseButton } from "@/features/responses/response-inspector";
import { Limitations, MetricStrip, ReportFrame, ReportSection, SourceLinks } from "@/features/reports/report-parts";
import { formatDateTime } from "@/lib/format";
import { humanize, type StatusValue } from "@/lib/status";
import type { AuditReportData, ReportRecord } from "@/types/comparison";

const SECTIONS = [
  { id: "summary", title: "Executive summary" },
  { id: "scope", title: "Scope and methodology" },
  { id: "ai", title: "AI visibility" },
  { id: "website", title: "Website readiness" },
  { id: "findings", title: "Findings" },
  { id: "tasks", title: "Recommendations and tasks" },
  { id: "evidence", title: "Evidence" },
  { id: "limitations", title: "Limitations" },
  { id: "sources", title: "Sources and versions" },
];

export function AuditReport({ report, data, storeId, limitations }: { report: ReportRecord; data: AuditReportData; storeId: string; limitations: string[] }) {
  const { audit } = data;
  const sources = [
    { label: "Audit", id: audit.id, href: `/stores/${storeId}/audits/${audit.id}` },
    ...(audit.snapshotId ? [{ label: "Snapshot", id: audit.snapshotId, href: `/stores/${storeId}/audits/${audit.id}` }] : []),
  ];

  return (
    <ReportFrame report={report} sections={SECTIONS} sources={sources}>
      <ReportSection id="summary" number={1} title="Executive summary" subtitle="Successful, eligible responses only">
        <MetricStrip columns={3}>
          <MetricCell>
            <Metric label="Brand mention rate" numerator={audit.mention?.n} denominator={audit.mention?.d} naReason={audit.mention ? undefined : "No completed analysis"} basis="API answer samples" />
          </MetricCell>
          <MetricCell>
            <Metric label="Recommendation rate" numerator={audit.recommendation?.n} denominator={audit.recommendation?.d} naReason={audit.recommendation ? undefined : "No completed analysis"} basis="API answer samples" />
          </MetricCell>
          <MetricCell>
            <Metric label="Pages assessed" numerator={audit.pages?.n} denominator={audit.pages?.d} unit="in-scope pages" naReason={audit.pages ? undefined : "No website lane"} basis="website readiness" />
          </MetricCell>
        </MetricStrip>
      </ReportSection>

      <ReportSection id="scope" number={2} title="Scope and methodology">
        <KeyValue
          columns={2}
          items={[
            { label: "Audit type", value: humanize(audit.type) },
            { label: "Assessment lanes", value: "AI visibility · Website readiness (reported separately)" },
            { label: "Started", value: <span className="tnum">{formatDateTime(audit.startedAt)} UTC</span> },
            { label: "Completed", value: <span className="tnum">{audit.completedAt ? `${formatDateTime(audit.completedAt)} UTC` : "—"}</span> },
            { label: "Created by", value: audit.createdBy },
            { label: "Criteria", value: report.version },
          ]}
        />
        <Metric label="Job success rate" numerator={audit.succeededJobs} denominator={audit.plannedJobs} unit="planned jobs" basis={`${audit.failedJobs} failed, excluded from rates`} />
      </ReportSection>

      <ReportSection id="ai" number={3} title="AI visibility" subtitle="By provider API, model and search mode">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {data.channels.map((c) => (
            <Card key={c.id}>
              <div className="border-b border-line px-4 py-2.5">
                <h3 className="text-[13px] font-semibold text-fg">{c.label}</h3>
              </div>
              <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
                <Metric label="Mention rate" numerator={c.mention.n} denominator={c.mention.d} basis={c.failed ? `${c.failed} failed` : undefined} />
                <Metric label="Recommendation rate" numerator={c.recommendation.n} denominator={c.recommendation.d} />
                <Metric label="Owned citation rate" numerator={c.citation?.n} denominator={c.citation?.d} unit="responses with citation data" naReason={c.citation ? undefined : "Not supported by this provider"} />
              </CardBody>
            </Card>
          ))}
          {data.channels.length === 0 ? <p className="text-[13px] text-fg-muted">No AI responses recorded.</p> : null}
        </div>
        {data.failedByClass.length > 0 ? (
          <p className="tnum text-xs text-fg-subtle">
            Failed requests (excluded, not counted as absent): {data.failedByClass.map((f) => `${humanize(f.cls)} ${f.count}`).join(" · ")}
          </p>
        ) : null}
      </ReportSection>

      <ReportSection id="website" number={4} title="Website readiness" subtitle="Separate from AI visibility. Never blended into one score.">
        <Metric label="Page coverage" numerator={audit.pages?.n} denominator={audit.pages?.d} unit="in-scope pages" naReason={audit.pages ? undefined : "Website lane not run"} basis="pages assessed" />
      </ReportSection>

      <ReportSection id="findings" number={5} title="Findings" subtitle="Register entries linked to this audit">
        <Metric label="Findings created" value={String(audit.findingsCreated)} basis="audit headline" />
        {data.findings.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No register entries are linked to this audit.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {data.findings.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/stores/${storeId}/fixes/findings/${f.id}`} className="block max-w-lg truncate text-[13px] font-medium text-fg hover:underline" title={f.title}>{f.title}</Link>
                  <p className="text-xs text-fg-subtle"><Mono>{f.id}</Mono> · {humanize(f.category)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Status kind="severity" value={f.severity as StatusValue<"severity">} />
                  <Status kind="finding" value={f.status as StatusValue<"finding">} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="tasks" number={6} title="Recommendations and tasks">
        {data.tasks.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No fix tasks are linked to these findings.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {data.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/stores/${storeId}/fixes/tasks/${t.id}`} className="block max-w-lg truncate text-[13px] font-medium text-fg hover:underline" title={t.title}>{t.title}</Link>
                  <p className="text-xs text-fg-subtle"><Mono>{t.id}</Mono> · finding <Mono>{t.findingId}</Mono></p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Status kind="task" value={t.status as StatusValue<"task">} />
                  <Badge tone="neutral">{t.priority}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="evidence" number={7} title="Evidence" subtitle="Original answers, read-only">
        {data.evidence.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No recommended answers to cite.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {data.evidence.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="max-w-lg truncate text-[13px] text-fg" title={r.promptText}>{r.promptText}</p>
                  <p className="text-xs text-fg-subtle">{r.providerLabel} API · sample {r.sample}</p>
                </div>
                <ResponseButton response={r}>View response</ResponseButton>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="limitations" number={8} title="Limitations">
        <Limitations items={limitations} />
      </ReportSection>

      <ReportSection id="sources" number={9} title="Sources and versions">
        <SourceLinks sources={sources} />
        <KeyValue
          columns={2}
          items={[
            { label: "Report version", value: report.version },
            { label: "Analysis version", value: <span className="tnum">1.2</span> },
            { label: "Generated", value: <span className="tnum">{formatDateTime(report.createdAt)} UTC</span> },
            { label: "Report id", value: <Mono>{report.id}</Mono> },
          ]}
        />
      </ReportSection>
    </ReportFrame>
  );
}
