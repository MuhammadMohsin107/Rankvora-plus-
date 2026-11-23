"use client";

import { useMemo, useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Callout, KeyValue } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Mono, Timeline } from "@/components/ui/misc";
import { Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseDrawer } from "@/features/responses/response-drawer";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ProviderSplit, RunDetail, RunJob } from "@/types/monitoring";

import { FAILURE_LABEL, formatNumberShort, formatUsd } from "./labels";
import { buildAttempts, jobLatencySeconds } from "./run-sim";

const outcomeStatus = { recommended: "recommended", mentioned: "merely_mentioned", absent: "none", uncertain: "unclear", failed: "none" } as const;

const FAILURE_EXPLAIN: Record<NonNullable<RunJob["errorClass"]>, string> = {
  timeout: "The provider did not answer inside the run window.",
  rate_limit: "The provider refused the request because of its rate limit.",
  provider_error: "The provider returned a server error.",
  refusal: "The provider declined to answer this prompt.",
};

/** Seconds of backoff between attempts, read from the run snapshot text ("3 attempts · 30s backoff"). */
export function backoffOf(retry: string): number {
  return Number(/(\d+)s backoff/.exec(retry)?.[1] ?? 30);
}

type TableProps = { detail: RunDetail; storeId: string; initialResponseId?: string | null };

/** Jobs of a run with filters. A row opens the job details drawer; its response opens the shared response drawer. */
export function RunJobsTable({ detail, storeId, initialResponseId = null }: TableProps) {
  const { jobs } = detail;
  const initial = initialResponseId ? (jobs.find((j) => j.response.id === initialResponseId)?.id ?? null) : null;
  const [openId, setOpenId] = useState<string | null>(initial);
  const [responseId, setResponseId] = useState<string | null>(initialResponseId && initial ? initialResponseId : null);
  const open = jobs.find((j) => j.id === openId) ?? null;
  const providers = [...new Map(jobs.map((j) => [j.channelId, j.providerShort])).entries()];
  const classes = [...new Set(jobs.map((j) => j.errorClass).filter(Boolean))] as NonNullable<RunJob["errorClass"]>[];

  const columns: Column<RunJob>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (j) => j.promptText,
      cell: (j) => (
        <div className="min-w-0 max-w-[20rem]">
          <p className="truncate text-body-sm text-fg" title={j.promptText}>{j.promptText}</p>
          <p className="tnum text-helper text-fg-muted">v{j.promptVersion} · sample {j.sample}</p>
        </div>
      ),
    },
    { id: "provider", header: "Provider", hideBelow: "md", sort: (j) => j.providerShort, cell: (j) => <span className="whitespace-nowrap text-body-sm text-fg-muted">{j.providerShort}</span> },
    { id: "status", header: "Job", sort: (j) => j.status, cell: (j) => <Status kind="job" value={j.status} /> },
    {
      id: "result",
      header: "Brand result",
      hideBelow: "lg",
      cell: (j) => (j.status === "failed" ? <span className="text-fg-faint">—</span> : <Status kind="recommendation" value={outcomeStatus[j.outcome]} />),
    },
    { id: "attempts", header: "Attempts", align: "right", hideBelow: "lg", sort: (j) => j.attempts, cell: (j) => <span className="tnum text-body-sm">{j.attempts}</span> },
    {
      id: "error",
      header: "Error",
      hideBelow: "xl",
      cell: (j) => (j.errorClass ? <Badge tone="danger">{FAILURE_LABEL[j.errorClass]}</Badge> : <span className="text-fg-faint">—</span>),
    },
  ];

  return (
    <>
      <DataTable
        label="Run jobs"
        data={jobs}
        rowKey={(j) => j.id}
        columns={columns}
        dense
        pageSize={10}
        mobileCards
        onRowClick={(j) => setOpenId(j.id)}
        rowLabel={(j) => `${j.promptText} on ${j.providerShort}`}
        searchable={{ placeholder: "Search prompts", text: (j) => j.promptText }}
        filters={[
          { id: "provider", label: "Provider", options: providers.map(([value, label]) => ({ value, label })), value: (j) => j.channelId },
          { id: "status", label: "Status", options: [{ value: "succeeded", label: "Succeeded" }, { value: "failed", label: "Failed" }], value: (j) => j.status },
          ...(classes.length > 0 ? [{ id: "error", label: "Error", options: classes.map((c) => ({ value: c, label: FAILURE_LABEL[c] })), value: (j: RunJob) => j.errorClass ?? "" }] : []),
        ]}
        empty={<EmptyState icon="list" title="No jobs recorded" />}
      />
      <Drawer open={open !== null} onClose={() => setOpenId(null)} title="Job details" description={open ? `${open.providerShort} · sample ${open.sample}` : undefined} size="lg">
        {open ? <JobDetails job={open} detail={detail} storeId={storeId} onOpenResponse={() => setResponseId(open.response.id)} /> : null}
      </Drawer>
      {responseId ? (
        <ResponseDrawer
          response={(jobs.find((j) => j.response.id === responseId) as RunJob).response}
          samples={jobs.filter((j) => j.promptId === open?.promptId && j.channelId === open?.channelId).map((j) => j.response)}
          evidence={{ promptId: jobs.find((j) => j.response.id === responseId)?.promptId, sourceId: detail.run.id }}
          open
          onClose={() => setResponseId(null)}
        />
      ) : null}
    </>
  );
}

function JobDetails({ job, detail, storeId, onOpenResponse }: { job: RunJob; detail: RunDetail; storeId: string; onOpenResponse: () => void }) {
  const attempts = useMemo(() => buildAttempts(job, backoffOf(detail.snapshot.retry)), [job, detail.snapshot.retry]);
  const latency = jobLatencySeconds(job);
  const failed = job.status === "failed";
  const r = job.response;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Status kind="job" value={job.status} />
        {job.errorClass ? <Badge tone="danger">{FAILURE_LABEL[job.errorClass]}</Badge> : <Status kind="recommendation" value={outcomeStatus[job.outcome]} />}
        <span className="tnum text-helper text-fg-muted">{job.promptId} · v{job.promptVersion}</span>
      </div>
      <p className="rounded-control border border-line bg-surface-2/60 px-3 py-2.5 text-body-sm text-fg">{job.promptText}</p>

      {failed ? (
        <Callout tone="danger" title={FAILURE_LABEL[job.errorClass ?? "provider_error"]}>
          {job.errorMessage ?? FAILURE_EXPLAIN[job.errorClass ?? "provider_error"]} Counted as failed, never as the brand being absent.
        </Callout>
      ) : null}

      <KeyValue
        columns={2}
        items={[
          { label: "Attempts", value: <span className="tnum">{job.attempts}</span> },
          { label: "Latency", value: <span className="tnum">{latency === null ? "No completion time" : `${latency} s`}</span> },
          { label: "Provider request", value: <Mono>{r.providerRequestId}</Mono> },
          { label: "Requested (UTC)", value: <span className="tnum">{formatDateTime(r.requestedAt)}</span> },
          { label: "Tokens (in / out)", value: <span className="tnum">{formatNumber(r.usage.inputTokens)} / {formatNumber(r.usage.outputTokens)}</span> },
          { label: "Search calls", value: <span className="tnum">{r.usage.searchCalls}</span> },
        ]}
      />

      <section aria-label="Attempts">
        <h3 className="mb-2 text-helper font-semibold uppercase tracking-wide text-fg-muted">Attempts</h3>
        <Timeline
          items={attempts.map((a) => ({
            id: `a${a.n}`,
            title: `Attempt ${a.n} ${a.outcome === "succeeded" ? "succeeded" : "failed"}${a.errorClass ? ` (${FAILURE_LABEL[a.errorClass].toLowerCase()})` : ""}`,
            icon: a.outcome === "succeeded" ? "check-circle" : "x-circle",
            tone: a.outcome === "succeeded" ? "success" : "danger",
            time: `${formatDateTime(a.at)} UTC`,
            meta: a.latencySeconds === null ? undefined : <span className="tnum">{a.latencySeconds} s</span>,
          }))}
        />
        <p className="mt-2 text-helper text-fg-muted">Attempt timing is estimated from the request and completion times.</p>
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button size="sm" variant="primary" icon="eye" onClick={onOpenResponse}>{failed ? "View failure" : "View response"}</Button>
        <ButtonLink size="sm" href={`/stores/${storeId}/prompts/${job.promptId}`} icon="prompts">Open prompt</ButtonLink>
        <ButtonLink size="sm" href={`/stores/${storeId}/audits/new?recheck=${encodeURIComponent(job.promptId)}&provider=${encodeURIComponent(job.channelId)}&from=${encodeURIComponent(detail.run.id)}`} icon="audit">Focused re-check</ButtonLink>
      </div>
    </div>
  );
}

export function ProviderSplitTable({ providers }: { providers: ProviderSplit[] }) {
  const columns: Column<ProviderSplit>[] = [
    { id: "provider", header: "Provider", cell: (p) => <span className="whitespace-nowrap text-body-sm font-medium text-fg">{p.short}</span> },
    { id: "jobs", header: "Jobs ok / planned", align: "right", cell: (p) => <span className="tnum text-body-sm">{p.succeeded} / {p.planned}</span> },
    { id: "requests", header: "Requests", align: "right", hideBelow: "md", cell: (p) => <span className="tnum text-body-sm">{p.requests}</span> },
    { id: "tokens", header: "Tokens", align: "right", hideBelow: "lg", cell: (p) => <span className="tnum text-body-sm">{formatNumberShort(p.tokens)}</span> },
    { id: "search", header: "Search calls", align: "right", hideBelow: "lg", cell: (p) => <span className="tnum text-body-sm">{p.searchCalls}</span> },
    { id: "cost", header: "Cost (est.)", align: "right", hideBelow: "md", cell: (p) => <span className="tnum text-body-sm">{formatUsd(p.costUsd)}</span> },
  ];
  return <DataTable label="Provider split" data={providers} rowKey={(p) => p.channelId} columns={columns} dense />;
}
