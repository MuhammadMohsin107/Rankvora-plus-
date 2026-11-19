"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Section } from "@/components/ui/card";
import { Progress } from "@/components/ui/feedback";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { BillingOverview, StoreProviderUsage } from "@/types/settings";

const PROVIDERS = [
  { code: "openai", label: "OpenAI" },
  { code: "gemini", label: "Gemini" },
  { code: "perplexity", label: "Perplexity" },
] as const;

function tone(used: number, limit: number): "accent" | "warning" | "danger" {
  if (limit <= 0) return "accent";
  const ratio = used / limit;
  return ratio >= 1 ? "danger" : ratio > 0.85 ? "warning" : "accent";
}

export function BillingView({ billing }: { billing: BillingOverview }) {
  const toast = useToast();

  const columns: Column<StoreProviderUsage>[] = [
    { id: "store", header: "Store", sort: (r) => r.storeName.toLowerCase(), cell: (r) => <span className="font-medium text-fg">{r.storeName}</span> },
    ...PROVIDERS.map<Column<StoreProviderUsage>>((p) => ({
      id: p.code,
      header: p.label,
      align: "right",
      hideBelow: "md",
      sort: (r) => r.byProvider[p.code] ?? -1,
      cell: (r) => {
        const value = r.byProvider[p.code];
        return value === undefined ? <span className="text-xs text-fg-subtle" title="Not enabled for this store">Not enabled</span> : <span className="tnum">{formatNumber(value)}</span>;
      },
    })),
    {
      id: "total",
      header: "Requests / cap",
      sort: (r) => r.total,
      width: "w-64",
      cell: (r) => (
        <div className="flex min-w-40 flex-col gap-1">
          <span className="tnum text-xs text-fg-muted"><span className="text-[13px] font-semibold text-fg">{formatNumber(r.total)}</span> / {formatNumber(r.cap)}</span>
          <Progress value={r.total} max={r.cap} label={`${r.storeName} requests against its cap`} tone={tone(r.total, r.cap)} />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title={`${billing.planName} plan`} subtitle={`Limits · ${billing.periodLabel}`} />
          <CardBody>
            <ul className="flex flex-col gap-4">
              {billing.planLimits.map((limit) => (
                <li key={limit.id} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-fg">{limit.label}</span>
                    <span className="tnum text-xs text-fg-subtle"><span className="text-sm font-semibold text-fg">{formatNumber(limit.used)}</span> / {formatNumber(limit.limit)} {limit.unit}</span>
                  </div>
                  <Progress value={limit.used} max={limit.limit} label={`${limit.label} used against plan limit`} tone={tone(limit.used, limit.limit)} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Requests by provider" info="Provider API requests made by audits and monitoring. Estimated cost is what the provider bills; it is not part of the plan fee." />
          <CardBody>
            <ul className="flex flex-col gap-4">
              {billing.providerUsage.map((row) => (
                <li key={row.provider} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-fg">{row.label}</span>
                    <span className="tnum text-xs text-fg-subtle"><span className="text-sm font-semibold text-fg">{formatNumber(row.requests)}</span> / {formatNumber(row.cap)}</span>
                  </div>
                  <Progress value={row.requests} max={row.cap} label={`${row.label} requests against its cap`} tone={tone(row.requests, row.cap)} />
                  <p className="tnum text-xs text-fg-subtle">{formatNumber(row.searchCalls)} search calls · est. {formatCurrency(row.estimatedCostUsd)}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Section
        title="Usage by store and provider"
        actions={<Button variant="secondary" size="sm" icon="download" onClick={() => toast.push({ title: "Usage CSV export started", description: "Demo: no file is produced." })}>Export CSV</Button>}
      >
        <DataTable<StoreProviderUsage> label="Usage by store and provider" data={billing.storeUsage} columns={columns} rowKey={(r) => r.storeId} defaultSort={{ column: "total", dir: "desc" }} />
      </Section>

      <Card>
        <CardHeader title="Invoices" actions={<Badge tone="warning" icon="alert-triangle">Demo data, not real invoices</Badge>} />
        <CardBody className="pt-2">
          <ul className="divide-y divide-line">
            {billing.invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg">{invoice.period}</p>
                  <p className="tnum text-xs text-fg-subtle">{invoice.status === "upcoming" ? "Due" : "Issued"} {formatDate(invoice.issuedOn)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tnum text-[13px] text-fg">{formatCurrency(invoice.amountUsd)}</span>
                  <Badge tone={invoice.status === "paid" ? "success" : "neutral"} icon={invoice.status === "paid" ? "check" : "clock"}>{invoice.status === "paid" ? "Paid" : "Upcoming"}</Badge>
                  <Button variant="ghost" size="sm" icon="download" disabled={invoice.status === "upcoming"} onClick={() => toast.push({ title: `Invoice ${invoice.period}`, description: "Demo: there is no file to download.", tone: "info" })}>PDF</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
