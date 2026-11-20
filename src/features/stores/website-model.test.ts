import { describe, expect, it } from "vitest";

import type { Store } from "@/types/core";

import { isLocalWebsiteId, nextWebsiteAction, resolveWebsite } from "./website-model";

const base = {
  brandName: "B",
  domain: "b.example",
  platform: "custom",
  market: "GB",
  marketName: "United Kingdom",
  language: "en",
  timezone: "UTC",
  industry: "Other",
  integrations: { commerce: "manual", searchConsole: "not_connected" },
  createdAt: "2026-11-19T09:00:00Z",
} as const;

const seeded: Store = { ...base, id: "runpro-pk", name: "RunPro", status: "active", channelIds: ["ch-openai"], summary: null };
const created: Store = { ...base, id: "demo-websites-7", name: "New site", status: "needs_review", channelIds: [], summary: null, simulated: true, origin: "local-demo" };

describe("created website routing", () => {
  it("recognises ids made by demo-state and leaves seeded ids to the server", () => {
    expect(isLocalWebsiteId("demo-websites-7")).toBe(true);
    expect(isLocalWebsiteId("runpro-pk")).toBe(false);
  });

  it("resolves a created website from demo-state rows and a seeded one from the static list", () => {
    expect(resolveWebsite("demo-websites-7", [seeded], [created])?.name).toBe("New site");
    expect(resolveWebsite("runpro-pk", [seeded], [created])?.name).toBe("RunPro");
    expect(resolveWebsite("demo-websites-9", [seeded], [created])).toBeNull();
  });

  it("gives a new website without channels one setup action", () => {
    expect(nextWebsiteAction(created)).toMatchObject({ label: "Finish setup", href: "/stores/demo-websites-7/settings" });
    expect(nextWebsiteAction({ ...created, channelIds: ["ch-openai"] }).label).toBe("Start audit");
  });
});
