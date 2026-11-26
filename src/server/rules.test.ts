/** The pure rules of the backend. Database behaviour is covered by the live test against D1. */
import { describe, expect, it } from "vitest";

import { mentionsAnyName, normalisePrompt, similarity } from "@/lib/prompt-text";

import { bare, nextCompetitorStatus } from "./modules/competitors/service";
import { runState, scopeAllows } from "./modules/prompts/assignments";
import { skipReason } from "./modules/prompts/bulk";
import { readImportRow } from "./modules/prompts/import";
import { nextPromptStatus } from "./modules/prompts/service";
import { isPublicAddress } from "./modules/websites/inspect";
import { nextStatus } from "./modules/websites/service";
import { can, PERMISSIONS } from "./tenancy/permissions";
import { publicPageUrl } from "./validation";

describe("domain check address safety", () => {
  it("refuses private, loopback, link-local, metadata and reserved addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "198.18.0.1"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    for (const address of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1", "2001:db8::1", "not-an-address", "1.2.3", "1:2:3"]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it("accepts public addresses", () => {
    for (const address of ["1.1.1.1", "8.8.8.8", "172.15.0.1", "172.32.0.1", "104.16.132.229", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPublicAddress(address), address).toBe(true);
    }
  });

  it("counts www and the bare domain of a competitor as one site", () => {
    expect(bare("www.hazelsoft.net")).toBe("hazelsoft.net");
    expect(bare("blog.hazelsoft.net")).toBe("blog.hazelsoft.net");
    expect(bare("www.pk")).toBe("www.pk");
  });

  it("accepts only public http pages without credentials or ports", () => {
    expect(publicPageUrl("https://Tetralogicx.com/about#team")).toEqual({ url: "https://tetralogicx.com/about", host: "tetralogicx.com" });
    for (const bad of ["ftp://tetralogicx.com/", "https://user:pw@tetralogicx.com/", "https://tetralogicx.com:8443/", "http://127.0.0.1/", "http://localhost/", "http://intranet.local/", "tetralogicx.com"]) {
      expect("error" in publicPageUrl(bad), bad).toBe(true);
    }
  });
});

describe("status rules", () => {
  it("restores a website and a prompt without starting them again", () => {
    expect(nextStatus("archived", "restore", "active")).toBe("paused");
    expect(nextPromptStatus("archived", "restore")).toBe("draft");
    expect(nextPromptStatus("archived", "activate")).toBeNull();
    expect(nextPromptStatus("draft", "resume")).toBeNull();
    expect(nextPromptStatus("paused", "resume")).toBe("active");
  });

  it("keeps a suggestion a suggestion until a person confirms it", () => {
    expect(nextCompetitorStatus("suggested", "confirm", false)).toBe("confirmed");
    expect(nextCompetitorStatus("archived", "restore", false)).toBe("suggested");
    expect(nextCompetitorStatus("archived", "restore", true)).toBe("confirmed");
    expect(nextCompetitorStatus("confirmed", "confirm", true)).toBeNull();
  });

  it("runs an assignment only for an active prompt with approved wording", () => {
    expect(runState("active", "pmv_1")).toBe("ready");
    expect(runState("active", null)).toBe("no_approved_version");
    expect(runState("paused", "pmv_1")).toBe("prompt_not_active");
    expect(scopeAllows("audit", "monitoring")).toBe(false);
    expect(scopeAllows("both", "monitoring")).toBe(true);
  });

  it("lets members write prompts but not approve or delete them", () => {
    expect(can("member", "prompt.write")).toBe(true);
    expect(can("member", "prompt.approve")).toBe(false);
    expect(can("member", "prompt.delete")).toBe(false);
    expect(can("manager", "prompt.approve")).toBe(true);
    expect(can("manager", "brand.confirm")).toBe(false);
    expect(can("viewer", "prompt.write")).toBe(false);
    for (const roles of Object.values(PERMISSIONS)) expect(roles).toContain("owner");
  });

  it("explains every skipped prompt in a bulk action", () => {
    const row = { status: "draft" as const, groupId: null, approvedAt: null, tagText: "a\nb" };
    expect(skipReason(row, { action: "activate" }, false)).toBe("approval_required");
    expect(skipReason(row, { action: "activate" }, true)).toBeNull();
    expect(skipReason(row, { action: "pause" }, true)).toBe("wrong_status");
    expect(skipReason(row, { action: "move_to_group", groupId: null }, true)).toBe("no_change");
    expect(skipReason(row, { action: "add_tags", tags: ["a"] }, true)).toBe("no_change");
    expect(skipReason(row, { action: "add_tags", tags: Array.from({ length: 9 }, (_, i) => `t${i}`) }, true)).toBe("too_many_tags");
    expect(skipReason(row, { action: "remove_tags", tags: ["z"] }, true)).toBe("no_change");
    expect(skipReason({ ...row, status: "archived" }, { action: "add_tags", tags: ["c"] }, true)).toBe("wrong_status");
  });
});

describe("prompt wording", () => {
  it("treats only punctuation and case differences as the same prompt", () => {
    expect(normalisePrompt("What is the BEST agency?")).toBe(normalisePrompt("what is the best agency"));
    expect(similarity("best web design agency in Lahore", "best web design agencies in Karachi")).toBeLessThan(0.8);
  });

  it("keeps vowel marks, so different words in scripts that use them stay different", () => {
    // Hindi "kam" (work) and "kum" (less) differ only by a vowel sign.
    expect(normalisePrompt("काम")).not.toBe(normalisePrompt("कम"));
  });

  it("matches brand names as whole words only", () => {
    expect(mentionsAnyName("Is Tetralogicx a good agency?", ["Tetralogicx"])).toBe(true);
    expect(mentionsAnyName("Who teaches tetralogy courses?", ["Tetra"])).toBe(false);
  });
});

describe("CSV import rows", () => {
  const defaults = { market: "PK", language: "en", searchMode: "web_grounded_auto" as const, mayApprove: false };

  it("fills the defaults and reports every problem in a bad row", () => {
    const good = readImportRow({ prompt_text: "Which agencies build Shopify stores?" }, 2, defaults);
    expect(good).toMatchObject({ result: "create", intent: "discovery", status: "draft", scope: "both", market: "PK", language: "en" });
    const bad = readImportRow({ prompt_text: "short", status: "active", country: "ZZ", is_core: "maybe" }, 3, defaults);
    expect(bad.result).toBe("invalid");
    expect(bad.notes).toHaveLength(4);
  });
});
