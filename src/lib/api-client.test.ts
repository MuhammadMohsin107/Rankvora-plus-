import { describe, expect, it } from "vitest";

import { safeNextPath } from "./api-client";

describe("safeNextPath (where to go after signing in)", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/invitations/accept?token=abc")).toBe("/invitations/accept?token=abc");
    expect(safeNextPath("/stores")).toBe("/stores");
  });

  it("refuses other sites and odd forms", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad), String(bad)).toBe("/stores");
    }
  });
});
