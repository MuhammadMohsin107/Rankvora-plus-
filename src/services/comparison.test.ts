import { describe, expect, it } from "vitest";

import { getComparisonDetail, listComparisons } from "./comparison";

const STORE = "runpro-pk";

describe("comparison engine on the registry comparisons", () => {
  it("agrees with the registry verdicts", async () => {
    for (const record of await listComparisons(STORE)) {
      const detail = await getComparisonDetail(STORE, record.id);
      expect(detail?.result.verdict, record.id).toBe(record.comparability);
    }
  });

  it("matches slots strictly and discloses what it left out (cmp-001)", async () => {
    const { result } = (await getComparisonDetail(STORE, "cmp-001"))!;
    expect(result.matchedPairs).toBe(38);
    expect(result.coverage).toEqual({ n: 38, d: 54 });
    expect(result.unmatched.every((u) => u.reason === "version_changed")).toBe(true);
    expect(result.excluded.every((e) => e.reason === "failed_both")).toBe(true);
    // Whole-source numbers still reconcile with the registry headline.
    expect(result.wholeSource).toEqual({ baseline: { n: 18, d: 48 }, current: { n: 25, d: 48 } });
    const mention = result.headline.find((m) => m.id === "mention")!;
    expect(mention.baseline).toEqual({ n: 12, d: 38 });
    expect(mention.current).toEqual({ n: 17, d: 38 });
  });

  it("is insufficient below 20 matched pairs (cmp-003)", async () => {
    const { result } = (await getComparisonDetail(STORE, "cmp-003"))!;
    expect(result.matchedPairs).toBeLessThan(20);
    expect(result.verdict).toBe("insufficient_data");
    expect(result.headline.every((m) => m.sample !== "ok")).toBe(true);
  });

  it("never counts failed requests as absent", async () => {
    const { result } = (await getComparisonDetail(STORE, "cmp-004"))!;
    expect(result.excluded.length).toBeGreaterThan(0);
    const mention = result.headline.find((m) => m.id === "mention")!;
    expect(mention.baseline!.d).toBe(result.matchedPairs);
  });
});
