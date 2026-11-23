"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Callout, Card, CardBody, CardHeader, Section } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/table";
import { formatNumber, formatPercent, ratePercent } from "@/lib/format";
import type { RunRec, UsageMetricKey, UsageNumbers, UsagePeriod, UsageSummary } from "@/types/monitoring";

import { USAGE_LABEL, formatUsd } from "./labels";
import { FINISHED_RUN_STATUSES } from "./run-sim";
import { NoSchedules } from "./no-schedules";
import { useMonitoring } from "./state";

const KEYS: UsageMetricKey[] = ["requests", "samples", "searchCalls", "tokens", "costUsd"];

const show = (key: UsageMetricKey, value: number) => (key === "costUsd" ? formatUsd(value) : formatNumber(value));
const toneFor = (value: number, max: number) => (max > 0 && value / max >= 0.9 ? "danger" : max > 0 && value / max >= 0.75 ? "warning" : "accent");
const add = (a: UsageNumbers, b: UsageNumbers): UsageNumbers => ({
  requests: a.requests + b.requests,
  samples: a.samples + b.samples,
  searchCalls: a.searchCalls + b.searchCalls,
  tokens: a.tokens + b.tokens,
  costUsd: Math.round((a.costUsd + b.costUsd) * 1000) / 1000,
});

type ProviderRow = UsagePeriod["byProvider"][number];

/** Usage and limits. Runs created in the browser add to the current period, so Run now shows up here. */
export function UsageView({ usage }: { usage: UsageSummary }) {
  const { simulatedRuns, schedules, data } = useMonitoring();
  const [periodId, setPeriodId] = useState(usage.currentPeriodId);

  // Merge simulated runs into the period of their month.
  const periods = useMemo<UsagePeriod[]>(() => {
    return usage.periods.map((p) => {
      const mine = simulatedRuns.filter((r: RunRec) => r.scheduledFor.slice(0, 7) === p.id && FINISHED_RUN_STATUSES.includes(r.status));
      if (mine.length === 0) return p;
      const byProvider = p.byProvider.map((row) => {
        const extra = mine.flatMap((r) => r.usage.byProvider).filter((x) => x.channelId === row.channelId);
        return { ...row, numbers: extra.reduce((acc, x) => add(acc, x.numbers), row.numbers) };
      });
      return { ...p, runCount: p.runCount + mine.length, total: mine.reduce((acc, r) => add(acc, r.usage.numbers), p.total), byProvider };
    });
  }, [usage.periods, simulatedRuns]);

  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const isCurrent = period.id === usage.currentPeriodId;
  const simCurrent = simulatedRuns.filter((r) => r.scheduledFor.slice(0, 7) === usage.currentPeriodId && FINISHED_RUN_STATUSES.includes(r.status));
  const projected = simCurrent.reduce((acc, r) => add(acc, r.usage.numbers), usage.projected);
  const projectedOver = KEYS.filter((k) => projected[k] > usage.caps[k]);
  const planRequests = data.planRequests ? { used: data.planRequests.used + simCurrent.reduce((n, r) => n + r.usage.numbers.requests, 0), cap: data.planRequests.cap } : null;

  const failedRequests = Math.max(0, period.total.requests - period.total.samples);
  const active = schedules.filter((s) => s.status === "active" || s.status === "needs_attention");
  const plannedJobs = active.reduce((n, s) => n + s.jobsPerMonth, 0);
  const plannedCost = active.reduce((n, s) => n + s.costPerMonthUsd, 0);

  const providerColumns: Column<ProviderRow>[] = [
    { id: "provider", header: "Provider", cell: (p) => <span className="whitespace-nowrap text-body-sm font-medium text-fg">{p.label}</span> },
    {
      id: "requests",
      header: "Requests / cap",
      sort: (p) => p.numbers.requests,
      cell: (p) => (
        <div className="flex min-w-32 flex-col gap-1">
          <span className="tnum text-body-sm text-fg">{formatNumber(p.numbers.requests)} / {formatNumber(p.requestCap)}</span>
          <Progress value={p.numbers.requests} max={p.requestCap} label={`${p.label} requests against cap`} tone={toneFor(p.numbers.requests, p.requestCap)} />
        </div>
      ),
    },
    { id: "samples", header: "Samples", align: "right", hideBelow: "sm", sort: (p) => p.numbers.samples, cell: (p) => <span className="tnum text-body-sm">{formatNumber(p.numbers.samples)}</span> },
    { id: "search", header: "Search calls", align: "right", hideBelow: "md", sort: (p) => p.numbers.searchCalls, cell: (p) => <span className="tnum text-body-sm">{formatNumber(p.numbers.searchCalls)}</span> },
    { id: "tokens", header: "Tokens", align: "right", hideBelow: "md", sort: (p) => p.numbers.tokens, cell: (p) => <span className="tnum text-body-sm">{formatNumber(p.numbers.tokens)}</span> },
    { id: "cost", header: "Cost (estimate)", align: "right", sort: (p) => p.numbers.costUsd, cell: (p) => <span className="tnum text-body-sm">{formatUsd(p.numbers.costUsd)}</span> },
  ];

  if (schedules.length === 0) return <NoSchedules />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={periodId} onChange={setPeriodId} options={periods.map((p) => ({ value: p.id, label: p.label }))} />
        <p className="tnum text-body-sm text-fg-muted">{period.runCount} run{period.runCount === 1 ? "" : "s"}</p>
      </div>

      {isCurrent && projectedOver.length > 0 ? (
        <Callout tone="warning" title="Projected to pass a cap this month">
          {projectedOver.map((k) => `${USAGE_LABEL[k]} ${show(k, projected[k])} / ${show(k, usage.caps[k])}`).join(" · ")}. A run that would pass a cap is not started.
        </Callout>
      ) : null}

      <Card>
        <CardHeader title="Usage against caps" info="Caps are the monthly limits set on the schedules. Token and search-call counts are estimated. Cost is an estimate from provider usage." />
        <CardBody>
          <ul className="flex flex-col gap-4">
            {KEYS.map((key) => {
              const value = period.total[key];
              const cap = usage.caps[key];
              return (
                <li key={key} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-sm font-medium text-fg">{USAGE_LABEL[key]}</span>
                    <span className="tnum text-helper text-fg-muted"><span className="text-body font-semibold text-fg">{show(key, value)}</span> / {show(key, cap)}</span>
                  </div>
                  <Progress value={value} max={cap} label={`${USAGE_LABEL[key]} against cap`} tone={toneFor(value, cap)} />
                </li>
              );
            })}
          </ul>
          <p className="tnum mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-helper text-fg-muted">
            <span>Failed requests: {formatNumber(failedRequests)} of {formatNumber(period.total.requests)} ({formatPercent(ratePercent(failedRequests, period.total.requests))}), counted in requests</span>
            {isCurrent ? <span>Active schedules plan ~{formatNumber(plannedJobs)} jobs · ~{formatUsd(plannedCost)} a month</span> : null}
          </p>
        </CardBody>
      </Card>

      {planRequests ? (
        <Card>
          <CardHeader title="Plan credits" subtitle="Requests this month, all modules" actions={<Link href="/settings/billing" className="text-label font-medium text-accent-text hover:underline">Billing</Link>} />
          <CardBody className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="tnum text-body-sm text-fg-muted"><span className="text-body font-semibold text-fg">{formatNumber(planRequests.used)}</span> / {formatNumber(planRequests.cap)} used</span>
              <span className="tnum text-helper text-fg-muted">{formatNumber(Math.max(0, planRequests.cap - planRequests.used))} left</span>
            </div>
            <Progress value={planRequests.used} max={planRequests.cap} label="Website requests against the plan" tone={toneFor(planRequests.used, planRequests.cap)} />
          </CardBody>
        </Card>
      ) : null}

      <Section title="By provider">
        <DataTable label={`Usage by provider, ${period.label}`} data={period.byProvider} rowKey={(p) => p.channelId} columns={providerColumns} mobileCards />
      </Section>
    </div>
  );
}
