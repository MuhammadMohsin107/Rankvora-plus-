import { describe, expect, it } from "vitest";

import { hashString, initialsOf, seriesIndex } from "./avatar";
import { trustText } from "./demo";
import { hasActiveFilters } from "./filter-bar";
import { computeFloatingPosition } from "./menu";
import { toastDuration } from "./toast";

describe("avatar", () => {
  it("derives stable initials", () => {
    expect(initialsOf("RunPro Pakistan")).toBe("RP");
    expect(initialsOf("HomeFit")).toBe("HO");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf("acme-labs.io")).toBe("AL");
  });
  it("hashes the same name to the same series, in range", () => {
    expect(hashString("RunPro UAE")).toBe(hashString("RunPro UAE"));
    for (const name of ["a", "RunPro UAE", "HomeFit UK", "Zoe"]) {
      const index = seriesIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
    }
    expect(seriesIndex("RunPro UAE")).toBe(seriesIndex("  runpro uae "));
  });
});

describe("trustText", () => {
  it("builds the coverage line", () => {
    expect(trustText({ samples: 36, promptsIncluded: 12, promptsTotal: 15 })).toBe("Based on 36 samples · 12 of 15 prompts");
    expect(trustText({ samples: 1 })).toBe("Based on 1 sample");
    expect(trustText({})).toBe("");
  });
});

describe("hasActiveFilters", () => {
  it("is true for a search term or any selected filter", () => {
    expect(hasActiveFilters("", [{ value: "" }])).toBe(false);
    expect(hasActiveFilters("  ", undefined)).toBe(false);
    expect(hasActiveFilters("seo", [])).toBe(true);
    expect(hasActiveFilters("", [{ value: "" }, { value: "open" }])).toBe(true);
  });
});

describe("computeFloatingPosition", () => {
  const viewport = { width: 1000, height: 800 };
  it("opens downward and aligns to the end edge", () => {
    const pos = computeFloatingPosition({ top: 100, bottom: 132, left: 700, right: 740 }, viewport, { width: 224, align: "end" });
    expect(pos.placement).toBe("down");
    expect(pos.top).toBe(138);
    expect(pos.left).toBe(516);
  });
  it("clamps inside the viewport gutter and never exceeds the viewport width", () => {
    const pos = computeFloatingPosition({ top: 100, bottom: 132, left: 980, right: 1000 }, viewport, { width: 224, align: "start" });
    expect(pos.left + pos.width).toBeLessThanOrEqual(992);
    const narrow = computeFloatingPosition({ top: 100, bottom: 132, left: 0, right: 20 }, { width: 300, height: 800 }, { width: 500 });
    expect(narrow.width).toBe(284);
    expect(narrow.left).toBe(8);
  });
  it("flips up, anchored to the trigger, when there is no room below", () => {
    const pos = computeFloatingPosition({ top: 700, bottom: 732, left: 100, right: 140 }, viewport, { width: 224 });
    expect(pos.placement).toBe("up");
    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(106);
    expect(pos.maxHeight).toBe(360);
  });
});

describe("toastDuration", () => {
  it("stays within 4 to 5 seconds by default and honours overrides", () => {
    expect(toastDuration({})).toBe(4500);
    expect(toastDuration({ tone: "danger" })).toBe(5000);
    expect(toastDuration({ undo: () => {} })).toBe(5000);
    expect(toastDuration({ duration: 8000 })).toBe(8000);
  });
});
