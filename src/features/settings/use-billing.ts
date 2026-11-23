"use client";

import { useMemo } from "react";

import { demoNow, simulatedToast, useDemoCollection, useDemoEvents, useDemoSettings, type DemoEventInput } from "@/demo-state";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatNumber } from "@/lib/format";
import type { Store } from "@/types/core";
import type { BillingBase, BillingContact, BillingHistoryEntry, BillingInvoice, BillingPlan, BillingState, CreditPack, PaymentMethod, PlanId } from "@/types/settings";

import {
  buildMeters,
  historyPoints,
  mergeInvoices,
  nextInvoiceId,
  planChangeEffect,
  sumUsage,
  upgradeNudge,
  websiteUsageRows,
  type PlanChange,
} from "./billing-model";

export type PromptCountRow = { id: string; storeId: string; status: string };

const BILLING_PREFIX = "Billing: ";

export type TimelineEntry = BillingHistoryEntry & { local: boolean };

const billingEvent = (label: string): DemoEventInput => ({ kind: "settings.saved", label: `${BILLING_PREFIX}${label}` });

function entryKind(label: string): BillingHistoryEntry["kind"] {
  const text = label.toLowerCase();
  if (text.includes("payment method")) return "method";
  if (text.includes("refund")) return "refund";
  if (text.includes("plan") || text.includes("subscription")) return "plan";
  if (text.includes("add-on") || text.includes("credit") || text.includes("requests")) return "addon";
  return "payment";
}

/**
 * All Billing state in one place. Server pages pass the static base; the changes (plan, credits, invoices, card,
 * contact, cancellation) live in demo-state under `org.billing` and every change emits an event for the history.
 * Nothing here charges anything or stores card data.
 */
export function useBilling(base: BillingBase, stores: Store[], promptRows: PromptCountRow[], organization: string) {
  const toast = useToast();
  const setting = useDemoSettings<BillingState>("org.billing", base.state);
  const { value: state, patch } = setting;
  const websites = useDemoCollection<Store>("websites", stores).rows;
  const prompts = useDemoCollection<PromptCountRow>("prompts", promptRows).rows;
  const events = useDemoEvents({ kinds: ["settings.saved"] });

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
    const totals = sumUsage(usageRows);
    const websiteCount = websites.filter((w) => w.status !== "archived").length;
    const meters = buildMeters({ plan, credits: state.credits, usage: totals, websites: websiteCount });
    const nudge = upgradeNudge(meters, plan.id, base.plans);
    const chart = historyPoints(base.history, {
      requests: totals.requests,
      limit: plan.limits.requests + state.credits,
    });
    const invoices = mergeInvoices(base.invoices, state.createdInvoices, state.invoiceStatus);
    return { usageRows, totals, websiteCount, meters, nudge, chart, invoices, activePrompts };
  }, [websites, prompts, base, plan, state.credits, state.createdInvoices, state.invoiceStatus]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const local = events
      .filter((e) => e.label.startsWith(BILLING_PREFIX))
      .map<TimelineEntry>((e) => ({ id: e.id, at: e.at, kind: entryKind(e.label), title: e.label.slice(BILLING_PREFIX.length), detail: "Simulated", local: true }));
    const seeded = base.events.map<TimelineEntry>((e) => ({ ...e, local: false }));
    return [...local, ...seeded].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [events, base.events]);

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
      patch({ planId: to.id, createdInvoices: created, cancelAt: null }, billingEvent(`Plan changed from ${plan.name} to ${to.name}`));
      toast.push(simulatedToast(`Plan changed to ${to.name}`));
      return true;
    },
    buyPack(pack: CreditPack) {
      const label = `+${formatNumber(pack.requests)} requests`;
      patch({ credits: state.credits + pack.requests, createdInvoices: [...state.createdInvoices, newInvoice(`Add-on: ${label}`, pack.priceUsd)] }, billingEvent(`Add-on purchased: ${label}`));
      toast.push(simulatedToast(`${label} added`));
    },
    payInvoice(id: string) {
      patch({ invoiceStatus: { ...state.invoiceStatus, [id]: "paid" } }, billingEvent(`Payment recorded for ${id}`));
      toast.push(simulatedToast(`Payment recorded for ${id}`));
    },
    updatePaymentMethod(method: PaymentMethod) {
      patch({ paymentMethod: method }, billingEvent(`Payment method changed to ${method.brand} ending ${method.last4} (demo)`));
      toast.push(simulatedToast("Payment method updated"));
    },
    saveContact(contact: BillingContact) {
      patch({ contact }, billingEvent("Billing contact and tax details saved"));
      toast.push(simulatedToast("Billing contact saved"));
    },
    cancel() {
      patch({ cancelAt: base.period.renewsOn }, billingEvent(`Subscription set to cancel on ${formatDate(base.period.renewsOn)}`));
      toast.push(simulatedToast("Cancellation scheduled", "warning"));
    },
    resume() {
      patch({ cancelAt: null }, billingEvent("Subscription resumed"));
      toast.push(simulatedToast("Subscription resumed"));
    },
  };

  return { base, state, plan, plans: base.plans, organization, ...derived, timeline, changeEffect, actions };
}

export type Billing = ReturnType<typeof useBilling>;
