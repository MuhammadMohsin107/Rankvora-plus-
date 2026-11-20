import { describe, expect, it } from "vitest";

import { applyOverlay } from "@/demo-state/merge";
import { createDemoStore, type StorageLike } from "@/demo-state/store";
import { decodeDefinition, encodeDefinition, filterCount, findSnapshot, isLocalComparisonId, normalizeFilters, snapshotsAround } from "@/features/comparison/definition";
import { csvCell, reportHtml, toCsv } from "@/features/comparison/export";
import { buildInsights } from "@/features/comparison/insights";
import { countsText, hasIntegerCounts, percentText } from "@/features/comparison/metric-format";
import { groupByPrompt } from "@/features/comparison/prompt-groups";
import { getComparisonDetail, listComparisons, listSnapshots } from "@/services/comparison";
import type { ComparisonDefinition, ComparisonRecord } from "@/types/comparison";

const PK = "runpro-pk";
const AE = "runpro-ae";
const NU = "nutrition";

describe("comparison definition ids", () => {
  const def: ComparisonDefinition = { type: "period_vs_period", baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19", filters: { channelId: "ch-openai", market: "PK" }, aggregation: "pooled" };

  it("round-trips a definition, including a date window with an en dash", () => {
    const id = encodeDefinition(def);
    expect(isLocalComparisonId(id)).toBe(true);
    expect(decodeDefinition(id)).toEqual(def);
  });

  it("gives the same id for the same scope however the filters were typed", () => {
    const a = encodeDefinition({ ...def, filters: { market: "PK", channelId: "ch-openai", language: "" } });
    expect(a).toBe(encodeDefinition(def));
    expect(filterCount({ market: "PK", language: "", channelIds: [] })).toBe(1);
    expect(normalizeFilters({ channelIds: ["b", "a"] })).toEqual({ channelIds: ["a", "b"] });
  });

  it("rejects ids that are not definitions", () => {
    expect(decodeDefinition("cmp-001")).toBeNull();
    expect(decodeDefinition("cmp-u-not-base64!!")).toBeNull();
    expect(decodeDefinition("cmp-u-e30")).toBeNull();
  });

  it("finds a snapshot by snapshot id or by run id, and places a fix between two snapshots", async () => {
    const snaps = await listSnapshots(PK);
    expect(findSnapshot(snaps, "run-008")?.snapshotId).toBe("snap-mon-008");
    expect(findSnapshot(snaps, "snap-aud-001")?.sourceId).toBe("aud-001");
    expect(findSnapshot(snaps, "nope")).toBeUndefined();
    const around = snapshotsAround(snaps, "2026-11-04T10:30:00Z");
    expect(around.before!.date <= "2026-11-04T10:30:00Z").toBe(true);
    expect(around.after!.date > "2026-11-04T10:30:00Z").toBe(true);
  });
});

describe("a comparison created in the wizard is computed from its id", () => {
  it("applies the chosen scope and aggregation", async () => {
    const full = (await getComparisonDetail(PK, "cmp-001"))!;
    const def: ComparisonDefinition = { type: "initial_vs_latest", baseline: "snap-aud-001", current: "snap-mon-008", filters: { channelId: "ch-openai" }, aggregation: "pooled" };
    const id = encodeDefinition(def);
    const scoped = (await getComparisonDetail(PK, id))!;
    expect(scoped.record.simulated).toBe(true);
    expect(scoped.record.filters).toEqual({ channelId: "ch-openai" });
    expect(scoped.result.aggregation).toBe("pooled");
    expect(scoped.result.matchedPairs).toBeGreaterThan(0);
    expect(scoped.result.matchedPairs).toBeLessThan(full.result.matchedPairs);
    expect(scoped.result.channels.map((c) => c.channelId)).toEqual(["ch-openai"]);
    expect(scoped.record.comparability).toBe(scoped.result.verdict);
    expect(scoped.record.matched).toEqual(scoped.result.coverage);
  });

  it("never lets a hard-check failure read as comparable", async () => {
    const id = encodeDefinition({ type: "snapshot_vs_snapshot", baseline: "snap-aud-001", current: "snap-aud-001", filters: {}, aggregation: "matched_slot_macro" });
    const detail = (await getComparisonDetail(PK, id))!;
    expect(detail.result.verdict).toBe("not_comparable");
    expect(detail.record.status).toBe("not_comparable");
  });

  it("returns null for an id that is neither seeded nor a definition", async () => {
    expect(await getComparisonDetail(PK, "cmp-999")).toBeNull();
    expect(await getComparisonDetail(PK, "cmp-u-zzzz")).toBeNull();
  });

  it("lists seeded comparisons with their matched coverage", async () => {
    const rows = await listComparisons(PK);
    expect(rows.every((r) => r.storeId === PK && !r.archived && r.matched && r.matched.d > 0)).toBe(true);
  });
});

describe("averages and counts (the macro-average rule)", () => {
  it("never prints a fractional numerator, for any seeded comparison", async () => {
    for (const store of [PK, AE, NU]) {
      for (const record of await listComparisons(store)) {
        const { result } = (await getComparisonDetail(store, record.id))!;
        for (const metric of [...result.headline, result.successRate, ...result.competitors, ...result.channels.flatMap((c) => [c.mention, c.recommendation, c.citation])]) {
          expect(hasIntegerCounts(metric), `${record.id} ${metric.id}`).toBe(true);
          for (const side of ["baseline", "current"] as const) {
            const text = countsText(metric, side);
            if (text) expect(text, `${record.id} ${metric.id}`).toMatch(/^\d+ of \d+ /);
          }
        }
      }
    }
  });

  it("labels the headline as an average when slots hold several responses, and keeps counts whole", async () => {
    const { result } = (await getComparisonDetail(PK, "cmp-002"))!;
    const mention = result.headline.find((m) => m.id === "mention")!;
    expect(mention.basis).toBe("average");
    expect(mention.baseline!.n).toBeGreaterThan(mention.cohort);
    expect(Number.isInteger(mention.baseline!.n) && Number.isInteger(mention.baseline!.d)).toBe(true);
    expect(percentText(mention, "baseline")).toMatch(/^\d+\.\d%$/);
  });

  it("shows an interval only when it is valid for the counts shown", async () => {
    for (const store of [PK, AE, NU]) {
      for (const record of await listComparisons(store)) {
        const { result } = (await getComparisonDetail(store, record.id))!;
        for (const metric of result.headline) {
          if (metric.baselineCi && metric.basis === "average") {
            // equal denominators on every slot: the average equals n / d
            expect(metric.baselineRate).toBeCloseTo(metric.baseline!.n / metric.baseline!.d, 10);
          }
        }
      }
    }
  });

  it("pooled aggregation equals counts, average equals the mean of slot rates", async () => {
    const pooled = (await getComparisonDetail(PK, encodeDefinition({ type: "period_vs_period", baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19", filters: {}, aggregation: "pooled" })))!;
    const m = pooled.result.headline.find((x) => x.id === "mention")!;
    expect(m.basis).toBe("pooled");
    expect(m.baselineRate).toBeCloseTo(m.baseline!.n / m.baseline!.d, 10);
    expect(m.baselineCi).not.toBeNull();
  });

  it("keeps percentage points apart from relative change", async () => {
    const { result } = (await getComparisonDetail(PK, "cmp-001"))!;
    const m = result.headline.find((x) => x.id === "mention")!;
    expect(m.pointChange).toBeCloseTo((m.currentRate! - m.baselineRate!) * 100, 10);
    expect(m.relativeChange).toBeCloseTo(((m.currentRate! - m.baselineRate!) / m.baselineRate!) * 100, 10);
  });
});

describe("fixes timeline", () => {
  it("places completed tasks by completion date and not-completed tasks by due date", async () => {
    const { fixes } = (await getComparisonDetail(PK, "cmp-002"))!;
    expect(fixes.length).toBeGreaterThan(0);
    for (const fix of fixes) {
      if (fix.placedBy === "completed") {
        expect(fix.completedAt).not.toBeNull();
        expect(fix.placedAt).toBe(fix.completedAt);
      } else {
        expect(fix.placedAt).toBe(fix.dueAt);
        expect(fix.completedAt).toBeNull();
      }
      expect(fix.findingId).toMatch(/^fnd-/);
    }
    const dates = fixes.map((f) => f.placedAt);
    expect([...dates].sort()).toEqual(dates);
  });
});

describe("nutrition comparison scope", () => {
  it("resolves every wizard preset and window to real sources", async () => {
    const { wizardCatalog, getWizardData } = await import("@/services/comparison");
    const catalog = wizardCatalog(NU);
    const wizard = (await getWizardData(NU))!;
    expect(wizard.brand).toBe("Nutrition");
    for (const [type, preset] of Object.entries(catalog.presets)) {
      if (type === "period_vs_period") continue;
      expect(findSnapshot(wizard.snapshots, preset.baseline), `${type} baseline`).toBeDefined();
      expect(findSnapshot(wizard.snapshots, preset.current), `${type} current`).toBeDefined();
    }
    expect(catalog.windows.map((w) => w.id)).toEqual(["oct", "nov", "mid-oct"]);
    expect(wizard.markets).toEqual(["SG"]);
  });

  it("states a small sample instead of a trend for the 6-slot verification comparison", async () => {
    const small = buildInsights((await getComparisonDetail(NU, "cmp-nu-003"))!.result);
    expect(small[0].id).toBe("sample");
  });

  it("scopes a wizard comparison across the prompt rewording without merging it", async () => {
    const id = encodeDefinition({ type: "period_vs_period", baseline: "2026-10-12 – 2026-10-26", current: "2026-11-02 – 2026-11-16", filters: { promptId: "p-nu-003" }, aggregation: "matched_slot_macro" });
    const { result, record } = (await getComparisonDetail(NU, id))!;
    expect(result.matchedPairs).toBe(0);
    expect(result.unmatched.every((u) => u.reason === "version_changed")).toBe(true);
    expect(record.comparability).toBe("insufficient_data");
  });
});

describe("prompt grouping and insights", () => {
  it("sums whole-number counts per prompt", async () => {
    const { result } = (await getComparisonDetail(PK, "cmp-001"))!;
    const groups = groupByPrompt(result.matchedRows);
    expect(groups.reduce((n, g) => n + g.slots.length, 0)).toBe(result.matchedRows.length);
    for (const g of groups) {
      expect(g.baseline.n).toBe(g.slots.reduce((n, r) => n + r.baseline.n, 0));
      expect(Number.isInteger(g.current.d)).toBe(true);
    }
  });

  it("writes at most three statements and flags a small sample instead of a trend", async () => {
    const big = buildInsights((await getComparisonDetail(PK, "cmp-001"))!.result);
    expect(big.length).toBeLessThanOrEqual(3);
    const small = buildInsights((await getComparisonDetail(PK, "cmp-003"))!.result);
    expect(small[0].id).toBe("sample");
    expect(buildInsights((await getComparisonDetail(PK, encodeDefinition({ type: "snapshot_vs_snapshot", baseline: "snap-aud-001", current: "snap-aud-001", filters: {}, aggregation: "matched_slot_macro" })))!.result)).toEqual([]);
  });
});

describe("exports", () => {
  it("neutralises formula injection and quotes cells", () => {
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-2")).toBe("'-2");
    expect(csvCell("@cmd")).toBe("'@cmd");
    expect(csvCell(-2)).toBe("-2");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(toCsv(["x"], [["=1"], [null]])).toBe("x\r\n'=1\r\n");
  });

  it("builds a standalone HTML report that escapes content and states its basis", async () => {
    const detail = (await getComparisonDetail(PK, "cmp-002"))!;
    const html = reportHtml({ ...detail, record: { ...detail.record, title: "<script>alert(1)</script>" } }, { website: "RunPro", createdBy: "A", createdAt: "1 Nov 2026", rules: ["r"], details: ["d"], limitations: ["l"], verdictLabel: "Comparable" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("average of");
    expect(html).toContain("@media print");
  });
});

describe("archive and create in the local demo state", () => {
  const memory = (): StorageLike => {
    const data = new Map<string, string>();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  };

  it("adds a created comparison to the list and archives and restores it with events", async () => {
    const store = createDemoStore({ storage: memory(), debounceMs: 0 });
    const base = await listComparisons(PK);
    const def: ComparisonDefinition = { type: "snapshot_vs_snapshot", baseline: "snap-aud-001", current: "snap-aud-002", filters: {}, aggregation: "matched_slot_macro" };
    const id = encodeDefinition(def);
    const record: ComparisonRecord = { ...base[0], id, storeId: PK, title: "Created here", simulated: true, archived: false };
    store.create("comparisons", record as unknown as Record<string, unknown>, { kind: "comparison.created", label: "Created", refs: { comparisonId: id, websiteId: PK } });
    const rows = () => applyOverlay(base, store.getSnapshot().comparisons as never, (r: ComparisonRecord) => r.id);
    expect(rows().map((r) => r.id)).toContain(id);

    store.update("comparisons", "cmp-001", { archived: true }, { kind: "comparison.archived", label: "Archived", refs: { comparisonId: "cmp-001", websiteId: PK } });
    expect(rows().find((r) => r.id === "cmp-001")?.archived).toBe(true);
    store.update("comparisons", "cmp-001", { archived: false });
    expect(rows().find((r) => r.id === "cmp-001")?.archived).toBe(false);
    expect(store.getSnapshot().events.map((e) => e.kind)).toEqual(["comparison.created", "comparison.archived"]);
    expect(rows().find((r) => r.id === id)?.storeId).toBe(PK);
  });
});
