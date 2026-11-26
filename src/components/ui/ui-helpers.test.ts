import { describe, expect, it } from "vitest";

import { hashString, initialsOf, seriesIndex } from "./avatar";
import { hasActiveFilters } from "./filter-bar";
import { computeFloatingPosition } from "./menu";
import { toastDuration } from "./toast";

describe("avatar", () => {
  it("derives stable initials", () => {
    expect(initialsOf("Brown Tech")).toBe("BT");
    expect(initialsOf("Tetralogicx")).toBe("TE");
    expect(initialsOf("  ")).toBe("?");
    expect(initialsOf("acme-labs.io")).toBe("AL");
  });
  it("hashes the same name to the same series, in range", () => {
    expect(hashString("Tetralogicx")).toBe(hashString("Tetralogicx"));
    for (const name of ["a", "Tetralogicx", "Brown Tech", "Hazelsoft"]) {
      const index = seriesIndex(name);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(5);
    }
    expect(seriesIndex("Brown Tech")).toBe(seriesIndex("  brown tech "));
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
