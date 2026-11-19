"use client";

import { Badge, Status } from "@/components/ui/badge";
import { Callout } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { ResponseButton } from "@/features/responses/response-inspector";
import { formatPercent, ratePercent } from "@/lib/format";
import type { ProviderSplit, RunJob } from "@/types/monitoring";

import { FAILURE_LABEL, formatNumberShort, formatUsd } from "./labels";

const outcomeStatus = { recommended: "recommended", mentioned: "merely_mentioned", absent: "none", uncertain: "unclear", failed: "none" } as const;

export function RunJobsTable({ jobs }: { jobs: RunJob[] }) {
  const providers = [...new Map(jobs.map((j) => [j.channelId, j.providerShort])).entries()];
  const classes = [...new Set(jobs.map((j) => j.errorClass).filter(Boolean))] as NonNullable<RunJob["errorClass"]>[];

  const columns: Column<RunJob>[] = [
    {
      id: "prompt",
      header: "Prompt",
      sort: (j) => j.promptId,
      cell: (j) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate text-[13px] text-fg" title={j.promptText}>{j.promptText}</p>
          <p className="tnum text-xs text-fg-subtle">{j.promptId} · v{j.promptVersion}</p>
        </div>
      ),
    },
    { id: "provider", header: "Provider", hideBelow: "md", sort: (j) => j.providerShort, cell: (j) => <span className="whitespace-nowrap text-[13px] text-fg-muted">{j.providerShort}</span> },
    { id: "sample", header: "Sample", align: "right", hideBelow: "sm", sort: (j) => j.sample, cell: (j) => <span className="tnum text-[13px]">{j.sample}</span> },
    { id: "status", header: "Job", sort: (j) => j.status, cell: (j) => <Status kind="job" value={j.status} /> },
    {
      id: "result",
      header: "Brand result",
      hideBelow: "lg",
      cell: (j) =>
        j.status === "failed" ? (
          <span className="text-xs text-fg-subtle">Excluded from rates</span>
        ) : (
          <Status kind="recommendation" value={outcomeStatus[j.outcome]} />
        ),
    },
    { id: "attempts", header: "Attempts", align: "right", hideBelow: "md", sort: (j) => j.attempts, cell: (j) => <span className="tnum text-[13px]">{j.attempts}</span> },
    { id: "error", header: "Error class", hideBelow: "sm", cell: (j) => (j.errorClass ? <Badge tone="danger">{FAILURE_LABEL[j.errorClass]}</Badge> : <span className="text-fg-subtle">—</span>) },
    { id: "response", header: "Response", align: "right", cell: (j) => <ResponseButton response={j.response}>{j.status === "failed" ? "View failure" : "View response"}</ResponseButton> },
  ];

  return (
    <DataTable
      label="Run jobs"
      data={jobs}
      rowKey={(j) => j.id}
      columns={columns}
      dense
      pageSize={10}
      searchable={{ placeholder: "Search prompts", text: (j) => `${j.promptText} ${j.promptId}` }}
      filters={[
        { id: "provider", label: "Provider", options: providers.map(([value, label]) => ({ value, label })), value: (j) => j.channelId },
        { id: "status", label: "Job status", options: [{ value: "succeeded", label: "Succeeded" }, { value: "failed", label: "Failed" }], value: (j) => j.status },
        ...(classes.length > 0 ? [{ id: "error", label: "Error class", options: classes.map((c) => ({ value: c, label: FAILURE_LABEL[c] })), value: (j: RunJob) => j.errorClass ?? "" }] : []),
      ]}
      empty={<EmptyState icon="list" title="No jobs recorded" />}
    />
  );
}

export function ProviderSplitTable({ providers }: { providers: ProviderSplit[] }) {
  const columns: Column<ProviderSplit>[] = [
    { id: "provider", header: "Provider", cell: (p) => <span className="whitespace-nowrap text-[13px] font-medium text-fg">{p.short}</span> },
    { id: "jobs", header: "Jobs ok / planned", align: "right", cell: (p) => <span className="tnum text-[13px]">{p.succeeded} / {p.planned}</span> },
    { id: "failed", header: "Failed", align: "right", cell: (p) => <span className={p.failed > 0 ? "tnum text-[13px] font-medium text-danger" : "tnum text-[13px] text-fg-muted"}>{p.failed}</span> },
    { id: "mention", header: "Mention", align: "right", hideBelow: "sm", cell: (p) => <span className="tnum whitespace-nowrap text-[13px]">{formatPercent(ratePercent(p.mention.n, p.mention.d))} <span className="text-fg-subtle">· {p.mention.n}/{p.mention.d}</span></span> },
    { id: "requests", header: "Requests", align: "right", hideBelow: "md", cell: (p) => <span className="tnum text-[13px]">{p.requests}</span> },
    { id: "tokens", header: "Tokens", align: "right", hideBelow: "lg", cell: (p) => <span className="tnum text-[13px]">{formatNumberShort(p.tokens)}</span> },
    { id: "search", header: "Search calls", align: "right", hideBelow: "lg", cell: (p) => <span className="tnum text-[13px]">{p.searchCalls}</span> },
    { id: "cost", header: "Cost (est.)", align: "right", hideBelow: "md", cell: (p) => <span className="tnum text-[13px]">{formatUsd(p.costUsd)}</span> },
  ];
  return <DataTable label="Provider split" data={providers} rowKey={(p) => p.channelId} columns={columns} dense />;
}

/** Failed jobs grouped by class, always labelled as excluded from rates. */
export function RunFailures({ jobs }: { jobs: RunJob[] }) {
  const failed = jobs.filter((j) => j.status === "failed");
  if (failed.length === 0) {
    return <p className="text-[13px] text-fg-muted">No failed jobs in this run.</p>;
  }
  const groups = new Map<string, RunJob[]>();
  for (const job of failed) {
    const key = job.errorClass ?? "provider_error";
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return (
    <div className="flex flex-col gap-4">
      <Callout tone="info">Failed jobs are excluded from every rate in this run. They are not counted as the brand being absent.</Callout>
      <ul className="flex flex-col gap-4">
        {[...groups.entries()].map(([cls, list]) => (
          <li key={cls}>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge tone="danger">{FAILURE_LABEL[cls as keyof typeof FAILURE_LABEL]}</Badge>
              <span className="tnum text-xs text-fg-subtle">{list.length} job{list.length === 1 ? "" : "s"} · {list[0].attempts} attempts each</span>
            </div>
            <ul className="divide-y divide-line rounded-control border border-line">
              {list.map((job) => (
                <li key={job.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-fg" title={job.promptText}>{job.promptText}</p>
                    <p className="text-xs text-fg-subtle">{job.providerShort} · sample {job.sample} · {job.errorMessage}</p>
                  </div>
                  <ResponseButton response={job.response}>Details</ResponseButton>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
