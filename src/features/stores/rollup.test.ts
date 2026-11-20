import { describe, expect, it } from "vitest";

import type { Rate, Store, StoreSummary } from "@/types/core";

import { pooledLabel, pooledRollup } from "./rollup";

const rate = (n: number, d: number): Rate => ({ n, d });

function summary(over: Partial<StoreSummary> = {}): StoreSummary {
  return {
    mention: rate(25, 48),
    mentionPrevious: rate(18, 48),
    recommendation: rate(11, 48),
    recommendationPrevious: rate(8, 48),
    ownedCitation: rate(7, 36),
    ownedCitationPrevious: rate(5, 36),
    openFindings: 0,
    pendingTasks: 0,
    openAlerts: 0,
    lastRunAt: null,
    nextRunAt: null,
    activePrompts: 0,
    ...over,
  };
}

function site(id: string, market: string, s: StoreSummary | null, status: Store["status"] = "active"): Store {
  return {
    id,
    name: id,
    brandName: id,
    domain: `${id}.example`,
    platform: "custom",
    market,
    marketName: market,
    language: "en",
    timezone: "UTC",
    status,
    industry: "Other",
    integrations: { commerce: "manual", searchConsole: "not_connected" },
    channelIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    summary: s,
  };
}

describe("pooledRollup", () => {
  const pk = site("pk", "PK", summary());
  const ae = site("ae", "AE", summary({ mention: rate(9, 30), mentionPrevious: rate(6, 30), recommendation: rate(3, 30), recommendationPrevious: rate(3, 30), ownedCitation: rate(0, 0), ownedCitationPrevious: rate(0, 0) }));
  const uk = site("uk", "GB", null, "needs_review");

  it("adds counts instead of averaging percentages", () => {
    const r = pooledRollup([pk, ae, uk]);
    expect(r.mention).toEqual({ n: 34, d: 78 });
    // The average of 52.1% and 30% would be 41.0%; the pooled rate is 43.6%.
    expect((r.mention.n / r.mention.d) * 100).toBeCloseTo(43.59, 1);
    expect(r.recommendation).toEqual({ n: 14, d: 78 });
  });

  it("leaves websites without data out and never counts them as zero", () => {
    const r = pooledRollup([pk, ae, uk]);
    expect(r.tracked).toBe(2);
    expect(r.total).toBe(3);
    expect(r.untracked.map((w) => w.id)).toEqual(["uk"]);
    expect(pooledLabel(r)).toBe("Pooled across 2 websites");
  });

  it("pools citations only from websites that have citation data", () => {
    const r = pooledRollup([pk, ae, uk]);
    expect(r.citation).toEqual({ n: 7, d: 36 });
    expect(r.citationWebsites).toBe(1);
  });

  it("ignores archived websites", () => {
    const r = pooledRollup([pk, { ...ae, status: "archived" }]);
    expect(r.total).toBe(1);
    expect(r.mention).toEqual({ n: 25, d: 48 });
  });

  it("returns an empty denominator and no change when nothing is tracked", () => {
    const r = pooledRollup([uk]);
    expect(r.mention).toEqual({ n: 0, d: 0 });
    expect(r.change.mention).toBeNull();
    expect(pooledLabel(r)).toBe("Pooled across 0 websites");
  });

  it("reports the pooled change in percentage points", () => {
    const r = pooledRollup([pk, ae]);
    // previous 24/78, current 34/78
    expect(r.change.mention).toBeCloseTo(((34 - 24) / 78) * 100, 5);
  });
});
