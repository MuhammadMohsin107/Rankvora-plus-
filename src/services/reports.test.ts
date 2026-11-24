import { describe, expect, it } from "vitest";

import { reportToCsv, reportToHtml, reportToJson } from "@/features/reports/exports";

import { getEvidenceLinks } from "./records";
import { getReport, getReportDocument, getReportDocuments, listReportSources, listReports } from "./reports";

const STORES = ["runpro-pk", "runpro-ae", "nutrition", "threadly"] as const;

describe("report documents", () => {
  it("build for every report that is not still generating, and export without error", async () => {
    for (const storeId of STORES) {
      for (const report of await listReports(storeId)) {
        if (report.status === "generating") continue;
        const doc = await getReportDocument(storeId, report);
        expect(doc, report.id).not.toBeNull();
        expect(doc!.limitations.length, report.id).toBeGreaterThan(0);
        for (const m of doc!.metrics) {
          if (m.n !== null) expect(Number.isInteger(m.n), `${report.id} ${m.id}`).toBe(true);
          if (m.d !== null) expect(Number.isInteger(m.d), `${report.id} ${m.id}`).toBe(true);
        }
        expect(reportToCsv(doc!).split("\r\n").length).toBeGreaterThan(1);
        expect(reportToHtml(doc!, "2026-11-19T09:00:00Z")).toContain("<!doctype html>");
        expect(() => JSON.parse(reportToJson(doc!, "2026-11-19T09:00:00Z"))).not.toThrow();
      }
    }
  });

  it("keeps headline numbers equal to the registry", async () => {
    const audit = (await getReport("runpro-pk", "rep-aud-002"))!;
    const doc = (await getReportDocument("runpro-pk", audit))!;
    expect(doc.metrics.find((m) => m.id === "mention-rate")).toMatchObject({ n: 21, d: 48 });
    const run = (await getReport("runpro-pk", "rep-mon-008"))!;
    const runDoc = (await getReportDocument("runpro-pk", run))!;
    expect(runDoc.metrics.find((m) => m.id === "mention-rate")).toMatchObject({ n: 25, d: 48, previous: { n: 24, d: 48 } });
  });

  it("never prints a rate for a comparison that is not comparable", async () => {
    for (const storeId of STORES) {
      for (const report of (await listReports(storeId)).filter((r) => r.type === "comparison")) {
        const doc = (await getReportDocument(storeId, report))!;
        if (doc.verdict?.label === "Not comparable") expect(doc.metrics).toEqual([]);
      }
    }
  });

  it("has a document for every source a report can be generated from", async () => {
    const docs = await getReportDocuments("runpro-pk");
    const sources = await listReportSources("runpro-pk");
    expect(sources.length).toBeGreaterThan(8);
    for (const s of sources) expect(docs[`${s.type}:${s.id}`], s.id).toBeDefined();
    expect(await getReportDocuments("homefit-uk")).toEqual({});
  });
});

describe("evidence links", () => {
  it("gives a finding one chain of real ids", async () => {
    const links = (await getEvidenceLinks("runpro-pk", "fnd-004"))!;
    expect(links.ids.findingId).toBe("fnd-004");
    expect(links.ids.taskId).toBe("task-007");
    expect(links.ids.promptId).toBe("p-002");
    expect(links.chain.map((n) => n.kind)).toEqual(expect.arrayContaining(["metric", "prompt", "response", "finding", "fix"]));
    expect(links.chain.find((n) => n.kind === "finding")!.href).toBe("/stores/runpro-pk/fixes/findings/fnd-004");
  });

  it("returns null for an unknown finding and for another website's finding", async () => {
    expect(await getEvidenceLinks("runpro-pk", "nope")).toBeNull();
    expect(await getEvidenceLinks("runpro-ae", "fnd-004")).toBeNull();
  });

  it("adds verification and a comparison once the fix is in verification", async () => {
    const links = (await getEvidenceLinks("runpro-pk", "fnd-007"))!;
    expect(links.ids.verificationId).toBeDefined();
    expect(links.ids.comparisonId).toBe("cmp-003");
  });

  it("merges a task created locally and keeps the finding id", async () => {
    const links = (await getEvidenceLinks("runpro-pk", "fnd-005", [
      { id: "demo-evt-1", at: "2026-11-19T10:00:00Z", kind: "task.created", label: "Fix brand spelling", refs: { findingId: "fnd-005", taskId: "demo-tasks-2", websiteId: "runpro-pk" } },
    ]))!;
    expect(links.ids.findingId).toBe("fnd-005");
    expect(links.ids.taskId).toBe("demo-tasks-2");
    expect(links.tasks.some((t) => t.id === "demo-tasks-2" && t.local)).toBe(true);
  });
});
