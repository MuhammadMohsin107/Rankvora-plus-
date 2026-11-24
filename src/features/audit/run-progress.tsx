"use client";

import { SplitLayout } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { ResponseButton } from "@/features/responses/response-drawer";
import { formatDuration } from "@/lib/format";
import type { AuditStage } from "@/types/audit";

import type { DerivedAudit } from "./derive";

const stageBadge = {
  done: { tone: "success", icon: "check-circle", label: "Done" },
  running: { tone: "accent", icon: "loader", label: "Running" },
  queued: { tone: "neutral", icon: "clock", label: "Queued" },
} as const;

function StageRow({ stage, paused }: { stage: AuditStage; paused: boolean }) {
  const badge = stageBadge[stage.state];
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-2 py-2 first:pt-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
      <span><Badge tone={badge.tone} icon={badge.icon}>{paused && stage.state === "running" ? "Paused" : badge.label}</Badge></span>
      <div className="min-w-0">
        <p className="text-body-sm font-medium text-fg">{stage.label}</p>
        {stage.note ? <p className="truncate text-helper text-fg-subtle">{stage.note}</p> : null}
        <Progress className="mt-1.5" value={stage.done} max={Math.max(stage.total, 1)} label={`${stage.label}: ${stage.done} of ${stage.total} ${stage.unit}`} tone={stage.state === "done" ? "success" : "accent"} />
      </div>
      <p className="tnum text-helper text-fg-muted sm:w-40 sm:text-right">{stage.done} / {stage.total} {stage.unit}</p>
    </li>
  );
}

const setupIcon = { done: "check-circle", running: "loader", queued: "clock", failed: "x-circle" } as const;

/** Live view of a simulated run: stages, current work, warnings and failed requests. The clock lives in the audit row. */
export function RunProgressView({ derived, paused }: { derived: DerivedAudit; paused: boolean }) {
  const { progress, current, ai } = derived;
  const failed = (ai?.responses ?? []).filter((r) => r.status === "failed");
  const validating = progress.phase === "validating" || progress.status === "blocked";

  return (
    <div className="flex flex-col gap-3">
      {paused ? <Callout tone="warning" title="Paused">The clock is stopped. Nothing advances until you resume.</Callout> : null}
      <SplitLayout
        main={
          <>
            <Card as="section">
              <CardHeader title="Progress" subtitle="Simulated run" />
              <CardBody>
                <div className="mb-4 border-b border-line pb-4">
                  <Metric label="Overall" numerator={progress.overall.n} denominator={progress.overall.d} unit="work units" info="Work units = AI requests + pages to crawl. Each stage reports its own count." basis={`${formatDuration(Math.round(progress.elapsedMs / 1000))} elapsed`} />
                  <Progress className="mt-2" value={progress.overall.n} max={Math.max(progress.overall.d, 1)} label="Overall progress" />
                </div>
                <ul className="divide-y divide-line">
                  {progress.stages.map((stage) => (
                    <StageRow key={stage.id} stage={stage} paused={paused} />
                  ))}
                </ul>
              </CardBody>
            </Card>

            {validating ? (
              <Card as="section">
                <CardHeader title="Setup checks" subtitle="Simulated. Nothing was fetched." />
                <CardBody className="pt-2">
                  <ul className="divide-y divide-line">
                    {progress.setup.map((c) => (
                      <li key={c.id} className="flex items-center gap-2.5 py-2 text-body-sm first:pt-0 last:pb-0">
                        <Icon name={setupIcon[c.state]} size={15} className={c.state === "failed" ? "text-danger-icon" : c.state === "done" ? "text-success-icon" : "text-fg-subtle"} />
                        <span className={c.state === "queued" ? "text-fg-muted" : "text-fg"}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}

            {failed.length > 0 ? (
              <Card as="section">
                <CardHeader title="Failed requests" subtitle={`${failed.length} after 3 attempts · excluded from rates`} info="A failed request is not evidence that the brand is absent." />
                <CardBody className="pt-2">
                  <ul className="divide-y divide-line">
                    {failed.slice(-6).map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5">
                        <div className="min-w-0 flex-1 basis-64">
                          <p className="truncate text-body-sm text-fg" title={r.promptText}>{r.promptText}</p>
                          <p className="text-helper text-fg-subtle">{r.providerLabel} · sample {r.sample} · {r.failure?.message}</p>
                        </div>
                        <ResponseButton response={r}>View</ResponseButton>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            ) : null}
          </>
        }
        aside={
          <>
            <Card as="section">
              <CardHeader title="Right now" />
              <CardBody>
                {current && !paused ? (
                  <KeyValue
                    columns={1}
                    items={[
                      ...(current.providerLabel ? [{ label: "Provider", value: current.providerLabel }, { label: "Prompt", value: <span className="line-clamp-2">{current.promptText}</span> }, { label: "Sample", value: <span className="tnum">{current.sample}</span> }] : []),
                      ...(current.url ? [{ label: "Crawling", value: <Mono>{current.url}</Mono> }] : []),
                    ]}
                  />
                ) : (
                  <p className="text-body-sm text-fg-muted">{paused ? "Paused." : progress.phase === "validating" ? "Checking the setup." : progress.phase === "queued" ? "Waiting to start." : "Wrapping up."}</p>
                )}
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
