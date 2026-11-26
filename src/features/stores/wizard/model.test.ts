import { describe, expect, it } from "vitest";

import { allErrors, buildSettingsDocs, formToWebsite, initialForm, requiredComplete, startingStatus, stepErrors, type WizardForm } from "./model";

const NOW = "2026-11-19T09:00:00Z";

function filled(over: Partial<WizardForm> = {}): WizardForm {
  return {
    ...initialForm(),
    name: "Northwind Studio",
    website: "https://Northwind.example/about",
    brandName: "Northwind",
    country: "GB",
    language: "en",
    siteType: "wordpress",
    category: "Professional services",
    ...over,
  };
}

describe("add website wizard model", () => {
  it("refuses a domain that another website already uses (www and case ignored)", () => {
    const existing = [{ name: "Nutrition", domain: "nutrition.example" }];
    const errors = stepErrors(0, filled({ website: "https://WWW.Nutrition.example/blog" }), existing);
    expect(errors.website).toBe("Nutrition already uses nutrition.example. Use a different domain.");
    expect(stepErrors(0, filled({ website: "wellness-demo.example" }), existing)).toEqual({});
    expect(allErrors(filled({ website: "nutrition.example" }), existing).map((e) => e.step)).toEqual([0]);
    // only a leading "www." is ignored: "wwwshop.com" and "shop.com" are different domains
    expect(stepErrors(0, filled({ website: "wwwshop.com" }), [{ name: "Shop", domain: "shop.com" }])).toEqual({});
  });

  it("needs a name, domain, brand, market, language and site type before step 2", () => {
    expect(Object.keys(stepErrors(0, initialForm())).sort()).toEqual(["brandName", "country", "language", "name", "website"]);
    expect(stepErrors(0, filled())).toEqual({});
  });

  it("treats connections, competitors and extras as optional", () => {
    expect(requiredComplete(filled())).toBe(true);
    expect(allErrors(initialForm()).map((e) => e.step)).toEqual([0, 1]);
  });

  it("builds a platform-neutral website row with no tracking data", () => {
    const row = formToWebsite(filled(), startingStatus({ channelIds: [] }, false), NOW);
    expect(row.domain).toBe("northwind.example");
    expect(row.platform).toBe("wordpress");
    expect(row.marketName).toBe("United Kingdom");
    expect(row.timezone).toBe("Europe/London");
    expect(row.status).toBe("needs_review");
    expect(row.summary).toBeNull();
    expect(row.integrations).toEqual({ commerce: "manual", searchConsole: "not_connected" });
  });

  it("starts ready with an AI channel and draft when saved early", () => {
    expect(startingStatus({ channelIds: ["ch-openai"] }, false)).toBe("ready");
    expect(startingStatus({ channelIds: ["ch-openai"] }, true)).toBe("draft");
  });

  it("maps connector choice, competitors and brand facts into the settings documents", () => {
    const form = filled({
      aliases: ["North Wind"],
      connector: "webflow",
      searchConsole: true,
      competitors: [
        { id: "a", name: "Acme", domain: "acme.example", reason: "Added by you", state: "confirmed" },
        { id: "b", name: "Beta", domain: "beta.example", reason: "Demo", state: "dismissed" },
      ],
      facts: [{ id: "f1", label: "Founded", value: "2019", sourceUrl: "" }],
    });
    const docs = buildSettingsDocs("demo-websites-3", form, NOW);
    expect(docs.brand.versions[0]).toMatchObject({ version: 1, aliases: ["North Wind"], category: "Professional services" });
    expect(docs.integrations.commerce).toMatchObject({ platform: "webflow", state: "connected", account: "northwind.example" });
    expect(docs.integrations.searchConsole.property).toBe("sc-domain:northwind.example");
    expect(docs.competitors.list.map((c) => [c.name, c.status])).toEqual([["Acme", "confirmed"], ["Beta", "archived"]]);
    expect(docs.knowledge.facts).toHaveLength(1);
    expect(docs.domains.canonical).toBe("northwind.example");
  });
});
