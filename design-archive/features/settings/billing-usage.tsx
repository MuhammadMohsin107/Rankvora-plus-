"use client";

import { LineChart } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { Card, ChartCard, Section } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { formatNumber, formatRate } from "@/lib/format";
import type { PlanId } from "@/types/settings";

import { formatUsd, PROVIDER_KEYS, type Meter, type MeterState, type ProviderKey, type ProviderUsage, type WebsiteUsage } from "./billing-model";
import { UpgradeNudge } from "./billing-plan";
import type { Billing } from "./use-billing";

const STATE_TONE: Record<MeterState, "accent" | "warning" | "danger"> = { ok: "accent", near: "warning", at_limit: "danger" };

const PROVIDER_LABEL: Record<ProviderKey, string> = { openai: "OpenAI", gemini: "Gemini", perplexity: "Perplexity" };

const show = (m: Meter, value: number) => (m.unit === "usd" ? formatUsd(value) : formatNumber(value));

function MeterRow({ m }: { m: Meter }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)] items-center gap-x-6 gap-y-1 px-card py-2 sm:grid-cols-[11rem_minmax(0,1fr)_9rem]">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-body-sm font-medium text-fg">{m.label}</span>
        {m.state === "near" ? <Badge tone="warning" icon="alert-triangle">Near limit</Badge> : null}
        {m.state === "at_limit" ? <Badge tone="danger" icon="alert-circle">Limit reached</Badge> : null}
      </div>
      <Progress value={m.used} max={m.limit} tone={STATE_TONE[m.state]} label={`${m.label}: ${show(m, m.used)} of ${show(m, m.limit)}`} />
      <p className="tnum text-body-sm sm:text-right">
        <span className="font-semibold text-fg">{show(m, m.used)}</span>
        <span className="text-fg-muted"> / {show(m, m.limit)}</span>
        <span className="block text-helper text-fg-subtle">{m.limit > 0 ? `${formatRate(m.used, m.limit, 0)} used` : "No limit set"}</span>
      </p>
    </li>
  );
}

export function UsageTab({ b, onChange }: { b: Billing; onChange: (id: PlanId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <UpgradeNudge b={b} onChange={onChange} />

      <Section title={`Plan limits, ${b.base.period.label}`}>
        <Card>
          <ul className="divide-y divide-line">
            {b.meters.map((m) => (
              <MeterRow key={m.id} m={m} />
            ))}
          </ul>
        </Card>
      </Section>

      <WebsiteUsage b={b} />
      <ProviderUsage b={b} />
      <History b={b} />
    </div>
  );
}

function WebsiteUsage({ b }: { b: Billing }) {
  const { usageRows: rows, totals } = b;
  const columns: Column<WebsiteUsage>[] = [
    { id: "name", header: "Website", sort: (r) => r.name.toLowerCase(), cell: (r) => <span className="font-medium text-fg">{r.name}</span> },
    {
      id: "requests",
      header: "AI requests",
      align: "right",
      sort: (r) => r.requests,
      cell: (r) => (
        <span className="tnum" title={`${r.requests} of ${totals.requests} requests`}>
          {formatNumber(r.requests)}
          <span className="block text-helper text-fg-subtle">{totals.requests > 0 ? `${formatRate(r.requests, totals.requests)} of ${formatNumber(totals.requests)}` : "No requests yet"}</span>
        </span>
      ),
    },
    ...PROVIDER_KEYS.map<Column<WebsiteUsage>>((key) => ({
      id: key,
      header: PROVIDER_LABEL[key],
      align: "right",
      hideBelow: "lg",
      sort: (r) => r.byProvider[key],
      cell: (r) => <span className="tnum">{r.byProvider[key] > 0 ? formatNumber(r.byProvider[key]) : <span className="text-fg-subtle">None</span>}</span>,
    })),
    { id: "search", header: "Search calls", align: "right", hideBelow: "md", sort: (r) => r.searchCalls, cell: (r) => <span className="tnum">{formatNumber(r.searchCalls)}</span> },
    { id: "cost", header: "Estimated cost", align: "right", hideBelow: "sm", sort: (r) => r.costCents, cell: (r) => <span className="tnum">{formatUsd(r.costCents / 100)}</span> },
    { id: "prompts", header: "Active prompts", align: "right", hideBelow: "md", sort: (r) => r.activePrompts, cell: (r) => <span className="tnum">{formatNumber(r.activePrompts)}</span> },
  ];
  return (
    <Section title="Usage by website">
      <DataTable<WebsiteUsage> label="Usage by website" data={rows} columns={columns} rowKey={(r) => r.websiteId} defaultSort={{ column: "requests", dir: "desc" }} />
      <p className="tnum text-body-sm text-fg-muted">
        <span className="font-medium text-fg">Organization total</span>: {formatNumber(totals.requests)} requests, {formatNumber(totals.searchCalls)} search calls, {formatUsd(totals.costCents / 100)}, {formatNumber(totals.activePrompts)} active prompts
      </p>
    </Section>
  );
}

function ProviderUsage({ b }: { b: Billing }) {
  const { providerRows: rows, totals } = b;
  const columns: Column<ProviderUsage>[] = [
    { id: "provider", header: "Provider", sort: (r) => PROVIDER_LABEL[r.provider], cell: (r) => <span className="font-medium text-fg">{PROVIDER_LABEL[r.provider]}</span> },
    {
      id: "requests",
      header: "AI requests",
      align: "right",
      sort: (r) => r.requests,
      cell: (r) => (
        <span className="tnum" title={`${r.requests} of ${totals.requests} requests`}>
          {formatNumber(r.requests)}
          <span className="block text-helper text-fg-subtle">{totals.requests > 0 ? `${formatRate(r.requests, totals.requests)} of ${formatNumber(totals.requests)}` : "No requests yet"}</span>
        </span>
      ),
    },
    { id: "cost", header: "Estimated cost", align: "right", sort: (r) => r.costCents, cell: (r) => <span className="tnum">{formatUsd(r.costCents / 100)}</span> },
  ];
  return (
    <Section title="Usage by provider">
      <DataTable<ProviderUsage> label="Usage by provider" data={rows} columns={columns} rowKey={(r) => r.provider} defaultSort={{ column: "requests", dir: "desc" }} />
    </Section>
  );
}

function History({ b }: { b: Billing }) {
  const { requests, limit } = b.chart;
  const last = requests[requests.length - 1];
  return (
    <ChartCard
      title="AI requests, last 6 months"
      footnote={`${b.base.period.label.split(" ")[0]} is to date.`}
    >
      <LineChart
        series={[
          { id: "requests", label: "AI requests", tone: 1, dash: "solid", points: requests },
          { id: "limit", label: "Plan limit", tone: 2, dash: "dashed", points: limit },
        ]}
        yMax="auto"
        height={220}
        yFormat={formatNumber}
        summary={`AI requests by month, ${requests.filter((p) => p.y !== null).length} months with data. ${last.x}: ${last.detail ?? "no data"}.`}
      />
    </ChartCard>
  );
}
