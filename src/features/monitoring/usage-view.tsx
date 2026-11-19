"use client";

import { useState } from "react";

import { Status } from "@/components/ui/badge";
import { Callout, Card, CardBody, CardHeader, Section } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { UsageMetricKey, UsageNumbers, UsagePeriod, UsageSummary } from "@/types/monitoring";

import { USAGE_LABEL, formatUsd } from "./labels";

const KEYS: UsageMetricKey[] = ["requests", "samples", "searchCalls", "tokens", "costUsd"];

const show = (key: UsageMetricKey, value: number) => (key === "costUsd" ? formatUsd(value) : formatNumber(value));
const toneFor = (value: number, max: number) => (max > 0 && value / max >= 0.9 ? "danger" : max > 0 && value / max >= 0.75 ? "warning" : "accent");

type ProviderRow = UsagePeriod["byProvider"][number];

export function UsageView({ usage }: { usage: UsageSummary }) {
  const [periodId, setPeriodId] = useState(usage.currentPeriodId);
  const period = usage.periods.find((p) => p.id === periodId) ?? usage.periods[0];
  const isCurrent = period.id === usage.currentPeriodId;

  const providerColumns: Column<ProviderRow>[] = [
    { id: "provider", header: "Provider", cell: (p) => <span className="whitespace-nowrap text-[13px] font-medium text-fg">{p.label}</span> },
    {
      id: "requests",
      header: "Requests / cap",
      sort: (p) => p.numbers.requests,
      cell: (p) => (
        <div className="flex min-w-32 flex-col gap-1">
          <span className="tnum text-[13px] text-fg">{formatNumber(p.numbers.requests)} / {formatNumber(p.requestCap)}</span>
          <Progress value={p.numbers.requests} max={p.requestCap} label={`${p.label} requests against cap`} tone={toneFor(p.numbers.requests, p.requestCap)} />
        </div>
      ),
    },
    { id: "samples", header: "Samples", align: "right", hideBelow: "sm", sort: (p) => p.numbers.samples, cell: (p) => <span className="tnum text-[13px]">{formatNumber(p.numbers.samples)}</span> },
    { id: "search", header: "Search calls", align: "right", hideBelow: "md", sort: (p) => p.numbers.searchCalls, cell: (p) => <span className="tnum text-[13px]">{formatNumber(p.numbers.searchCalls)}</span> },
    { id: "tokens", header: "Tokens", align: "right", hideBelow: "md", sort: (p) => p.numbers.tokens, cell: (p) => <span className="tnum text-[13px]">{formatNumber(p.numbers.tokens)}</span> },
    { id: "cost", header: "Cost (estimate)", align: "right", sort: (p) => p.numbers.costUsd, cell: (p) => <span className="tnum text-[13px]">{formatUsd(p.numbers.costUsd)}</span> },
  ];

  const scheduleColumns: Column<UsageSummary["schedules"][number]>[] = [
    { id: "name", header: "Schedule", sort: (s) => s.name, cell: (s) => <span className="text-[13px] font-medium text-fg">{s.name}</span> },
    { id: "status", header: "Status", cell: (s) => <Status kind="schedule" value={s.status} /> },
    { id: "run", header: "Jobs / run", align: "right", hideBelow: "sm", sort: (s) => s.jobsPerRun, cell: (s) => <span className="tnum text-[13px]">{s.jobsPerRun}</span> },
    { id: "runs", header: "Runs / month", align: "right", hideBelow: "md", sort: (s) => s.runsPerMonth, cell: (s) => <span className="tnum text-[13px]">~{s.runsPerMonth % 1 === 0 ? s.runsPerMonth : s.runsPerMonth.toFixed(1)}</span> },
    { id: "month", header: "Jobs / month", align: "right", sort: (s) => s.jobsPerMonth, cell: (s) => <span className="tnum text-[13px]">~{formatNumber(s.jobsPerMonth)}</span> },
    { id: "cost", header: "Cost / month (estimate)", align: "right", hideBelow: "sm", sort: (s) => s.costPerMonthUsd, cell: (s) => <span className="tnum text-[13px]">~{formatUsd(s.costPerMonthUsd)}</span> },
  ];

  const planned = usage.schedules.filter((s) => s.status === "active" || s.status === "needs_attention");
  const plannedJobs = planned.reduce((sum, s) => sum + s.jobsPerMonth, 0);
  const plannedCost = planned.reduce((sum, s) => sum + s.costPerMonthUsd, 0);
  const projectedOver = KEYS.filter((k) => usage.projected[k] > usage.caps[k]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={periodId} onChange={setPeriodId} options={usage.periods.map((p) => ({ value: p.id, label: p.label }))} />
        <p className="tnum text-[13px] text-fg-muted">{period.runCount} run{period.runCount === 1 ? "" : "s"} in this period</p>
      </div>

      {usage.estimated ? <Callout tone="info">Token and search-call counts are estimated for this store. Job-level records are not part of the demo.</Callout> : null}
      {isCurrent && projectedOver.length > 0 ? (
        <Callout tone="warning" title="Projected to pass a cap this month">
          {projectedOver.map((k) => `${USAGE_LABEL[k]} ${show(k, usage.projected[k])} / ${show(k, usage.caps[k])}`).join(" · ")}. Runs stop at the cap and finish as partially completed.
        </Callout>
      ) : null}

      <Card>
        <CardHeader title="Usage against caps" subtitle={period.label} info="Caps are the monthly usage limits set on the schedules. Cost is an estimate from provider usage." />
        <CardBody>
          <ul className="flex flex-col gap-4">
            {KEYS.map((key) => {
              const value = period.total[key as keyof UsageNumbers];
              const cap = usage.caps[key];
              return (
                <li key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-medium text-fg">{USAGE_LABEL[key]}</span>
                    <span className="tnum text-xs text-fg-subtle"><span className="text-sm font-semibold text-fg">{show(key, value)}</span> / {show(key, cap)}</span>
                  </div>
                  <Progress value={value} max={cap} label={`${USAGE_LABEL[key]} against cap`} tone={toneFor(value, cap)} />
                  {isCurrent ? <p className="tnum text-xs text-fg-subtle">Projected month-end {show(key, usage.projected[key])} / {show(key, cap)}</p> : null}
                </li>
              );
            })}
          </ul>
          {isCurrent ? <p className="mt-4 border-t border-line pt-3 text-xs text-fg-subtle">{usage.projectedNote}</p> : null}
        </CardBody>
      </Card>

      <Section title="By provider">
        <DataTable label={`Usage by provider, ${period.label}`} data={period.byProvider} rowKey={(p) => p.channelId} columns={providerColumns} />
      </Section>

      <Section title="Planned usage by schedule">
        <DataTable label="Estimated jobs per month by schedule" data={usage.schedules} rowKey={(s) => s.id} columns={scheduleColumns} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-muted">Active schedules, per month</span>
            <span className="tnum text-sm text-fg"><span className="text-[22px] font-semibold">~{formatNumber(plannedJobs)}</span> jobs · ~{formatUsd(plannedCost)} estimate</span>
          </div>
          {usage.storeRequests ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-fg-muted">Store requests this month, all modules</span>
                <span className="tnum text-xs text-fg-subtle"><span className="text-sm font-semibold text-fg">{formatNumber(usage.storeRequests.used)}</span> / {formatNumber(usage.storeRequests.cap)}</span>
              </div>
              <Progress value={usage.storeRequests.used} max={usage.storeRequests.cap} label="Store request usage against plan" tone={toneFor(usage.storeRequests.used, usage.storeRequests.cap)} />
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
