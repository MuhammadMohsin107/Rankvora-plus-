import { Suspense } from "react";

import { PageFallback } from "@/components/shell/page-fallback";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BarCompare } from "@/components/charts/bars";
import { PageHeader, SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric, MetricCell, MetricGrid, Section } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Mono } from "@/components/ui/misc";
import { formatDuration, formatNumber } from "@/lib/format";
import { formatUsd } from "@/features/monitoring/labels";
import { ProviderSplitTable, RunJobsTable } from "@/features/monitoring/run-detail-parts";
import { whenText } from "@/features/monitoring/when";
import { getStore } from "@/services/core";
import { getRunDetail, runParams } from "@/services/monitoring";

export const metadata: Metadata = { title: "Run" };

export async function generateStaticParams() {
  return runParams();
}

async function RunDetailPageContent(props: PageProps<"/stores/[storeId]/monitoring/runs/[runId]">) {
  const { storeId, runId } = await props.params;
  const [store, detail] = await Promise.all([getStore(storeId), getRunDetail(storeId, runId)]);
  if (!store || !detail) notFound();
  const { run, totals, providers, jobs, usage, snapshot } = detail;
  const base = `/stores/${storeId}/monitoring`;
  const tz = store.timezone;

  return (
    <>
      <PageHeader
        title={run.id}
        subtitle={whenText(run.scheduledFor, tz)}
        breadcrumb={[{ label: "Monitoring", href: base }, { label: "Runs", href: `${base}/runs` }, { label: run.id }]}
        meta={
          <>
            <Status kind="run" value={run.status} />
            {detail.provisional ? <Badge tone="warning" icon="alert-triangle" title="Totals can still change while the run is going">Provisional</Badge> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href={`${base}/schedules/${run.scheduleId}`} icon="clock" aria-label={`Open schedule ${run.scheduleName}`}>{run.scheduleName}</ButtonLink>
            {detail.reportId ? <ButtonLink href={`/stores/${storeId}/reports/${detail.reportId}`} variant="primary" icon="reports">Open report</ButtonLink> : null}
          </>
        }
      />

      <div className="flex flex-col gap-6">
        <MetricGrid>
          <MetricCell>
            <Metric label="Brand mention rate" numerator={run.mention.n} denominator={run.mention.d} info="Mentions ÷ successful, analysed responses. Failed jobs are excluded." />
          </MetricCell>
          <MetricCell>
            <Metric label="Recommendation rate" numerator={run.recommendation.n} denominator={run.recommendation.d} />
          </MetricCell>
          <MetricCell>
            <Metric label="Response success rate" numerator={run.succeeded} denominator={run.planned} unit="jobs" info="Jobs that returned an answer ÷ planned jobs." />
          </MetricCell>
          <MetricCell>
            <Metric label="Duration" value={run.durationSeconds === null ? "—" : formatDuration(run.durationSeconds)} />
          </MetricCell>
        </MetricGrid>

        <SplitLayout
          main={
            <>
              {providers.length > 0 ? (
                <>
                  <Card>
                    <CardHeader title="By provider" subtitle={detail.previousRunId ? `Mention rate vs ${detail.previousRunId}` : "Mention rate"} info="Mentions ÷ successful responses for each provider API, model and search mode." />
                    <CardBody>
                      <BarCompare
                        baselineLabel="Prev"
                        currentLabel="This"
                        rows={providers.map((p) => ({ id: p.channelId, label: p.short, baseline: p.previousMention, current: p.mention }))}
                      />
                    </CardBody>
                  </Card>

                  <Section title="Provider usage">
                    <ProviderSplitTable providers={providers} />
                  </Section>
                </>
              ) : null}

              <Section title="Jobs">
                {jobs.length === 0 ? (
                  <EmptyState icon="list" title="No job records for this run" description="Totals come from the run summary." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {totals.failed > 0 ? (
                      <Callout tone="info">
                        {totals.failed} failed after retries (timeouts, rate limits, provider errors, refusals). They are excluded from every rate and never counted as the brand being absent.
                      </Callout>
                    ) : null}
                    <RunJobsTable jobs={jobs} />
                  </div>
                )}
              </Section>
            </>
          }
          aside={
            <>
              <Card>
                <CardHeader title="Totals and usage" info="Planned, succeeded and failed jobs are in the rates above. Cost is an estimate allocated from provider usage; retries count as requests." />
                <CardBody>
                  <KeyValue
                    columns={2}
                    items={[
                      { label: "Attempted", value: <span className="tnum">{totals.attempted}</span> },
                      { label: "Retried", value: <span className="tnum">{totals.retried}</span> },
                      { label: "Analysed", value: <span className="tnum">{totals.analysed}</span> },
                      { label: "Requests", value: <span className="tnum">{usage.requests}</span> },
                      { label: "Search calls", value: <span className="tnum">{usage.searchCalls}</span> },
                      { label: "Input tokens", value: <span className="tnum">{formatNumber(usage.inputTokens)}</span> },
                      { label: "Output tokens", value: <span className="tnum">{formatNumber(usage.outputTokens)}</span> },
                      { label: "Cost (estimate)", value: <span className="tnum">{formatUsd(usage.costUsd)}</span> },
                    ]}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Config snapshot" info="What this run used. Later schedule edits never change it." />
                <CardBody className="flex flex-col gap-4">
                  <KeyValue
                    columns={1}
                    items={[
                      { label: "Snapshot", value: <Mono>{snapshot.id}</Mono> },
                      { label: "Schedule version", value: <span className="tnum">v{snapshot.scheduleVersion}</span> },
                      { label: "Market · language", value: snapshot.locale },
                      { label: "Samples · window", value: <span className="tnum">{snapshot.samples} per job · {snapshot.windowMinutes} min</span> },
                      { label: "Concurrency · retry", value: <span className="tnum">{snapshot.maxConcurrency} · {snapshot.retry}</span> },
                      { label: "Analysis version", value: <span className="tnum">{snapshot.analysisVersion}</span> },
                    ]}
                  />
                  <div className="border-t border-line pt-3">
                    <p className="mb-1.5 text-xs font-medium text-fg-muted">Providers</p>
                    <ul className="flex flex-col gap-1 text-[13px] text-fg">
                      {snapshot.channels.map((c) => (
                        <li key={c.id}>{c.label}</li>
                      ))}
                    </ul>
                  </div>
                  {snapshot.prompts.length > 0 ? (
                    <div className="border-t border-line pt-3">
                      <p className="mb-1.5 text-xs font-medium text-fg-muted">Prompt versions</p>
                      <ul className="flex flex-col gap-1.5">
                        {snapshot.prompts.map((p) => (
                          <li key={p.id} className="flex items-start justify-between gap-2 text-[13px]">
                            <span className="min-w-0 truncate text-fg-muted" title={p.text}>{p.text}</span>
                            <span className="tnum shrink-0 text-xs text-fg-subtle">{p.id} · v{p.version}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </>
          }
        />
      </div>
    </>
  );
}

export default function RunDetailPage(props: PageProps<"/stores/[storeId]/monitoring/runs/[runId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <RunDetailPageContent {...props} />
    </Suspense>
  );
}
