import { describe, expect, it } from "vitest";

import {
  DomainError,
  normalizeAliases,
  normalizeHost,
  normalizeHostList,
} from "./domain";

describe("normalizeHost", () => {
  it.each([
    ["example.com", "example.com"],
    ["Example.COM", "example.com"],
    ["https://Shop.Example.com/path?x=1#y", "shop.example.com"],
    ["http://example.com:8080/", "example.com"],
    ["example.com.", "example.com"],
    ["  https://example.pk  ", "example.pk"],
    ["www.example.com", "www.example.com"],
    ["example.co.uk/products", "example.co.uk"],
    ["münchen.de", "xn--mnchen-3ya.de"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHost(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "localhost",
    "intranet",
    "127.0.0.1",
    "http://10.0.0.5/admin",
    "192.168.1.1",
    "[::1]",
    "http://[::1]:3000",
    "shop.local",
    "app.internal",
    "ftp://example.com",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "exa mple.com",
    "-bad.example.com",
    "example.c",
    "example.123",
    `${"a".repeat(64)}.com`,
  ])("rejects %j", (input) => {
    expect(() => normalizeHost(input)).toThrow(DomainError);
  });

  it("treats www and the bare domain as different hosts", () => {
    expect(normalizeHost("www.example.com")).not.toBe(
      normalizeHost("example.com"),
    );
  });
});

describe("normalizeHostList", () => {
  it("normalizes and removes duplicates, keeping order", () => {
    expect(
      normalizeHostList(["B.com", "https://a.com/x", "b.com", "a.com"]),
    ).toEqual(["b.com", "a.com"]);
  });

  it("throws if any entry is invalid", () => {
    expect(() => normalizeHostList(["a.com", "localhost"])).toThrow(
      DomainError,
    );
  });
});

describe("normalizeAliases", () => {
  it("trims, collapses whitespace and removes case-insensitive duplicates", () => {
    expect(
      normalizeAliases([
        "  RunPro ",
        "runpro",
        "Run   Pro",
        "",
        "   ",
        "RUNPRO",
      ]),
    ).toEqual(["RunPro", "Run Pro"]);
  });

  it("keeps the first spelling", () => {
    expect(normalizeAliases(["HomeFit", "homefit"])).toEqual(["HomeFit"]);
  });
});
