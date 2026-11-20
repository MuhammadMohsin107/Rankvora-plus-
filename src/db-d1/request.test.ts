import { describe, expect, it } from "vitest";

import { isJsonContentType, isSameOrigin, parseWorkspaceCookie } from "./request";

describe("parseWorkspaceCookie", () => {
  it("accepts a UUID and normalises case", () => {
    expect(parseWorkspaceCookie("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });
  it("rejects anything else", () => {
    for (const v of [undefined, null, "", "abc", "../../etc", "3f2504e0-4f89-41d3-9a0c-0305e82c3301x", "'; drop table workspaces;--"]) {
      expect(parseWorkspaceCookie(v)).toBeNull();
    }
  });
});

describe("isSameOrigin", () => {
  it("matches the Origin host to the Host header", () => {
    expect(isSameOrigin("https://app.example.com", "app.example.com")).toBe(true);
    expect(isSameOrigin("http://localhost:3200", "localhost:3200")).toBe(true);
    expect(isSameOrigin("https://APP.example.com", "app.example.com")).toBe(true);
  });
  it("rejects missing, foreign, malformed and port-mismatched origins", () => {
    expect(isSameOrigin(null, "app.example.com")).toBe(false);
    expect(isSameOrigin("https://evil.example", "app.example.com")).toBe(false);
    expect(isSameOrigin("http://localhost:3000", "localhost:3200")).toBe(false);
    expect(isSameOrigin("null", "app.example.com")).toBe(false);
    expect(isSameOrigin("https://app.example.com", null)).toBe(false);
  });
});

describe("isJsonContentType", () => {
  it("requires application/json", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("text/plain")).toBe(false);
    expect(isJsonContentType("application/jsonx")).toBe(false);
    expect(isJsonContentType(null)).toBe(false);
  });
});
