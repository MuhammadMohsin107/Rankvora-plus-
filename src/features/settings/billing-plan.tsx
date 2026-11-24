"use client";

import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardHeader } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/overlay";
import { formatDate, formatNumber, formatRate } from "@/lib/format";
import type { BillingPlan, PlanId } from "@/types/settings";

import { formatUsd } from "./billing-model";
import type { Billing } from "./use-billing";

/** Short "what is near its limit" nudge with one action. Renders nothing unless a limit is near or reached. */
export function UpgradeNudge({ b, onChange }: { b: Billing; onChange: (id: PlanId) => void }) {
  if (!b.nudge) return null;
  const { meters, target } = b.nudge;
  const fmt = (m: (typeof meters)[number], value: number) => (m.unit === "usd" ? formatUsd(value) : formatNumber(value));
  const text = meters.map((m) => `${m.label}: ${fmt(m, m.used)} of ${fmt(m, m.limit)} (${formatRate(m.used, m.limit, 0)})`).join(" · ");
  const reached = meters.some((m) => m.state === "at_limit");
  return (
    <Callout
      tone="warning"
      title={reached ? "Limit reached" : "Near a limit"}
      actions={
        <Button variant="secondary" size="sm" onClick={() => onChange(target.id)}>
          Upgrade to {target.name}
        </Button>
      }
    >
      {text}
    </Callout>
  );
}

const BLURB: Record<PlanId, string> = {
  starter: "For one or two websites",
  growth: "For a growing set of websites",
  agency: "For many client websites",
};

export function PlanTab({ b, onChange }: { b: Billing; onChange: (id: PlanId) => void }) {
  const { plan, base } = b;
  return (
    <div className="flex flex-col gap-3">
      <UpgradeNudge b={b} onChange={onChange} />

      <p className="tnum text-body-sm text-fg-muted">
        <span className="font-medium text-fg">{plan.name}</span> plan · renews {formatDate(base.period.renewsOn)} · billing period {formatDate(base.period.start)} to {formatDate(base.period.end)}
      </p>

      <ul className="grid grid-cols-[minmax(0,1fr)] items-stretch gap-3 md:grid-cols-3">
        {b.plans.map((p) => (
          <li key={p.id} className="flex">
            <PlanCard plan={p} current={p.id === plan.id} direction={p.priceUsd > plan.priceUsd ? "Upgrade" : "Downgrade"} onChange={onChange} />
          </li>
        ))}
      </ul>

      <PlanComparison b={b} />
    </div>
  );
}

function PlanCard({ plan, current, direction, onChange }: { plan: BillingPlan; current: boolean; direction: "Upgrade" | "Downgrade"; onChange: (id: PlanId) => void }) {
  const items = [
    `${formatNumber(plan.limits.websites)} websites`,
    `${formatNumber(plan.limits.prompts)} active prompts`,
    `${formatNumber(plan.limits.searchCalls)} search calls per month`,
    `Monitoring: ${plan.monitoring}`,
    `${plan.retentionMonths} months of history`,
  ];
  return (
    <article
      aria-label={`${plan.name} plan`}
      className={`flex w-full flex-col gap-3 rounded-card border p-4 shadow-card ${current ? "border-accent bg-accent-soft/40 ring-1 ring-accent" : "border-line bg-surface"}`}
    >
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-card-title font-semibold text-fg">{plan.name}</h3>
          {current ? <Badge tone="accent" icon="check-circle">Current</Badge> : null}
        </div>
        <p className="text-helper text-fg-muted">{BLURB[plan.id]}</p>
      </header>

      <p className="tnum flex items-baseline gap-1.5">
        <span className="text-title font-semibold tracking-tight text-fg">{formatUsd(plan.priceUsd)}</span>
        <span className="text-body-sm text-fg-muted">per month</span>
      </p>

      <div className="flex flex-col gap-0.5 border-y border-line py-2">
        <span className="text-helper text-fg-muted">AI requests per month</span>
        <span className="tnum text-body font-semibold text-fg">{formatNumber(plan.limits.requests)}</span>
      </div>

      {current ? (
        <Button variant="secondary" disabled className="w-full">
          Current plan
        </Button>
      ) : (
        <Button variant={direction === "Upgrade" ? "primary" : "secondary"} className="w-full" onClick={() => onChange(plan.id)} aria-label={`${direction} to ${plan.name}`}>
          {direction} to {plan.name}
        </Button>
      )}

      <ul className="flex flex-col gap-1.5">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2 text-body-sm text-fg">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success-icon" />
            <span className="tnum">{text}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

const ROWS: { label: string; value: (p: BillingPlan) => string }[] = [
  { label: "Websites", value: (p) => formatNumber(p.limits.websites) },
  { label: "Active prompts", value: (p) => formatNumber(p.limits.prompts) },
  { label: "AI requests per month", value: (p) => formatNumber(p.limits.requests) },
  { label: "Search calls per month", value: (p) => formatNumber(p.limits.searchCalls) },
  { label: "Monitoring frequency", value: (p) => p.monitoring },
  { label: "History retention", value: (p) => `${p.retentionMonths} months` },
  { label: "Estimated cost included", value: (p) => formatUsd(p.limits.usageAllowanceUsd) },
];

function PlanComparison({ b }: { b: Billing }) {
  const cols = b.plans.length;
  return (
    <Card>
      <CardHeader title="Compare plans" />
      <div className="ui-scroll mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] table-fixed border-collapse text-body-sm">
          <caption className="sr-only">Plan limits and prices</caption>
          <colgroup>
            <col style={{ width: "28%" }} />
            {b.plans.map((p) => (
              <col key={p.id} style={{ width: `${72 / cols}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-y border-line">
              <th scope="col" className="px-card py-2 text-left text-label font-medium text-fg-muted">
                <span className="sr-only">Feature</span>
              </th>
              {b.plans.map((p) => (
                <th key={p.id} scope="col" className={`px-4 py-2 text-left align-top ${p.id === b.plan.id ? "bg-accent-soft/60" : ""}`}>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-body font-semibold text-fg">
                      {p.name}
                      {p.id === b.plan.id ? <Badge tone="accent">Current</Badge> : null}
                    </span>
                    <span className="tnum text-body-sm font-normal text-fg-muted">{formatUsd(p.priceUsd)} per month</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-card py-1.5 text-left font-normal text-fg-muted">{row.label}</th>
                {b.plans.map((p) => (
                  <td key={p.id} className={`tnum px-4 py-1.5 text-fg ${p.id === b.plan.id ? "bg-accent-soft/60 font-medium" : ""}`}>{row.value(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ChangePlanDialog({ b, targetId, onTarget, onClose }: { b: Billing; targetId: PlanId | null; onTarget: (id: PlanId) => void; onClose: () => void }) {
  const target = b.plans.find((p) => p.id === targetId) ?? null;
  const effect = target ? b.changeEffect(target) : null;
  return (
    <Dialog
      open={target !== null}
      onClose={onClose}
      title="Change plan"
      description="Simulated: no payment is taken."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!target || (effect?.blockers.length ?? 0) > 0}
            onClick={() => {
              if (target && b.actions.changePlan(target.id)) onClose();
            }}
          >
            {target ? `Switch to ${target.name}` : "Switch"}
          </Button>
        </>
      }
    >
      {target && effect ? (
        <div className="flex flex-col gap-4">
          <Field label="New plan" hint={`Current plan: ${b.plan.name}`}>
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={target.id} onChange={(event) => onTarget(event.target.value as PlanId)}>
                {b.plans
                  .filter((p) => p.id !== b.plan.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatUsd(p.priceUsd)} per month)
                    </option>
                  ))}
              </Select>
            )}
          </Field>

          {effect.blockers.length > 0 ? (
            <Callout tone="danger" title="Reduce usage first">
              <ul className="list-disc pl-4">
                {effect.blockers.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </Callout>
          ) : (
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-body-sm">
              {effect.limitChanges.map((l) => (
                <Fragment key={l.id}>
                  <dt className="text-fg-muted">{l.label}</dt>
                  <dd className="tnum text-fg">{formatNumber(l.from)} to {formatNumber(l.to)}</dd>
                </Fragment>
              ))}
              <dt className="text-fg-muted">Price per month</dt>
              <dd className="tnum text-fg">{formatUsd(b.plan.priceUsd)} to {formatUsd(target.priceUsd)}</dd>
              <dt className="border-t border-line pt-2 font-medium text-fg">{effect.direction === "upgrade" ? "Charged today (prorated)" : "Charged today"}</dt>
              <dd className="tnum border-t border-line pt-2 font-medium text-fg">{effect.prorationUsd > 0 ? formatUsd(effect.prorationUsd) : "$0"}</dd>
            </dl>
          )}
        </div>
      ) : null}
    </Dialog>
  );
}
