import { describe, expect, it } from "vitest";

import { NOT_FOUND_PATH, buildCrumbs, normalizeRoute } from "./route-titles";

describe("normalizeRoute", () => {
  it("keeps every real route", () => {
    const routes = [
      "/stores",
      "/stores/new",
      "/settings/billing",
      "/stores/nutrition",
      "/stores/nutrition/prompts",
      "/stores/nutrition/prompts/p-nu-001",
      "/stores/nutrition/prompts/new",
      "/stores/nutrition/audits/aud-nu-003/ai-visibility",
      "/stores/nutrition/audits/demo-audits-3/report",
      "/stores/nutrition/fixes/findings/fnd-nu-001",
      "/stores/nutrition/fixes/tasks/task-nu-001",
      "/stores/nutrition/fixes/history",
      "/stores/nutrition/monitoring/schedules/sch-nu-001/edit",
      "/stores/nutrition/monitoring/runs/run-nu-006",
      "/stores/nutrition/comparisons/cmp-nu-001/breakdowns",
      "/stores/nutrition/comparisons/new",
      "/stores/nutrition/reports/rep-aud-nu-001",
      "/stores/demo-websites-1/settings",
    ];
    for (const route of routes) expect(normalizeRoute(route)).toBe(route);
  });

  it("maps unknown URLs to the not-found path so server and browser draw the same shell", () => {
    expect(normalizeRoute("/nowhere")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/nutrition/does-not-exist")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/nutrition/prompts/p-1/extra")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute(NOT_FOUND_PATH)).toBe(NOT_FOUND_PATH);
    // object-prototype names and ids in places where no page exists
    expect(normalizeRoute("/stores/s1/constructor")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/s1/toString")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/s1/audits/a1/findings/f1")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/s1/fixes/findings")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/s1/comparisons/c1/prompts/x")).toBe(NOT_FOUND_PATH);
  });
});

describe("buildCrumbs", () => {
  it("names the not-found page", () => {
    expect(buildCrumbs(NOT_FOUND_PATH)).toEqual([{ label: "Page not found" }]);
  });

  it("labels every route segment with a title, never the raw segment", () => {
    for (const path of ["/stores/nutrition/comparisons/cmp-nu-001/breakdowns", "/stores/nutrition/fixes/history"]) {
      const labels = buildCrumbs(path).map((c) => c.label);
      expect(labels.every((label) => label === label.charAt(0).toUpperCase() + label.slice(1))).toBe(true);
    }
  });
});
