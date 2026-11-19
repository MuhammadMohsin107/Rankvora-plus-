import { describe, expect, it } from "vitest";

import { membershipRole } from "@/db/schema";

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
} from "./permissions";
import { canTransition } from "./stores";

describe("role permissions", () => {
  it("defines a permission set for every role", () => {
    for (const role of membershipRole.enumValues) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("lets every role read stores", () => {
    for (const role of membershipRole.enumValues) {
      expect(roleHasPermission(role, "store:read")).toBe(true);
    }
  });

  it("keeps viewers read-only", () => {
    const writes = PERMISSIONS.filter((p) => p !== "store:read");
    for (const permission of writes) {
      expect(roleHasPermission("viewer", permission)).toBe(false);
    }
  });

  it("separates editing from approving", () => {
    expect(roleHasPermission("editor", "fix:edit")).toBe(true);
    expect(roleHasPermission("editor", "fix:approve")).toBe(false);
    expect(roleHasPermission("auditor", "fix:approve")).toBe(false);
    expect(roleHasPermission("admin", "fix:approve")).toBe(true);
    expect(roleHasPermission("owner", "fix:approve")).toBe(true);
  });

  it("lets auditors run audits and review findings but not edit stores", () => {
    expect(roleHasPermission("auditor", "audit:run")).toBe(true);
    expect(roleHasPermission("auditor", "finding:review")).toBe(true);
    expect(roleHasPermission("auditor", "store:edit")).toBe(false);
  });

  it("restricts store creation, archiving and members to admins and owners", () => {
    for (const permission of [
      "store:create",
      "store:archive",
      "org:members",
    ] as const) {
      expect(roleHasPermission("editor", permission)).toBe(false);
      expect(roleHasPermission("admin", permission)).toBe(true);
      expect(roleHasPermission("owner", permission)).toBe(true);
    }
  });

  it("reserves organization management for owners", () => {
    expect(roleHasPermission("admin", "org:manage")).toBe(false);
    expect(roleHasPermission("owner", "org:manage")).toBe(true);
  });
});

describe("store status transitions", () => {
  it("follows the setup path draft -> ready -> active", () => {
    expect(canTransition("draft", "ready")).toBe(true);
    expect(canTransition("ready", "active")).toBe(true);
  });

  it("does not let a draft store skip straight to active", () => {
    expect(canTransition("draft", "active")).toBe(false);
  });

  it("allows pausing and resuming", () => {
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("paused", "active")).toBe(true);
  });

  it("allows archiving from any non-archived state", () => {
    for (const from of [
      "draft",
      "needs_review",
      "ready",
      "active",
      "paused",
      "disconnected",
    ] as const) {
      expect(canTransition(from, "archived")).toBe(true);
    }
  });

  it("only restores archived stores to paused", () => {
    expect(canTransition("archived", "paused")).toBe(true);
    expect(canTransition("archived", "active")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(false);
  });
});
