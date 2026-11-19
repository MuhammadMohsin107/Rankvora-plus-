import { describe, expect, it } from "vitest";

import { previewComparison } from "@/features/comparison/engine";
import { resolveSide } from "@/features/comparison/sides";
import type { SlotCore } from "@/types/comparison";

import { getComparisonDetail, getWizardData, listComparisons, listSnapshots } from "./comparison";
import { getAuditReportData, getMonitoringReportData, getReportData, listHistorical, listReports } from "./reports";

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

describe("runpro-ae comparisons", () => {
  const AE = "runpro-ae";

  it("agrees with the registry verdicts", async () => {
    const records = await listComparisons(AE);
    expect(records.map((r) => r.id)).toEqual(["cmp-ae-001", "cmp-ae-002", "cmp-ae-003", "cmp-ae-004"]);
    for (const record of records) {
      const detail = await getComparisonDetail(AE, record.id);
      expect(detail?.result.verdict, record.id).toBe(record.comparability);
    }
  });

  it("reconciles whole-source numbers with the audits and runs (cmp-ae-001)", async () => {
    const { result } = (await getComparisonDetail(AE, "cmp-ae-001"))!;
    expect(result.wholeSource).toEqual({ baseline: { n: 4, d: 28 }, current: { n: 9, d: 30 } });
    expect(result.coverage).toEqual({ n: 28, d: 30 });
    expect(result.excluded.every((e) => e.reason === "failed_baseline")).toBe(true);
  });

  it("uses only runs of this store in a period window (cmp-ae-002)", async () => {
    const detail = (await getComparisonDetail(AE, "cmp-ae-002"))!;
    expect(detail.baseline.runIds).toEqual(["run-ae-001", "run-ae-002", "run-ae-003"]);
    expect(detail.current.runIds).toEqual(["run-ae-004", "run-ae-005", "run-ae-006"]);
    expect(detail.fixes.map((f) => f.taskId)).toEqual(["task-ae-005"]);
  });

  it("is insufficient when the focused audit shares only a few slots (cmp-ae-004)", async () => {
    const { result } = (await getComparisonDetail(AE, "cmp-ae-004"))!;
    expect(result.matchedPairs).toBeLessThan(20);
    expect(result.headline.every((m) => m.sample !== "ok")).toBe(true);
  });

  it("classifies the store's own and competitor domains", async () => {
    const { result } = (await getComparisonDetail(AE, "cmp-ae-001"))!;
    const owned = result.domains.filter((d) => d.source === "owned").map((d) => d.domain);
    expect(owned).toEqual(["runpro.ae"]);
  });

  it("lists AE snapshots and report records", async () => {
    const snaps = await listSnapshots(AE);
    expect(snaps.map((s) => s.snapshotId)).toEqual([
      "snap-aud-ae-001",
      "snap-mon-ae-001",
      "snap-mon-ae-002",
      "snap-mon-ae-003",
      "snap-mon-ae-004",
      "snap-aud-ae-002",
      "snap-mon-ae-005",
      "snap-aud-ae-003",
      "snap-mon-ae-006",
    ]);
    const reports = await listReports(AE);
    expect(reports).toHaveLength(8);
    expect(reports.filter((r) => r.status === "failed").map((r) => r.id)).toEqual(["rep-aud-ae-003"]);
  });

  it("builds report content for every ready AE report", async () => {
    for (const report of await listReports(AE)) {
      if (report.status !== "ready") continue;
      expect(await getReportData(AE, report), report.id).not.toBeNull();
    }
    const audit = (await getAuditReportData(AE, "aud-ae-002"))!;
    expect(audit.audit.mention).toEqual({ n: 7, d: 30 });
    const monitoring = (await getMonitoringReportData(AE, "run-ae-006"))!;
    expect(monitoring.mention.current).toEqual({ n: 9, d: 30 });
    expect(monitoring.mention.previous).toEqual({ n: 6, d: 30 });
    expect(monitoring.previousRunId).toBe("run-ae-005");
  });
});

describe("a store without runs", () => {
  it("has nothing to compare or report, and does not crash", async () => {
    const store = "homefit-uk";
    expect(await listComparisons(store)).toEqual([]);
    expect(await listSnapshots(store)).toEqual([]);
    expect(await listReports(store)).toEqual([]);
    expect(await listHistorical(store)).toEqual([]);
    const wizard = await getWizardData(store);
    expect(wizard?.snapshots).toEqual([]);
  });
});

describe("a hard check blocks the comparison", () => {
  it("is not comparable when both sides share a run, and computes nothing misleading", async () => {
    const wizard = (await getWizardData("runpro-ae"))!;
    const side = resolveSide<SlotCore>("snap-aud-ae-001", wizard.snapshots, wizard.cores, wizard.brand)!;
    const preview = previewComparison(side.info, side.info, side.rows, side.rows, {});
    expect(preview.assessment.verdict).toBe("not_comparable");
    expect(preview.assessment.checks.find((c) => c.id === "independent-sources")?.state).toBe("fail");
  });
});
