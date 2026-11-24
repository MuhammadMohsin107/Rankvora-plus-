"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BarCompare } from "@/components/charts/bars";
import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue, Metric, MetricCell, MetricGrid } from "@/components/ui/card";
import { SimulatedBadge, TrustLabel } from "@/components/ui/demo";
import { EmptyState, Progress, Skeleton } from "@/components/ui/feedback";
import { Mono } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { useHydrated } from "@/features/prompts/use-prompts";
import { formatDuration, formatPercent, ratePercent } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import type { RunDetail, RunRec } from "@/types/monitoring";

import { FAILURE_LABEL } from "./labels";
import { ProviderSplitTable, RunJobsTable } from "./run-detail-parts";
import { isActiveRun, runExtras } from "./run-sim";
import { useMonitoring } from "./state";
import { whenText } from "./when";

const STATUS_HELP =
  "Completed: every job answered. Completed with warnings: some jobs failed after retries. Partially completed: the run stopped early, for example at a usage cap. Failed: no usable answers.";

/** Run detail. Seeded runs arrive from the server; runs created in the browser are resolved from the shared client state. */
export function RunDetailView({ runId, detail: serverDetail }: { runId: string; detail: RunDetail | null }) {
  const api = useMonitoring();
  const { runs, base, data, prompts, loadRunDetail, retryFailed, cancelRun } = api;
  const hydrated = useHydrated();
  const search = useSearchParams();
  const router = useRouter();
  const rec = runs.find((r) => r.id === runId);
  const simRec = rec && (rec as RunRec).simulated ? (rec as RunRec) : null;
  const [simDetail, setSimDetail] = useState<RunDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Progress changes the visible jobs, so the detail is rebuilt on each tick. The basis run is cached.
  const sig = simRec ? `${simRec.id}|${simRec.status}|${simRec.doneJobs}` : "";
  useEffect(() => {
    if (!simRec) return;
    let cancelled = false;
    void loadRunDetail(simRec).then((d) => {
      if (!cancelled) setSimDetail(d);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sig captures the fields the detail depends on
  }, [sig, loadRunDetail]);

  const detail = serverDetail ?? simDetail;
  const activePromptCount = prompts.filter((p) => p.status === "active").length;
  const providerCount = data.ctx?.channels.length ?? 0;
  const extras = useMemo(() => (detail ? runExtras(detail.jobs, { prompts: activePromptCount, providers: providerCount }) : null), [detail, activePromptCount, providerCount]);

  if (!serverDetail && !simRec) {
    if (!hydrated) return <Skeleton className="h-64 w-full" />;
    return (
      <>
        <PageHeader title="Run" />
        <EmptyState icon="search" title="Run not found" headingAs="h1" description="It may have been created in another browser." action={<ButtonLink href={`${base}/runs`}>All runs</ButtonLink>} />
      </>
    );
  }
  if (!detail) return <Skeleton className="h-64 w-full" />;

  const run = simRec ?? detail.run;
  const active = simRec ? isActiveRun(simRec.status) : false;
  const previousSnapshot = detail.previousRunId ? runs.find((r) => r.id === detail.previousRunId)?.snapshotId : undefined;
  const failedJobs = detail.jobs.filter((j) => j.status === "failed").length;
  const tz = data.timezone;

  const retry = async () => {
    setMessage(null);
    const result = await retryFailed(run, detail);
    setMessage(result.ok ? null : result.reason);
    if (result.ok) router.push(`${base}/runs/${result.id}`);
  };

  const overview = (
    <div className="flex flex-col gap-3">
      {active && simRec ? (
        <Card variant="action">
          <CardBody className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="tnum text-body-sm font-medium text-fg">{simRec.status === "queued" ? "Queued" : `${simRec.doneJobs} of ${simRec.planned} jobs done`}</p>
              <Button size="sm" onClick={() => cancelRun(simRec.id)}>Cancel run</Button>
            </div>
            <Progress value={simRec.doneJobs} max={simRec.planned} label="Run progress" />
            <p className="tnum text-helper text-fg-muted">{simRec.planned - simRec.doneJobs} waiting · totals are provisional until the run completes</p>
          </CardBody>
        </Card>
      ) : null}

      {!active ? (
        <div className="flex flex-col gap-2">
          <MetricGrid>
            <MetricCell>
              <Metric label="Brand mention rate" numerator={run.mention.n} denominator={run.mention.d} />
            </MetricCell>
            <MetricCell>
              <Metric label="Recommendation rate" numerator={run.recommendation.n} denominator={run.recommendation.d} />
            </MetricCell>
            <MetricCell>
              <Metric label="Response success rate" numerator={run.succeeded} denominator={run.planned} unit="jobs" />
            </MetricCell>
            <MetricCell>
              <Metric label="Duration" value={run.durationSeconds === null ? "—" : formatDuration(run.durationSeconds)} basis={simRec ? "simulated" : undefined} />
            </MetricCell>
          </MetricGrid>
          {extras ? <TrustLabel samples={run.mention.d} promptsIncluded={extras.coverage.prompts.n} promptsTotal={extras.coverage.prompts.d} extra={`${extras.coverage.providers.n} of ${extras.coverage.providers.d} providers`} /> : null}
        </div>
      ) : null}

      {detail.failures.length > 0 ? (
        <Card>
          <CardHeader title="Failures" subtitle="Excluded from every rate" />
          <CardBody>
            <ul className="flex flex-col divide-y divide-line">
              {detail.failures.map((g) => (
                <li key={g.cls} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="flex items-center gap-2 text-body-sm text-fg">
                    <Badge tone="danger">{FAILURE_LABEL[g.cls]}</Badge>
                    <span className="tnum">{g.count} job{g.count === 1 ? "" : "s"}</span>
                  </span>
                  <span className="truncate text-helper text-fg-muted">{[...new Set(g.examples.map((e) => e.provider))].join(", ")}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {detail.providers.length > 0 ? (
        <Card>
          <CardHeader title="By provider" subtitle={detail.previousRunId ? `Mention rate vs ${detail.previousRunId}` : "Mention rate"} />
          <CardBody className="flex flex-col gap-3">
            <BarCompare baselineLabel="Prev" currentLabel="This" rows={detail.providers.map((p) => ({ id: p.channelId, label: p.short, baseline: p.previousMention, current: p.mention }))} />
            <ProviderSplitTable providers={detail.providers} />
            <p className="text-helper text-fg-muted">Cost is an estimate allocated by provider usage. Retries count as requests.</p>
          </CardBody>
        </Card>
      ) : null}

      {extras && !active && run.succeeded > 0 ? (
        <Card>
          <CardHeader title="Also measured" />
          <CardBody>
            <KeyValue
              columns={2}
              items={[
                { label: "Positive sentiment", value: <span className="tnum">{extras.positive.n} / {extras.positive.d} answers ({formatPercent(ratePercent(extras.positive.n, extras.positive.d))})</span> },
                { label: "Average list position", value: extras.position.average === null ? <span className="text-fg-muted">No ordered lists</span> : <span className="tnum">{extras.position.average.toFixed(2)} (average of {extras.position.lists} ordered lists)</span> },
                { label: "Competitors named", value: extras.competitors.length === 0 ? "None" : <span className="tnum">{extras.competitors.slice(0, 3).map((c) => `${c.name} ${c.n} / ${c.d}`).join(" · ")}</span> },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );

  const jobs =
    detail.jobs.length === 0 ? (
      <EmptyState icon="list" title={active ? "No jobs finished yet" : "No job records for this run"} />
    ) : (
      <RunJobsTable detail={detail} storeId={data.storeId} initialResponseId={search.get("response")} />
    );

  const snap = detail.snapshot;
  const snapshot = (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <KeyValue
          columns={2}
          items={[
            { label: "Snapshot", value: <Mono>{snap.id}</Mono> },
            { label: "Schedule version", value: <span className="tnum">v{snap.scheduleVersion}</span> },
            { label: "Market · language", value: snap.locale },
            { label: "Samples · window", value: <span className="tnum">{snap.samples} per job · {snap.windowMinutes} min</span> },
            { label: "Concurrency · retry", value: <span className="tnum">{snap.maxConcurrency} · {snap.retry}</span> },
            { label: "Analysis version", value: <span className="tnum">{snap.analysisVersion}</span> },
            ...(simRec ? [{ label: "Initiator", value: simRec.initiator }, { label: "Reason", value: simRec.reason }, { label: "Answers replayed from", value: <Link href={`${base}/runs/${simRec.basisRunId}`} className="text-accent-text hover:underline">{simRec.basisRunId}</Link> }] : []),
          ]}
        />
        <div className="border-t border-line pt-3">
          <p className="mb-1.5 text-label font-medium text-fg-muted">Providers</p>
          <ul className="flex flex-col gap-1 text-body-sm text-fg">
            {snap.channels.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </div>
        {snap.prompts.length > 0 ? (
          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-label font-medium text-fg-muted">Prompt versions</p>
            <ul className="flex flex-col gap-1.5">
              {snap.prompts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 text-body-sm">
                  <Link href={`/stores/${data.storeId}/prompts/${p.id}`} className="min-w-0 truncate text-fg-muted hover:text-accent-text hover:underline" title={p.text}>{p.text}</Link>
                  <span className="tnum shrink-0 text-helper text-fg-muted">v{p.version}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );

  const comparable = !simRec && previousSnapshot;
  const primary = comparable ? (
    <ButtonLink href={`/stores/${data.storeId}/comparisons/new?baseline=${encodeURIComponent(previousSnapshot)}&current=${encodeURIComponent(run.snapshotId)}`} variant="primary" icon="compare" aria-label="Compare with previous run">
      <span className="max-sm:hidden">Compare with previous</span>
      <span aria-hidden="true" className="sm:hidden">Compare</span>
    </ButtonLink>
  ) : simRec ? (
    <Tooltip content="Runs simulated in this browser are not saved snapshots, so they cannot be compared.">
      <span tabIndex={0} className="inline-flex">
        <Button variant="secondary" icon="compare" disabled>Compare with previous</Button>
      </span>
    </Tooltip>
  ) : detail.reportId ? (
    <ButtonLink href={`/stores/${data.storeId}/reports/${detail.reportId}`} variant="primary" icon="reports">Open report</ButtonLink>
  ) : null;

  return (
    <>
      {primary ? <HeaderAction>{primary}</HeaderAction> : null}
      <PageHeader
        title={run.id}
        subtitle={whenText(run.scheduledFor, tz)}
        meta={
          <>
            <Tooltip content={STATUS_HELP}>
              <span className="inline-flex cursor-help" tabIndex={0} aria-label={`${statusMeta("run", run.status).label}. ${STATUS_HELP}`}>
                <Status kind="run" value={run.status} />
              </span>
            </Tooltip>
            {simRec ? <SimulatedBadge /> : null}
            {detail.provisional ? <Badge tone="warning" icon="alert-triangle" title="Totals can still change while the run is going">Provisional</Badge> : null}
          </>
        }
        actions={
          <>
            <ButtonLink href={`${base}/schedules/${run.scheduleId}`} icon="clock">{run.scheduleName}</ButtonLink>
            {comparable && detail.reportId ? <ButtonLink href={`/stores/${data.storeId}/reports/${detail.reportId}`} icon="reports">Open report</ButtonLink> : null}
            {failedJobs > 0 && !active ? <Button icon="refresh" onClick={retry}>Retry failed jobs</Button> : null}
            {simRec && failedJobs === 0 && simRec.findingId ? <ButtonLink href={`/stores/${data.storeId}/fixes/findings/${simRec.findingId}`} icon="flag">Related finding</ButtonLink> : null}
          </>
        }
      />
      {message ? <div className="mb-4"><Callout tone="warning" title="Retry not started">{message}</Callout></div> : null}
      {simRec && simRec.purpose === "verification" && simRec.taskId ? (
        <div className="mb-4">
          <Callout tone="info" title="Verification run">
            Observed after task <Link href={`/stores/${data.storeId}/fixes/tasks/${simRec.taskId}`} className="font-medium text-accent-text hover:underline">{simRec.taskId}</Link>. These results do not prove the task caused a change.
          </Callout>
        </div>
      ) : null}
      <Tabs
        label="Run sections"
        defaultId={search.get("response") ? "jobs" : undefined}
        tabs={[
          { id: "overview", label: "Overview", content: overview },
          { id: "jobs", label: "Jobs", count: detail.jobs.length, content: jobs },
          { id: "snapshot", label: "Snapshot", content: snapshot },
        ]}
        panelClassName="pt-3"
      />
    </>
  );
}
