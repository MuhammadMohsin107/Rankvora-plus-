import { describe, expect, it } from "vitest";

import { DEMO_BILLING, DEMO_BILLING_INVOICES, DEMO_PLANS, DEMO_UNIT_COST_USD, DEMO_USAGE_SEEDS } from "@/demo/settings";
import { DEMO_USAGE } from "@/demo/shared";

import {
  buildMeters,
  historyPoints,
  mergeInvoices,
  meterState,
  meterWarnings,
  nextInvoiceId,
  nextPlanUp,
  paidTotalUsd,
  planChangeEffect,
  prorate,
  sumUsage,
  upgradeNudge,
  validateCvc,
  validateDemoCard,
  validateExpiry,
  websiteUsageRows,
} from "./billing-model";

const plan = (id: string) => DEMO_PLANS.find((p) => p.id === id)!;
const sites = [
  { id: "runpro-pk", name: "RunPro Pakistan" },
  { id: "runpro-ae", name: "RunPro UAE" },
  { id: "homefit-uk", name: "HomeFit UK" },
  { id: "nutrition", name: "Nutrition" },
  { id: "demo-websites-1", name: "New site" },
];
const period = { start: DEMO_BILLING.period.start, renewsOn: DEMO_BILLING.period.renewsOn };

describe("usage totals", () => {
  const rows = websiteUsageRows(sites, DEMO_USAGE_SEEDS, DEMO_UNIT_COST_USD, { "runpro-pk": 9, "runpro-ae": 5, nutrition: 7 });
  const total = sumUsage(rows);

  it("adds per-website requests up to the organization total, including a locally created website with no usage", () => {
    expect(rows.map((r) => r.requests)).toEqual([912, 142, 0, 198, 0]);
    expect(total.requests).toBe(1252);
    expect(total.requests).toBe(DEMO_USAGE.requests);
    expect(rows.reduce((s, r) => s + r.requests, 0)).toBe(total.requests);
  });

  it("matches the per-website request counts in the shared demo usage", () => {
    for (const row of DEMO_USAGE.perStore) expect(rows.find((r) => r.websiteId === row.storeId)?.requests).toBe(row.requests);
  });

  it("adds cost in whole cents so rows equal the total", () => {
    expect(rows.reduce((s, r) => s + r.costCents, 0)).toBe(total.costCents);
    expect(total.costCents).toBe(7185);
  });

  it("counts one search call per request and sums active prompts", () => {
    expect(total.searchCalls).toBe(total.requests);
    expect(total.activePrompts).toBe(21);
  });
});

describe("near-limit detection", () => {
  it("is ok below 85 percent", () => {
    expect(meterState(84, 100)).toBe("ok");
  });
  it("is near from 85 percent and below the limit", () => {
    expect(meterState(85, 100)).toBe("near");
    expect(meterState(99, 100)).toBe("near");
  });
  it("is at_limit from 100 percent", () => {
    expect(meterState(100, 100)).toBe("at_limit");
    expect(meterState(120, 100)).toBe("at_limit");
  });
  it("treats a zero limit with use as at_limit and without use as ok", () => {
    expect(meterState(0, 0)).toBe("ok");
    expect(meterState(1, 0)).toBe("at_limit");
  });

  const usage = { requests: 1252, searchCalls: 1252, costCents: 7185, activePrompts: 21 };
  it("flags seats and search calls on Growth with the demo numbers", () => {
    const meters = buildMeters({ plan: plan("growth"), credits: 0, usage, websites: 4, seats: 6 });
    const byId = Object.fromEntries(meters.map((m) => [m.id, m.state]));
    expect(byId).toMatchObject({ requests: "ok", websites: "ok", prompts: "ok", cost: "ok", seats: "near", searchCalls: "near" });
    expect(meterWarnings(meters).map((m) => m.id)).toEqual(["searchCalls", "seats"]);
  });

  it("credits raise the request and search limits and clear the search warning", () => {
    const meters = buildMeters({ plan: plan("growth"), credits: 500, usage, websites: 4, seats: 6 });
    expect(meters.find((m) => m.id === "requests")?.limit).toBe(2900);
    expect(meters.find((m) => m.id === "searchCalls")?.state).toBe("ok");
  });

  it("shows the upgrade nudge only when a limit is near and a larger plan exists", () => {
    const near = buildMeters({ plan: plan("growth"), credits: 0, usage, websites: 4, seats: 6 });
    expect(upgradeNudge(near, "growth", DEMO_PLANS)?.target.id).toBe("agency");
    const calm = buildMeters({ plan: plan("growth"), credits: 0, usage, websites: 4, seats: 4 });
    const calmSearch = buildMeters({ plan: plan("growth"), credits: 500, usage, websites: 4, seats: 4 });
    expect(meterWarnings(calm).length).toBeGreaterThan(0);
    expect(upgradeNudge(calmSearch, "growth", DEMO_PLANS)).toBeNull();
    expect(upgradeNudge(near, "agency", DEMO_PLANS)).toBeNull();
    expect(nextPlanUp("agency", DEMO_PLANS)).toBeNull();
  });
});

describe("plan change effect", () => {
  const usage = { websites: 4, prompts: 21, seats: 6, requests: 1252, searchCalls: 1252 };

  it("upgrades raise every limit and charge a prorated amount for the days left", () => {
    const change = planChangeEffect(plan("growth"), plan("agency"), usage, period, "2026-11-19T09:00:00Z");
    expect(change.direction).toBe("upgrade");
    expect(change.priceDeltaUsd).toBe(250);
    expect(change.blockers).toEqual([]);
    expect(change.limitChanges.find((l) => l.id === "seats")).toMatchObject({ from: 7, to: 20 });
    // 12 of 30 days left: 250 * 12 / 30
    expect(change.prorationUsd).toBe(100);
  });

  it("downgrades are free of proration and blocked while usage exceeds the new limits", () => {
    const change = planChangeEffect(plan("growth"), plan("starter"), usage, period, "2026-11-19T09:00:00Z");
    expect(change.direction).toBe("downgrade");
    expect(change.prorationUsd).toBe(0);
    expect(change.blockers.map((b) => b.split(":")[0])).toEqual(["Websites", "AI requests", "Search calls", "Seats"]);
  });

  it("allows a downgrade that fits", () => {
    const change = planChangeEffect(plan("agency"), plan("growth"), usage, period);
    expect(change.blockers).toEqual([]);
  });

  it("the same plan is no change", () => {
    expect(planChangeEffect(plan("growth"), plan("growth"), usage, period).direction).toBe("same");
  });

  it("prorates in cents and never charges a negative amount", () => {
    expect(prorate(250, 12, 30)).toBe(100);
    expect(prorate(100, 7, 30)).toBe(23.33);
    expect(prorate(-100, 12, 30)).toBe(0);
    expect(prorate(100, 12, 0)).toBe(0);
  });
});

describe("history chart", () => {
  it("keeps months without data as null and replaces the current month with live values", () => {
    const points = historyPoints(DEMO_BILLING.history, { requests: 1200, limit: 2900 });
    expect(points.requests.map((p) => p.y)).toEqual([null, null, 318, 1310, 1742, 1200]);
    expect(points.limit.map((p) => p.y)).toEqual([null, null, 600, 2400, 2400, 2900]);
    expect(points.requests[5].detail).toBe("1,200 of 2,900, to date");
  });
});

describe("invoices", () => {
  it("includes one failed and one refunded invoice and all four statuses", () => {
    const statuses = new Set(DEMO_BILLING_INVOICES.map((i) => i.status));
    expect([...statuses].sort()).toEqual(["failed", "open", "paid", "refunded"]);
  });

  it("merges created invoices first and applies status overrides", () => {
    const created = [{ id: "INV-2026-D01", issuedOn: "2026-11-19", period: "Nov 2026", description: "Add-on", amountUsd: 80, status: "paid" as const }];
    const merged = mergeInvoices(DEMO_BILLING_INVOICES, created, { "INV-2026-1102": "paid" });
    expect(merged[0].id).toBe("INV-2026-D01");
    expect(merged.find((i) => i.id === "INV-2026-1102")?.status).toBe("paid");
    expect(nextInvoiceId(created)).toBe("INV-2026-D02");
    expect(nextInvoiceId([])).toBe("INV-2026-D01");
  });

  it("counts only paid invoices as collected", () => {
    expect(paidTotalUsd(DEMO_BILLING_INVOICES)).toBe(149 * 3 + 49);
  });
});

describe("demo card validation", () => {
  it("accepts published test numbers with spaces", () => {
    expect(validateDemoCard("4242 4242 4242 4242")).toBeNull();
    expect(validateDemoCard("3782 822463 10005")).toBeNull();
  });
  it("rejects anything else, including numbers that pass the Luhn check", () => {
    expect(validateDemoCard("4111 1111 1111 1111")).toMatch(/Real card numbers are not accepted/);
    expect(validateDemoCard("")).toBe("Card number is required.");
    expect(validateDemoCard("4242")).toMatch(/full demo card/);
  });
  it("validates expiry against the demo date", () => {
    expect(validateExpiry("12/28")).toBeNull();
    expect(validateExpiry("10/26")).toBe("This card has expired.");
    expect(validateExpiry("13/28")).toMatch(/between 01 and 12/);
    expect(validateExpiry("1228")).toMatch(/MM\/YY/);
  });
  it("validates the security code length by brand", () => {
    expect(validateCvc("123", "Visa")).toBeNull();
    expect(validateCvc("1234", "Visa")).toMatch(/3-digit/);
    expect(validateCvc("1234", "Amex")).toBeNull();
  });
});
