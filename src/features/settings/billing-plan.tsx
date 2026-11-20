"use client";

import { Fragment } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { formatDate, formatNumber } from "@/lib/format";
import type { BillingPlan, PlanId } from "@/types/settings";

import { formatUsd } from "./billing-model";
import type { Billing } from "./use-billing";

/** Short "what is near its limit" nudge with one action. Renders nothing unless a limit is near or reached. */
export function UpgradeNudge({ b, onChange }: { b: Billing; onChange: (id: PlanId) => void }) {
  if (!b.nudge) return null;
  const { meters, target } = b.nudge;
  const text = meters.map((m) => `${m.label} ${m.unit === "usd" ? formatUsd(m.used) : formatNumber(m.used)} / ${m.unit === "usd" ? formatUsd(m.limit) : formatNumber(m.limit)}`).join(", ");
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

export function PlanTab({ b, onChange, onCancel }: { b: Billing; onChange: (id: PlanId) => void; onCancel: () => void }) {
  const { plan, base, state } = b;
  const cancelling = state.cancelAt !== null;
  return (
    <div className="flex flex-col gap-6">
      <HeaderAction>
        <Button variant="primary" onClick={() => onChange(nextOther(b.plans, plan.id).id)}>
          Change plan
        </Button>
      </HeaderAction>
      {cancelling ? (
        <Callout
          tone="warning"
          title={`Ends ${formatDate(state.cancelAt as string)}`}
          actions={
            <Button variant="secondary" size="sm" onClick={b.actions.resume}>
              Resume subscription
            </Button>
          }
        >
          The plan stays active until then. Simulated: nothing was cancelled with a provider.
        </Callout>
      ) : null}
      <UpgradeNudge b={b} onChange={onChange} />

      <Card>
        <CardHeader
          title={`${plan.name} plan`}
          actions={
            <>
              <Menu
                label="Plan actions"
                trigger={<IconButton icon="more" label="Plan actions" variant="secondary" />}
                width={220}
                items={[
                  cancelling
                    ? { label: "Resume subscription", icon: "refresh", onSelect: b.actions.resume }
                    : { label: "Cancel subscription", icon: "x-circle", tone: "danger", onSelect: onCancel },
                ]}
              />
            </>
          }
        />
        <CardBody className="flex flex-col gap-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tnum text-metric font-semibold text-fg">{formatUsd(plan.priceUsd)}</span>
            <span className="text-body-sm text-fg-muted">per month, billed monthly</span>
          </div>
          <KeyValue
            columns={4}
            items={[
              { label: "Billing period", value: `${formatDate(base.period.start)} to ${formatDate(base.period.end)}` },
              { label: cancelling ? "Ends" : "Renews", value: formatDate(cancelling ? (state.cancelAt as string) : base.period.renewsOn) },
              { label: "Seats", value: `${formatNumber(plan.limits.seats)} included` },
              { label: "Websites", value: `${formatNumber(plan.limits.websites)} included` },
              { label: "Active prompts", value: `${formatNumber(plan.limits.prompts)} included` },
              { label: "AI requests", value: `${formatNumber(plan.limits.requests + state.credits)} per month${state.credits > 0 ? ` (+${formatNumber(state.credits)} credits)` : ""}` },
              { label: "Monitoring", value: plan.monitoring },
              { label: "History kept", value: `${plan.retentionMonths} months` },
            ]}
          />
        </CardBody>
      </Card>

      <PlanComparison b={b} onChange={onChange} />
    </div>
  );
}

/** The plan to open in the dialog when "Change plan" is pressed: the next one up, or the one below the top plan. */
function nextOther(plans: BillingPlan[], current: PlanId): BillingPlan {
  const index = plans.findIndex((p) => p.id === current);
  return plans[index + 1] ?? plans[index - 1] ?? plans[0];
}

const ROWS: { label: string; value: (p: BillingPlan) => string }[] = [
  { label: "Websites", value: (p) => formatNumber(p.limits.websites) },
  { label: "Active prompts", value: (p) => formatNumber(p.limits.prompts) },
  { label: "AI requests per month", value: (p) => formatNumber(p.limits.requests) },
  { label: "Search calls per month", value: (p) => formatNumber(p.limits.searchCalls) },
  { label: "Seats", value: (p) => formatNumber(p.limits.seats) },
  { label: "Monitoring frequency", value: (p) => p.monitoring },
  { label: "History retention", value: (p) => `${p.retentionMonths} months` },
  { label: "Estimated cost included", value: (p) => formatUsd(p.limits.usageAllowanceUsd) },
];

function PlanComparison({ b, onChange }: { b: Billing; onChange: (id: PlanId) => void }) {
  return (
    <Card>
      <CardHeader title="Compare plans" />
      <div className="ui-scroll mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-body-sm">
          <caption className="sr-only">Plan limits and prices</caption>
          <thead>
            <tr className="border-y border-line bg-surface-2/70">
              <th scope="col" className="px-card py-3 text-left text-label font-medium text-fg-muted">Plan</th>
              {b.plans.map((p) => (
                <th key={p.id} scope="col" className={`px-3 py-3 text-left align-top ${p.id === b.plan.id ? "bg-accent-soft/50" : ""}`}>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 text-card-title font-semibold text-fg">
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
              <tr key={row.label} className="border-b border-line">
                <th scope="row" className="px-card py-2.5 text-left font-normal text-fg-muted">{row.label}</th>
                {b.plans.map((p) => (
                  <td key={p.id} className={`tnum px-3 py-2.5 text-fg ${p.id === b.plan.id ? "bg-accent-soft/50" : ""}`}>{row.value(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-card py-3" />
              {b.plans.map((p) => {
                const current = p.id === b.plan.id;
                const direction = p.priceUsd > b.plan.priceUsd ? "Upgrade" : "Downgrade";
                return (
                  <td key={p.id} className={`px-3 py-3 ${current ? "bg-accent-soft/50" : ""}`}>
                    {current ? (
                      <span className="text-label text-fg-muted">Your plan</span>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => onChange(p.id)} aria-label={`${direction} to ${p.name}`}>
                        {direction}
                      </Button>
                    )}
                  </td>
                );
              })}
            </tr>
          </tfoot>
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

export function CancelDialog({ b, open, onClose }: { b: Billing; open: boolean; onClose: () => void }) {
  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() => {
        b.actions.cancel();
        onClose();
      }}
      title="Cancel subscription?"
      confirmLabel="Cancel subscription"
      cancelLabel="Keep plan"
    >
      <p>Your {b.plan.name} plan stays active until {formatDate(b.base.period.renewsOn)}. Simulated: nothing is cancelled with a provider.</p>
    </ConfirmDialog>
  );
}
