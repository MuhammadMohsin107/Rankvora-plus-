import { describe, expect, it } from "vitest";

import { registry } from "@/services/records";

import { getAudit, getAuditFindings, getLaneSummary, getWebsiteLane, listAuditRows } from "./audit";

const NU = "nutrition";

describe("nutrition audits", () => {
  it("lists the five registry audits and nothing else", async () => {
    const rows = await listAuditRows(NU);
    expect(rows.map((r) => r.id).sort()).toEqual(["aud-nu-001", "aud-nu-002", "aud-nu-003", "aud-nu-004", "aud-nu-005"]);
  });

  it("assesses exactly the pages the registry records", async () => {
    for (const audit of registry.audits(NU)) {
      const lane = await getWebsiteLane(NU, audit.id);
      if (!audit.pages) {
        expect(lane, audit.id).toBeNull();
        continue;
      }
      expect(lane, audit.id).not.toBeNull();
      expect(lane!.coverage.pages, audit.id).toEqual(audit.pages);
      expect(lane!.pages.length, audit.id).toBe(audit.pages.n);
      const { blocked, unvisited } = lane!.coverage.pagesDetail;
      expect(blocked + unvisited + lane!.coverage.pages.n, audit.id).toBe(lane!.coverage.pages.d);
    }
  });

  it("keeps technical and content pass rates separate with a denominator", async () => {
    const lane = (await getWebsiteLane(NU, "aud-nu-003"))!;
    expect(lane.technical.d).toBeGreaterThan(0);
    expect(lane.content.d).toBeGreaterThan(0);
    expect(lane.content.d).toBeLessThan(lane.technical.d);
  });

  it("shows the noindex finding until the verification audit removes it", async () => {
    for (const id of ["aud-nu-001", "aud-nu-002", "aud-nu-003"]) {
      const lane = (await getWebsiteLane(NU, id))!;
      const check = lane.checks.find((c) => c.findingId === "fnd-nu-003" && c.status === "fail");
      expect(check, id).toBeDefined();
      const course = lane.pages.find((p) => p.path === "/courses/nutrition-basics")!;
      expect(course.indexable, id).toBe(false);
    }
    const lane = (await getWebsiteLane(NU, "aud-nu-004"))!;
    expect(lane.checks.some((c) => c.findingId === "fnd-nu-003")).toBe(false);
    expect(lane.pages.find((p) => p.path === "/courses/nutrition-basics")!.indexable).toBe(true);
    expect(lane.pages.length).toBe(5);
  });

  it("links the website findings to checks where the contract puts them", async () => {
    const linked = async (id: string) => new Set((await getWebsiteLane(NU, id))!.checks.map((c) => c.findingId).filter(Boolean));
    const a1 = await linked("aud-nu-001");
    expect(["fnd-nu-001", "fnd-nu-002", "fnd-nu-003", "fnd-nu-004"].every((f) => a1.has(f))).toBe(true);
    expect(a1.has("fnd-nu-005")).toBe(false);
    expect(a1.has("fnd-nu-007")).toBe(false);
    const a2 = await linked("aud-nu-002");
    expect(a2.has("fnd-nu-005")).toBe(true);
    expect(a2.has("fnd-nu-007")).toBe(false);
    const a3 = await linked("aud-nu-003");
    expect(["fnd-nu-001", "fnd-nu-002", "fnd-nu-003", "fnd-nu-004", "fnd-nu-005", "fnd-nu-007"].every((f) => a3.has(f))).toBe(true);
    const lane3 = (await getWebsiteLane(NU, "aud-nu-003"))!;
    expect(lane3.pages.find((p) => p.path === "/tools/calorie-calculator")!.lab?.lcpMs).toBe(3400);
  });

  it("has an AI-only triggered audit and a scheduled audit with trigger metadata", async () => {
    const triggered = (await getAudit(NU, "aud-nu-005"))!;
    expect(triggered.lanes).toEqual(["ai_visibility"]);
    expect(triggered.config.trigger?.source).toBe("competitor_suggested");
    expect(triggered.config.trigger?.reason).toContain("GreenFork Guide");
    expect(triggered.config.promptIds).toEqual(["p-nu-001", "p-nu-007"]);
    expect(triggered.config.samples).toBe(2);
    expect(triggered.coverage.pages).toEqual({ n: 0, d: 0 });
    expect(await getWebsiteLane(NU, "aud-nu-005")).toBeNull();
    expect((await getLaneSummary(NU, "aud-nu-005"))!.website).toBeNull();

    const scheduled = (await getAudit(NU, "aud-nu-002"))!;
    expect(scheduled.config.trigger?.source).toBe("schedule");
    expect(scheduled.config.trigger?.cadence).toBe("monthly");
    expect(Date.parse(scheduled.config.trigger!.nextRunAt!)).toBeGreaterThan(Date.parse("2026-11-19T09:00:00Z"));
  });

  it("configures the verification audit with 6 requests and the verified finding", async () => {
    const audit = (await getAudit(NU, "aud-nu-004"))!;
    expect(audit.config.promptIds).toEqual(["p-nu-002", "p-nu-006"]);
    expect(audit.config.channelIds).toHaveLength(3);
    expect(audit.config.samples).toBe(1);
    expect(audit.config.promptIds.length * audit.config.channelIds.length * audit.config.samples).toBe(audit.plannedJobs);
    expect(audit.config.verifies?.findingId).toBe("fnd-nu-003");
  });

  it("creates findings only after the audit that detected them", async () => {
    const counts = await Promise.all(registry.audits(NU).map(async (a) => [a.id, (await getAuditFindings(NU, a.id)).length] as const));
    const byId = Object.fromEntries(counts);
    expect(byId["aud-nu-001"]).toBe(4);
    expect(byId["aud-nu-002"]).toBe(5);
    expect(byId["aud-nu-003"]).toBe(7);
    expect(byId["aud-nu-005"]).toBe(8);
  });

  it("matches the registry for jobs on every audit", async () => {
    for (const audit of registry.audits(NU)) {
      const detail = (await getAudit(NU, audit.id))!;
      expect(detail.plannedJobs, audit.id).toBe(audit.plannedJobs);
      expect(detail.coverage.responses, audit.id).toEqual({ n: audit.succeededJobs, d: audit.plannedJobs });
    }
  });
});
