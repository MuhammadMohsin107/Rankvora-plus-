import { describe, expect, it } from "vitest";

import { isTenancyError } from "./errors";
import {
  brandProfileInput,
  createCompetitorInput,
  createOrganizationInput,
  createStoreInput,
  parseInput,
  updateStoreInput,
} from "./validation";

const ORG_ID = "5b3e1c2a-1d2e-4f3a-8b9c-0d1e2f3a4b5c";

const validStore = {
  organizationId: ORG_ID,
  name: "Main store",
  platformType: "manual",
  canonicalDomain: "https://Shop.Example.com/",
  market: "pk",
  language: "en",
  brandName: "  Example  ",
  brandAliases: ["Example", "example", " Ex "],
};

describe("createStoreInput", () => {
  it("normalizes domain, market, brand name and aliases", () => {
    const parsed = parseInput(createStoreInput, validStore);
    expect(parsed.canonicalDomain).toBe("shop.example.com");
    expect(parsed.market).toBe("PK");
    expect(parsed.brandName).toBe("Example");
    expect(parsed.brandAliases).toEqual(["Example", "Ex"]);
  });

  it.each([
    ["an IP domain", { canonicalDomain: "10.0.0.1" }],
    ["a one-letter market", { market: "P" }],
    ["an unknown platform", { platformType: "magento-9000" }],
    ["a bad language", { language: "english please" }],
    ["a bad time zone", { timezone: "Mars/Olympus" }],
    ["a blank name", { name: "   " }],
    ["a non-uuid organization", { organizationId: "nope" }],
  ])("rejects %s", (_label, override) => {
    expect(() =>
      parseInput(createStoreInput, { ...validStore, ...override }),
    ).toThrow();
  });

  it("reports failures as validation errors", () => {
    try {
      parseInput(createStoreInput, { ...validStore, name: "" });
      expect.unreachable();
    } catch (error) {
      expect(isTenancyError(error)).toBe(true);
      expect(error).toMatchObject({ code: "validation", status: 422 });
    }
  });

  it("turns an empty optional field into null", () => {
    const parsed = parseInput(createStoreInput, {
      ...validStore,
      industry: "",
    });
    expect(parsed.industry).toBeNull();
  });
});

describe("updateStoreInput", () => {
  it("accepts a partial patch and leaves unspecified fields undefined", () => {
    const parsed = parseInput(updateStoreInput, { name: "Renamed" });
    expect(parsed).toEqual({ name: "Renamed" });
  });

  it("normalizes a domain change", () => {
    const parsed = parseInput(updateStoreInput, {
      canonicalDomain: "HTTPS://New.Example.com/x",
      confirmDomainChange: true,
    });
    expect(parsed.canonicalDomain).toBe("new.example.com");
  });
});

describe("createOrganizationInput", () => {
  it("requires a name and validates the time zone", () => {
    expect(() => parseInput(createOrganizationInput, { name: "" })).toThrow();
    expect(() =>
      parseInput(createOrganizationInput, {
        name: "Acme",
        timezoneDefault: "Nope/Zone",
      }),
    ).toThrow();
    expect(
      parseInput(createOrganizationInput, {
        name: "Acme",
        timezoneDefault: "Asia/Karachi",
      }),
    ).toEqual({ name: "Acme", timezoneDefault: "Asia/Karachi" });
  });
});

describe("brandProfileInput", () => {
  it("defaults aliases to an empty list and cleans them", () => {
    expect(parseInput(brandProfileInput, { brandName: "X" }).aliases).toEqual(
      [],
    );
    expect(
      parseInput(brandProfileInput, {
        brandName: "X",
        aliases: ["a", "A", " b "],
      }).aliases,
    ).toEqual(["a", "b"]);
  });
});

describe("createCompetitorInput", () => {
  it("normalizes competitor domains and defaults the source to manual", () => {
    const parsed = parseInput(createCompetitorInput, {
      name: "Rival",
      domains: ["https://Rival.com/", "rival.com"],
    });
    expect(parsed.domains).toEqual(["rival.com"]);
    expect(parsed.source).toBe("manual");
  });

  it("rejects an invalid competitor domain", () => {
    expect(() =>
      parseInput(createCompetitorInput, {
        name: "Rival",
        domains: ["localhost"],
      }),
    ).toThrow();
  });
});
