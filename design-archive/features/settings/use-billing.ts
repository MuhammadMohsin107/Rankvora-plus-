"use client";

import { useMemo } from "react";

import { demoNow, simulatedToast, useDemoCollection, useDemoSettings, type DemoEventInput } from "@/demo-state";
import { useToast } from "@/components/ui/toast";
import type { Store } from "@/types/core";
import type { BillingBase, BillingInvoice, BillingPlan, BillingState, PlanId } from "@/types/settings";

import {
  buildMeters,
  historyPoints,
  mergeInvoices,
  nextInvoiceId,
  planChangeEffect,
  providerUsageRows,
  sumUsage,
  upgradeNudge,
  websiteUsageRows,
  type PlanChange,
} from "./billing-model";

export type PromptCountRow = { id: string; storeId: string; status: string };

const billingEvent = (label: string): DemoEventInput => ({ kind: "settings.saved", label: `Billing: ${label}` });

/**
 * All Billing state in one place. Server pages pass the static base; the changes (plan, invoices) live in
 * demo-state under `org.billing`. Nothing here charges anything or stores card data.
 */
export function useBilling(base: BillingBase, stores: Store[], promptRows: PromptCountRow[], organization: string) {
  const toast = useToast();
  const setting = useDemoSettings<BillingState>("org.billing", base.state);
  const { value: state, patch } = setting;
  const websites = useDemoCollection<Store>("websites", stores).rows;
  const prompts = useDemoCollection<PromptCountRow>("prompts", promptRows).rows;

  const plan = base.plans.find((p) => p.id === state.planId) ?? base.plans[0];

  const derived = useMemo(() => {
    const activePrompts: Record<string, number> = {};
    for (const p of prompts) if (p.status === "active") activePrompts[p.storeId] = (activePrompts[p.storeId] ?? 0) + 1;
    const usageRows = websiteUsageRows(
      websites.map((w) => ({ id: w.id, name: w.name })),
      base.usageSeeds,
      base.unitCostUsd,
      activePrompts,
    );
    const providerRows = providerUsageRows(usageRows, base.unitCostUsd);
    const totals = sumUsage(usageRows);
    const websiteCount = websites.filter((w) => w.status !== "archived").length;
    const meters = buildMeters({ plan, usage: totals, websites: websiteCount });
    const nudge = upgradeNudge(meters, plan.id, base.plans);
    const chart = historyPoints(base.history, { requests: totals.requests, limit: plan.limits.requests });
    const invoices = mergeInvoices(base.invoices, state.createdInvoices, state.invoiceStatus);
    return { usageRows, providerRows, totals, websiteCount, meters, nudge, chart, invoices, activePrompts };
  }, [websites, prompts, base, plan, state.createdInvoices, state.invoiceStatus]);

  const changeEffect = (to: BillingPlan): PlanChange =>
    planChangeEffect(
      plan,
      to,
      { websites: derived.websiteCount, prompts: derived.totals.activePrompts, requests: derived.totals.requests, searchCalls: derived.totals.searchCalls },
      base.period,
    );

  const newInvoice = (description: string, amountUsd: number): BillingInvoice => ({
    id: nextInvoiceId(state.createdInvoices),
    issuedOn: demoNow().slice(0, 10),
    period: base.period.label,
    description,
    amountUsd,
    status: "paid",
  });

  const actions = {
    /** Returns false when the change is blocked by usage above the new plan's limits. */
    changePlan(toId: PlanId): boolean {
      const to = base.plans.find((p) => p.id === toId);
      if (!to || to.id === plan.id) return false;
      const effect = changeEffect(to);
      if (effect.blockers.length > 0) return false;
      const created = effect.prorationUsd > 0 ? [...state.createdInvoices, newInvoice(`Plan change to ${to.name} (prorated)`, effect.prorationUsd)] : state.createdInvoices;
      patch({ planId: to.id, createdInvoices: created }, billingEvent(`Plan changed from ${plan.name} to ${to.name}`));
      toast.push(simulatedToast(`Plan changed to ${to.name}`));
      return true;
    },
    payInvoice(id: string) {
      patch({ invoiceStatus: { ...state.invoiceStatus, [id]: "paid" } }, billingEvent(`Payment recorded for ${id}`));
      toast.push(simulatedToast(`Payment recorded for ${id}`));
    },
  };

  return { base, state, plan, plans: base.plans, organization, ...derived, changeEffect, actions };
}

export type Billing = ReturnType<typeof useBilling>;
