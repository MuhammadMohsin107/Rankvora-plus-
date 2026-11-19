import { Badge } from "@/components/ui/badge";
import { StackedBar } from "@/components/charts/bars";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Mono } from "@/components/ui/misc";
import { SplitLayout } from "@/components/shell/page-header";
import { ResponseButton } from "@/features/responses/response-inspector";
import { formatDuration } from "@/lib/format";
import type { AuditDetail, AuditStage, StageState } from "@/types/audit";

const stageBadge: Record<StageState, { tone: "success" | "accent" | "neutral"; icon: "check-circle" | "loader" | "clock"; label: string }> = {
  done: { tone: "success", icon: "check-circle", label: "Done" },
  running: { tone: "accent", icon: "loader", label: "Running" },
  queued: { tone: "neutral", icon: "clock", label: "Queued" },
};

function StageRow({ stage }: { stage: AuditStage }) {
  const badge = stageBadge[stage.state];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="w-24 shrink-0"><Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge></span>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{stage.label}</p>
        {stage.note ? <p className="truncate text-xs text-fg-subtle">{stage.note}</p> : null}
        <Progress className="mt-1.5" value={stage.done} max={stage.total} label={`${stage.label}: ${stage.done} of ${stage.total} ${stage.unit}`} tone={stage.state === "done" ? "success" : "accent"} />
      </div>
      <p className="tnum text-xs text-fg-muted sm:w-40 sm:text-right">{stage.done} / {stage.total} {stage.unit}</p>
    </li>
  );
}

/** Overview of an audit that is still running: progress, stages, jobs, current activity, warnings. */
export function InProgressOverview({ audit, channelLabelText }: { audit: AuditDetail; channelLabelText: string }) {
  const progress = audit.progress;
  if (!progress) return null;
  const attempted = progress.jobs.succeeded + progress.jobs.failed;
  return (
    <div className="flex flex-col gap-5">
      <Callout tone="warning" title="Provisional results">
        Numbers on every tab are partial and will change until the audit completes.
      </Callout>

      <MetricGrid>
        <MetricCell>
          <Metric label="Overall progress" numerator={progress.overall.n} denominator={progress.overall.d} unit="work units" info="Work units = AI requests + pages to crawl." basis={`${formatDuration(progress.elapsedSeconds)} elapsed`} />
        </MetricCell>
        <MetricCell>
          <Metric label="Requests completed" numerator={attempted} denominator={audit.plannedJobs} unit="requests" basis={`${progress.jobs.succeeded} succeeded`} />
        </MetricCell>
        <MetricCell>
          <Metric label="Pages crawled" numerator={audit.coverage.pages.n} denominator={audit.coverage.pages.d} unit="in-scope pages" />
        </MetricCell>
        <MetricCell>
          <Metric label="Failed requests" value={String(progress.jobs.failed)} basis={`of ${attempted} attempted`} info="Failures are excluded from rates and counted in coverage." />
        </MetricCell>
      </MetricGrid>

      <SplitLayout
        main={
          <>
            <Card as="section">
              <CardHeader title="Stages" subtitle="Each stage reports its own count" />
              <CardBody>
                <ul className="divide-y divide-line">
                  {progress.stages.map((stage) => (
                    <StageRow key={stage.id} stage={stage} />
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card as="section">
              <CardHeader title="Failed requests" subtitle={`${progress.failedResponses.length} after 3 attempts`} info="A failed request is not evidence that the brand is absent." />
              <CardBody className="pt-2">
                {progress.failedResponses.length === 0 ? (
                  <p className="text-[13px] text-fg-muted">No failed requests.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {progress.failedResponses.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                        <div className="min-w-0 flex-1 basis-64">
                          <p className="truncate text-[13px] text-fg" title={r.promptText}>{r.promptText}</p>
                          <p className="text-xs text-fg-subtle">{r.providerLabel} · sample {r.sample} · {r.failure?.message}</p>
                        </div>
                        <ResponseButton response={r}>View</ResponseButton>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </>
        }
        aside={
          <>
            <Card as="section">
              <CardHeader title="Right now" />
              <CardBody>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "AI channel", value: channelLabelText || progress.current.provider },
                    { label: "Prompt", value: <span className="line-clamp-2">{progress.current.promptText}</span> },
                    { label: "Sample", value: <span className="tnum">{progress.current.sample}</span> },
                    { label: "Crawling", value: <Mono>{progress.current.url}</Mono> },
                  ]}
                />
              </CardBody>
            </Card>

            <Card as="section">
              <CardHeader title="Requests" subtitle={`${audit.plannedJobs} planned`} />
              <CardBody>
                <StackedBar
                  unit="requests"
                  segments={[
                    { id: "ok", label: "Succeeded", value: progress.jobs.succeeded, tone: "success" },
                    { id: "failed", label: "Failed", value: progress.jobs.failed, tone: "danger" },
                    { id: "running", label: "Running", value: progress.jobs.running, tone: "accent" },
                    { id: "queued", label: "Queued", value: progress.jobs.queued, tone: "neutral" },
                  ]}
                />
              </CardBody>
            </Card>

            <Card as="section">
              <CardHeader title="Warnings" subtitle={`${progress.warnings.length}`} />
              <CardBody className="flex flex-col gap-2">
                {progress.warnings.map((w) => (
                  <Callout key={w} tone="warning">{w}</Callout>
                ))}
              </CardBody>
            </Card>
          </>
        }
      />
    </div>
  );
}
