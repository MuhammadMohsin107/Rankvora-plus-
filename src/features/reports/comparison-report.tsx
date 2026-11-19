import Link from "next/link";

import { BarCompare, type BarCompareRow } from "@/components/charts/bars";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { KeyValue } from "@/components/ui/card";
import { Mono } from "@/components/ui/misc";
import { VerdictBanner } from "@/features/comparison/compatibility";
import { ResponseButton } from "@/features/responses/response-inspector";
import { Limitations, ReportFrame, ReportSection, SourceLinks } from "@/features/reports/report-parts";
import { formatDateTime, formatPercent, formatPoints, formatShortDate, formatSignedInt } from "@/lib/format";
import { pointChange } from "@/lib/stats";
import type { StatusValue } from "@/lib/status";
import type { ComparisonDetail, MetricResult, PairRowWithResponses, ReportRecord } from "@/types/comparison";

const SECTIONS = [
  { id: "summary", title: "Executive summary" },
  { id: "methodology", title: "Methodology" },
  { id: "headline", title: "Headline table" },
  { id: "breakdowns", title: "Breakdowns" },
  { id: "evidence", title: "Evidence" },
  { id: "fixes", title: "Fixes timeline context" },
  { id: "limitations", title: "Limitations" },
  { id: "sources", title: "Sources and versions" },
];

type Methodology = { version: string; matching: string; aggregation: string; rules: string[] };

const toRow = (m: MetricResult, label?: string): BarCompareRow => ({
  id: m.id,
  label: label ?? m.label,
  sub: m.sample !== "ok" && !m.na ? "directional" : undefined,
  baseline: m.baseline,
  current: m.current,
  baselineCi: m.baselineCi,
  currentCi: m.currentCi,
  naReason: m.na,
});

function relative(m: MetricResult): string {
  if (m.na) return "N/A";
  if (m.zeroBaseline) return "new from zero";
  if (m.relativeChange === null) return "N/A";
  return `${m.relativeChange > 0 ? "+" : m.relativeChange < 0 ? "−" : ""}${formatPercent(Math.abs(m.relativeChange))}`;
}

export function ComparisonReport({
  report,
  detail,
  storeId,
  limitations,
  methodology,
  evidence,
}: {
  report: ReportRecord;
  detail: ComparisonDetail;
  storeId: string;
  limitations: string[];
  methodology: Methodology;
  evidence: PairRowWithResponses[];
}) {
  const { result, record, baseline, current, fixes } = detail;
  const base = `/stores/${storeId}/comparisons/${record.id}`;
  const countsOnly = result.verdict === "insufficient_data";
  const sources = [
    { label: "Comparison", id: record.id, href: base },
    { label: "Baseline snapshot", id: baseline.reference, href: `${base}/export` },
    { label: "Current snapshot", id: current.reference, href: `${base}/export` },
  ];
  const completed = fixes.filter((f) => f.completed);

  return (
    <ReportFrame sections={SECTIONS}>
      <ReportSection id="summary" number={1} title="Executive summary">
        <VerdictBanner
          verdict={result.verdict}
          coverage={result.coverage}
          unmatched={result.unmatched.length}
          excluded={result.excluded.length}
          checks={result.checks}
          actions={<ButtonLink href={`${base}/quality`} variant="secondary" size="sm">Checks</ButtonLink>}
        />
      </ReportSection>

      <ReportSection id="methodology" number={2} title="Methodology">
        <KeyValue
          columns={2}
          items={[
            { label: "Aggregation", value: methodology.aggregation },
            { label: "Matching", value: methodology.matching },
          ]}
        />
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs text-fg-muted">
          {methodology.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection id="headline" number={3} title="Headline table" subtitle={countsOnly ? "Counts only. No trend is concluded." : "Rates with 95% intervals, then the remaining changes"}>
        {countsOnly ? null : <BarCompare rows={result.headline.map((m) => toRow(m))} baselineLabel="Base" currentLabel="Current" />}
        <div className="ui-scroll overflow-x-auto">
          <table className="tnum w-full min-w-max border-collapse text-xs">
            <caption className="sr-only">Headline changes</caption>
            <thead>
              <tr className="border-b border-line text-left text-fg-subtle">
                <th scope="col" className="py-1.5 pr-4 font-medium">Metric</th>
                {countsOnly ? (
                  <>
                    <th scope="col" className="py-1.5 pr-4 font-medium">Baseline</th>
                    <th scope="col" className="py-1.5 pr-4 font-medium">Current</th>
                  </>
                ) : (
                  <th scope="col" className="py-1.5 pr-4 font-medium">Relative</th>
                )}
                <th scope="col" className="py-1.5 pr-4 font-medium">Count Δ</th>
                <th scope="col" className="py-1.5 font-medium">Denominator Δ</th>
              </tr>
            </thead>
            <tbody>
              {result.headline.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pr-4 text-left font-normal text-fg">{m.label}</th>
                  {countsOnly ? (
                    <>
                      <td className="py-1.5 pr-4 text-fg">{m.baseline ? `${m.baseline.n} / ${m.baseline.d}` : "N/A"}</td>
                      <td className="py-1.5 pr-4 text-fg">{m.current ? `${m.current.n} / ${m.current.d}` : "N/A"}</td>
                    </>
                  ) : (
                    <td className="py-1.5 pr-4 text-fg">{relative(m)}</td>
                  )}
                  <td className="py-1.5 pr-4 text-fg">{m.countChange === null ? "N/A" : formatSignedInt(m.countChange)}</td>
                  <td className="py-1.5 text-fg">{m.denominatorChange === null ? "N/A" : formatSignedInt(m.denominatorChange)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ReportSection>

      <ReportSection id="breakdowns" number={4} title="Breakdowns" subtitle="Platforms and competitors on the same cohort">
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Mention rate by platform</h3>
          {result.channels.length > 0 ? <BarCompare rows={result.channels.map((c) => toRow(c.mention, c.label))} baselineLabel="Base" currentLabel="Current" /> : <p className="text-[13px] text-fg-muted">No matched slots.</p>}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Mention rate by competitor</h3>
          {result.competitors.length > 0 ? <BarCompare rows={result.competitors.map((m) => toRow(m))} baselineLabel="Base" currentLabel="Current" /> : <p className="text-[13px] text-fg-muted">No tracked competitors.</p>}
        </div>
      </ReportSection>

      <ReportSection id="evidence" number={5} title="Evidence" subtitle="Slots where the mention changed, original answers read-only">
        {evidence.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No matched slot changed its mention result.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {evidence.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="max-w-lg truncate text-[13px] text-fg" title={row.promptText}>{row.promptText}</p>
                  <p className="tnum truncate text-xs text-fg-subtle">{row.channelLabel} · sample {row.sample}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={row.change === "gained" ? "success" : "danger"} icon={row.change === "gained" ? "arrow-up" : "arrow-down"}>{row.change === "gained" ? "Mention gained" : "Mention lost"}</Badge>
                  {row.baselineResponse ? <ResponseButton response={row.baselineResponse}>Before</ResponseButton> : null}
                  {row.currentResponse ? <ResponseButton response={row.currentResponse}>After</ResponseButton> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="fixes" number={6} title="Fixes timeline context">
        {completed.length === 0 ? (
          <p className="text-[13px] text-fg-muted">No task was completed between the two sources.</p>
        ) : (
          <ul className="divide-y divide-line rounded-control border border-line">
            {completed.map((item) => {
              const change = item.before && item.after ? pointChange(item.before.rate, item.after.rate) : null;
              return (
                <li key={item.taskId} className="flex flex-col gap-1 px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/stores/${storeId}/fixes/tasks/${item.taskId}`} className="max-w-lg truncate text-[13px] font-medium text-fg hover:underline" title={item.title}>{item.title}</Link>
                    <Status kind="task" value={item.status as StatusValue<"task">} />
                  </div>
                  <p className="tnum text-xs text-fg-muted">
                    {item.before && item.after
                      ? `Visibility changed after this task was completed: ${item.before.rate.n} / ${item.before.rate.d} → ${item.after.rate.n} / ${item.after.rate.d} (${formatPoints(change)}), runs ${item.before.runId} and ${item.after.runId}.`
                      : "No monitoring run on both sides of this task."}
                    {item.dueAt ? ` Due ${formatShortDate(item.dueAt)}.` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </ReportSection>

      <ReportSection id="limitations" number={7} title="Limitations">
        <Limitations items={limitations} />
      </ReportSection>

      <ReportSection id="sources" number={8} title="Sources and versions">
        <SourceLinks sources={sources} />
        <KeyValue
          columns={2}
          items={[
            { label: "Generated", value: <span className="tnum">{formatDateTime(report.createdAt)} UTC</span> },
            { label: "Baseline runs", value: <span className="flex flex-wrap gap-1">{baseline.runIds.map((id) => <Mono key={id}>{id}</Mono>)}</span> },
            { label: "Current runs", value: <span className="flex flex-wrap gap-1">{current.runIds.map((id) => <Mono key={id}>{id}</Mono>)}</span> },
          ]}
        />
      </ReportSection>
    </ReportFrame>
  );
}
