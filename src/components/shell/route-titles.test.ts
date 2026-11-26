import { describe, expect, it } from "vitest";

import { NOT_FOUND_PATH, buildCrumbs, isAccountRoute, normalizeRoute } from "./route-titles";

describe("normalizeRoute", () => {
  it("keeps every real route", () => {
    const site = "/stores/web_396fb10e86754320b7edea7927e22e4e";
    const routes = [
      "/stores",
      "/stores/new",
      "/settings/billing",
      "/sign-in",
      "/sign-up",
      "/forgot-password",
      "/reset-password",
      "/confirm-email",
      "/welcome",
      "/invitations/accept",
      site,
      `${site}/prompts`,
      `${site}/prompts/new`,
      `${site}/audits`,
      `${site}/audits/new`,
      `${site}/fixes/history`,
      `${site}/fixes/tasks`,
      `${site}/monitoring/runs`,
      `${site}/monitoring/schedules/new`,
      `${site}/comparisons/new`,
      `${site}/reports`,
      `${site}/settings`,
    ];
    for (const route of routes) expect(normalizeRoute(route)).toBe(route);
  });

  it("draws account pages without the app frame", () => {
    expect(isAccountRoute("/sign-in")).toBe(true);
    expect(isAccountRoute("/invitations/accept/")).toBe(true);
    expect(isAccountRoute("/stores")).toBe(false);
  });

  it("maps unknown URLs to the not-found path so server and browser draw the same shell", () => {
    expect(normalizeRoute("/nowhere")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/web_1/does-not-exist")).toBe(NOT_FOUND_PATH);
    expect(normalizeRoute("/stores/web_1/prompts/p-1/extra")).toBe(NOT_FOUND_PATH);
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
    for (const path of ["/stores/web_1/comparisons/cmp-nu-001/breakdowns", "/stores/web_1/fixes/history"]) {
      const labels = buildCrumbs(path).map((c) => c.label);
      expect(labels.every((label) => label === label.charAt(0).toUpperCase() + label.slice(1))).toBe(true);
    }
  });
});
