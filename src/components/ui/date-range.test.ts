import { describe, expect, it } from "vitest";

import { addDays, daysInRange, formatRange, makeRange, parseIsoDate, resolvePreset, validateRange } from "./date-range";

describe("date helpers", () => {
  it("parses only real calendar days", () => {
    expect(parseIsoDate("2026-11-19")).not.toBeNull();
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("19/11/2026")).toBeNull();
  });
  it("adds days across month and year ends", () => {
    expect(addDays("2026-11-19", -29)).toBe("2026-10-21");
    expect(addDays("2026-01-02", -3)).toBe("2025-12-30");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("counts days inclusively", () => {
    expect(daysInRange("2026-11-13", "2026-11-19")).toBe(7);
    expect(daysInRange("2026-11-19", "2026-11-19")).toBe(1);
    expect(daysInRange("2026-11-20", "2026-11-19")).toBeNull();
  });
});

describe("presets", () => {
  const anchor = "2026-11-19";
  const span = (preset: "7d" | "30d" | "90d") => {
    const { from, to } = resolvePreset(preset, anchor);
    return daysInRange(from, to);
  };
  it("7d, 30d and 90d end on the anchor and are inclusive", () => {
    expect(resolvePreset("7d", anchor)).toEqual({ from: "2026-11-13", to: anchor });
    expect(span("30d")).toBe(30);
    expect(span("90d")).toBe(90);
  });
  it("this period uses the supplied period, or falls back to 30 days", () => {
    expect(resolvePreset("period", anchor, { from: "2026-11-01", to: "2026-11-30" })).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(makeRange("period", anchor)).toEqual({ preset: "30d", from: "2026-10-21", to: anchor });
  });
});

describe("validateRange and formatRange", () => {
  it("validates order, presence and bounds", () => {
    expect(validateRange("2026-11-01", "2026-11-19")).toBeNull();
    expect(validateRange("", "2026-11-19")).toMatch(/both/);
    expect(validateRange("2026-11-20", "2026-11-19")).toMatch(/on or before/);
    expect(validateRange("2026-01-01", "2026-11-19", { min: "2026-06-01" })).toMatch(/start/);
    expect(validateRange("2026-06-02", "2026-12-19", { max: "2026-11-19" })).toMatch(/end/);
  });
  it("formats deterministically", () => {
    expect(formatRange("2026-10-21", "2026-11-19")).toBe("21 Oct – 19 Nov 2026");
    expect(formatRange("2025-12-30", "2026-01-02")).toBe("30 Dec 2025 – 2 Jan 2026");
  });
});
