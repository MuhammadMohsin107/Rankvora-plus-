import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
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
    <div className="flex flex-col gap-4">
      <Callout tone="warning" title="Provisional results">
        Numbers on every tab are partial and will change until the audit completes.
      </Callout>

      <SplitLayout
        main={
          <>
            <Card as="section">
              <CardHeader title="Progress" />
              <CardBody>
                {/* Requests and pages are counted in their own stage rows below, not repeated here. */}
                <div className="mb-4 border-b border-line pb-4">
                  <Metric label="Overall" numerator={progress.overall.n} denominator={progress.overall.d} unit="work units" info="Work units = AI requests + pages to crawl. Each stage below reports its own count." basis={`${formatDuration(progress.elapsedSeconds)} elapsed`} />
                  <Progress className="mt-2" value={progress.overall.n} max={progress.overall.d} label="Overall progress" />
                </div>
                <ul className="divide-y divide-line">
                  {progress.stages.map((stage) => (
                    <StageRow key={stage.id} stage={stage} />
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card as="section">
              <CardHeader
                title="Failed requests"
                subtitle={progress.failedResponses.length > 0 ? `${progress.failedResponses.length} of ${attempted} attempted, after 3 attempts` : undefined}
                info="Failures are excluded from rates and counted in coverage. A failed request is not evidence that the brand is absent."
              />
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

            {progress.warnings.length > 0 ? (
              <Card as="section">
                <CardHeader title="Warnings" />
                <CardBody className="flex flex-col gap-2">
                  {progress.warnings.map((w) => (
                    <Callout key={w} tone="warning">{w}</Callout>
                  ))}
                </CardBody>
              </Card>
            ) : null}
          </>
        }
      />
    </div>
  );
}
