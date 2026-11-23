/**
 * Pure helpers for the demonstration Billing screens: usage totals, near-limit detection,
 * plan change effect and invoices. No React, no storage, no network.
 * Nothing here talks to a payment provider.
 */
import { DEMO_NOW, formatNumber } from "@/lib/format";
import type { BillingInvoice, BillingPlan, InvoiceStatus, PlanId, UsageMonth, WebsiteUsageSeed } from "@/types/settings";

export const NEAR_LIMIT_RATIO = 0.85;

export type MeterState = "ok" | "near" | "at_limit";

/** ok below 85 percent, near from 85 percent, at_limit from 100 percent. A zero limit with any use is at_limit. */
export function meterState(used: number, limit: number): MeterState {
  if (limit <= 0) return used > 0 ? "at_limit" : "ok";
  const ratio = used / limit;
  if (ratio >= 1) return "at_limit";
  if (ratio >= NEAR_LIMIT_RATIO) return "near";
  return "ok";
}

export type ProviderKey = "openai" | "gemini" | "perplexity";
export const PROVIDER_KEYS: ProviderKey[] = ["openai", "gemini", "perplexity"];

/* ───────── Usage ───────── */

export type WebsiteUsage = {
  websiteId: string;
  name: string;
  requests: number;
  /** Requests by AI provider. The values add up to `requests`. */
  byProvider: Record<ProviderKey, number>;
  /** One search call is made per request in the demonstration data. */
  searchCalls: number;
  /** Estimated provider cost in whole cents, so rows always add up to the total. */
  costCents: number;
  activePrompts: number;
};

export type UsageTotals = { requests: number; searchCalls: number; costCents: number; activePrompts: number };

export function seedRequests(seed: Pick<WebsiteUsageSeed, "requests"> | undefined): number {
  if (!seed) return 0;
  return PROVIDER_KEYS.reduce((sum, key) => sum + (seed.requests[key] ?? 0), 0);
}

export function seedCostCents(seed: Pick<WebsiteUsageSeed, "requests"> | undefined, unitCostUsd: Record<ProviderKey, number>): number {
  if (!seed) return 0;
  return PROVIDER_KEYS.reduce((sum, key) => sum + Math.round((seed.requests[key] ?? 0) * unitCostUsd[key] * 100), 0);
}

/**
 * One row per website (including websites created locally, which have no usage yet).
 * The organization total is the sum of these rows, so the breakdown always adds up.
 */
export function websiteUsageRows(
  websites: { id: string; name: string }[],
  seeds: WebsiteUsageSeed[],
  unitCostUsd: Record<ProviderKey, number>,
  activePromptsByWebsite: Record<string, number>,
): WebsiteUsage[] {
  return websites.map((site) => {
    const seed = seeds.find((s) => s.websiteId === site.id);
    const requests = seedRequests(seed);
    return {
      websiteId: site.id,
      name: site.name,
      requests,
      byProvider: { openai: seed?.requests.openai ?? 0, gemini: seed?.requests.gemini ?? 0, perplexity: seed?.requests.perplexity ?? 0 },
      searchCalls: requests,
      costCents: seedCostCents(seed, unitCostUsd),
      activePrompts: activePromptsByWebsite[site.id] ?? 0,
    };
  });
}

export function sumUsage(rows: WebsiteUsage[]): UsageTotals {
  return rows.reduce<UsageTotals>(
    (total, row) => ({
      requests: total.requests + row.requests,
      searchCalls: total.searchCalls + row.searchCalls,
      costCents: total.costCents + row.costCents,
      activePrompts: total.activePrompts + row.activePrompts,
    }),
    { requests: 0, searchCalls: 0, costCents: 0, activePrompts: 0 },
  );
}

export type ProviderUsage = { provider: ProviderKey; requests: number; costCents: number };

/** Requests and estimated cost per AI provider across all websites. Costs use the same per-website rounding as the website rows, so they add up to the same total. */
export function providerUsageRows(rows: WebsiteUsage[], unitCostUsd: Record<ProviderKey, number>): ProviderUsage[] {
  return PROVIDER_KEYS.map((provider) => ({
    provider,
    requests: rows.reduce((sum, r) => sum + r.byProvider[provider], 0),
    costCents: rows.reduce((sum, r) => sum + Math.round(r.byProvider[provider] * unitCostUsd[provider] * 100), 0),
  }));
}

export type MeterId = "requests" | "searchCalls" | "websites" | "prompts" | "cost";

export type Meter = {
  id: MeterId;
  label: string;
  used: number;
  limit: number;
  unit: "count" | "usd";
  state: MeterState;
  /** Extra context shown under the bar. */
  note?: string;
};

export function buildMeters(input: { plan: BillingPlan; usage: UsageTotals; websites: number }): Meter[] {
  const { plan, usage, websites } = input;
  const costUsd = usage.costCents / 100;
  const make = (id: MeterId, label: string, used: number, limit: number, unit: Meter["unit"] = "count", note?: string): Meter => ({
    id,
    label,
    used,
    limit,
    unit,
    state: meterState(used, limit),
    note,
  });
  return [
    make("requests", "AI requests", usage.requests, plan.limits.requests),
    make("searchCalls", "Search calls", usage.searchCalls, plan.limits.searchCalls),
    make("websites", "Websites", websites, plan.limits.websites),
    make("prompts", "Active prompts", usage.activePrompts, plan.limits.prompts),
    make("cost", "Estimated cost", costUsd, plan.limits.usageAllowanceUsd, "usd"),
  ];
}

/** Meters that are near or at their limit. */
export function meterWarnings(meters: Meter[]): Meter[] {
  return meters.filter((m) => m.state !== "ok");
}

export function nextPlanUp(planId: PlanId, plans: BillingPlan[]): BillingPlan | null {
  const index = plans.findIndex((p) => p.id === planId);
  return index >= 0 && index < plans.length - 1 ? plans[index + 1] : null;
}

/** The upgrade nudge shows only when a limit is near or reached and a larger plan exists. */
export function upgradeNudge(meters: Meter[], planId: PlanId, plans: BillingPlan[]): { meters: Meter[]; target: BillingPlan } | null {
  const warnings = meterWarnings(meters);
  const target = nextPlanUp(planId, plans);
  return warnings.length > 0 && target ? { meters: warnings, target } : null;
}

/* ───────── Plan change ───────── */

export type PlanChangeUsage = { websites: number; prompts: number; requests: number; searchCalls: number };

export type PlanChange = {
  direction: "upgrade" | "downgrade" | "same";
  priceDeltaUsd: number;
  limitChanges: { id: string; label: string; from: number; to: number }[];
  /** Reasons the change cannot happen now. Empty means allowed. */
  blockers: string[];
  /** Prorated charge for the rest of the period. Zero for downgrades. */
  prorationUsd: number;
};

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(toIso) - Date.parse(fromIso);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Price difference for the days left in the period, rounded to cents. Only upgrades are charged. */
export function prorate(priceDeltaUsd: number, daysLeft: number, daysInPeriod: number): number {
  if (priceDeltaUsd <= 0 || daysInPeriod <= 0) return 0;
  return Math.round(((priceDeltaUsd * Math.min(daysLeft, daysInPeriod)) / daysInPeriod) * 100) / 100;
}

export function planChangeEffect(from: BillingPlan, to: BillingPlan, usage: PlanChangeUsage, period: { renewsOn: string; start: string }, now: string = DEMO_NOW): PlanChange {
  const priceDeltaUsd = to.priceUsd - from.priceUsd;
  const direction = to.id === from.id ? "same" : priceDeltaUsd > 0 ? "upgrade" : "downgrade";
  const rows: { id: keyof PlanChangeUsage; label: string; limit: (p: BillingPlan) => number }[] = [
    { id: "websites", label: "Websites", limit: (p) => p.limits.websites },
    { id: "prompts", label: "Active prompts", limit: (p) => p.limits.prompts },
    { id: "requests", label: "AI requests", limit: (p) => p.limits.requests },
    { id: "searchCalls", label: "Search calls", limit: (p) => p.limits.searchCalls },
  ];
  const limitChanges = rows.map((r) => ({ id: r.id, label: r.label, from: r.limit(from), to: r.limit(to) })).filter((r) => r.from !== r.to);
  const blockers = rows
    .filter((r) => usage[r.id] > r.limit(to))
    .map((r) => `${r.label}: ${formatNumber(usage[r.id])} in use, ${to.name} includes ${formatNumber(r.limit(to))}`);
  const daysInPeriod = daysBetween(period.start, period.renewsOn);
  const daysLeft = daysBetween(now, period.renewsOn);
  return { direction, priceDeltaUsd, limitChanges, blockers, prorationUsd: prorate(priceDeltaUsd, daysLeft, daysInPeriod) };
}

/* ───────── History chart ───────── */

export type ChartPoint = { x: string; y: number | null; detail?: string };

/** Six months of requests and plan limit. The last month is replaced with the live period values. */
export function historyPoints(history: UsageMonth[], live: { requests: number; limit: number }): { requests: ChartPoint[]; limit: ChartPoint[] } {
  const last = history.length - 1;
  const rows = history.map((m, i) => (i === last ? { label: m.label, requests: live.requests, limit: live.limit } : m));
  return {
    requests: rows.map((m, i) => ({
      x: m.label,
      y: m.requests,
      detail: m.requests === null ? undefined : `${formatNumber(m.requests)} of ${formatNumber(m.limit ?? 0)}${i === last ? ", to date" : ""}`,
    })),
    limit: rows.map((m) => ({ x: m.label, y: m.limit })),
  };
}

/** "$149" for whole dollars, "$60.63" otherwise. */
export function formatUsd(value: number): string {
  return Number.isInteger(value) ? `$${formatNumber(value)}` : `$${value.toFixed(2)}`;
}

/* ───────── Invoices ───────── */

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { paid: "Paid", open: "Open", failed: "Failed", refunded: "Refunded" };

/** Newest first. Local overrides (for example "pay now") win over the seeded status. */
export function mergeInvoices(base: BillingInvoice[], created: BillingInvoice[], statusOverrides: Record<string, InvoiceStatus>): BillingInvoice[] {
  return [...created, ...base]
    .map((inv) => (statusOverrides[inv.id] ? { ...inv, status: statusOverrides[inv.id], note: statusOverrides[inv.id] === "paid" ? undefined : inv.note } : inv))
    .sort((a, b) => (a.issuedOn === b.issuedOn ? (a.id < b.id ? 1 : -1) : a.issuedOn < b.issuedOn ? 1 : -1));
}

export function nextInvoiceId(created: BillingInvoice[]): string {
  return `INV-2026-D${String(created.length + 1).padStart(2, "0")}`;
}

/** Total of invoices that were collected: paid only. Open, failed and refunded invoices are not counted. */
export function paidTotalUsd(invoices: BillingInvoice[]): number {
  return invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amountUsd, 0);
}
