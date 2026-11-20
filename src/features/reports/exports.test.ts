import { describe, expect, it } from "vitest";

import type { ReportDocument } from "@/types/shared-records";

import { csvCell, escapeHtml, exportFileName, reportToCsv, reportToHtml, reportToJson } from "./exports";

const doc: ReportDocument = {
  type: "audit",
  title: 'Audit <script>alert("x")</script>',
  websiteName: "RunPro",
  period: "12 Nov 2026",
  generatedAt: "2026-11-12T07:30:00Z",
  version: "Criteria 2.1",
  source: { id: "aud-003", label: "Audit", href: "/stores/runpro-pk/audits/aud-003", snapshotIds: ["snap-aud-003"] },
  summary: ["Brand mentioned in 5 of 6 successful responses (83.3%)."],
  metrics: [
    { id: "mention-rate", label: "Brand mention rate", n: 5, d: 6, previous: { n: 3, d: 6 } },
    { id: "page-coverage", label: "Page coverage", n: null, d: null, naReason: "Website lane not run" },
    { id: "findings", label: "Findings created", n: 1, d: null },
  ],
  tables: [
    {
      id: "providers",
      title: "By provider",
      columns: [
        { id: "provider", label: "Provider", kind: "text" },
        { id: "mention", label: "Mention", kind: "rate" },
        { id: "citation", label: "Owned citation", kind: "rate" },
        { id: "failed", label: "Failed", kind: "number" },
      ],
      rows: [{ provider: "OpenAI", mention: { n: 2, d: 3 }, citation: null, failed: 0 }],
    },
  ],
  coverage: [{ label: "Requests succeeded", n: 6, d: 6 }],
  scope: [{ label: "Created by", value: "Bilal & Co" }],
  evidence: [{ id: "resp-aud-003-1", title: "=Best shoes?", ids: { storeId: "runpro-pk", responseId: "resp-aud-003-1" } }],
  limitations: ["API answer samples differ from consumer apps."],
  methodology: ["Criteria 2.1"],
};

describe("csv", () => {
  it("quotes cells and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell(null)).toBe("");
  });

  it("writes numerator and denominator, and N/A instead of zero", () => {
    const lines = reportToCsv(doc).split("\r\n");
    expect(lines[0]).toBe("section,item,metric,numerator,denominator,rate,previous_numerator,previous_denominator,text");
    expect(lines).toContain("headline,,Brand mention rate,5,6,83.3%,3,6,");
    expect(lines).toContain("headline,,Page coverage,N/A,N/A,N/A,,,");
    expect(lines).toContain("headline,,Findings created,1,,,,,");
    expect(lines).toContain("By provider,OpenAI,Mention,2,3,66.7%,,,");
    expect(lines).toContain("By provider,OpenAI,Owned citation,N/A,N/A,N/A,,,");
    expect(lines).toContain("evidence,resp-aud-003-1,'=Best shoes?,,,,,,");
  });
});

describe("html", () => {
  it("is standalone, escapes content and has a print stylesheet", () => {
    const html = reportToHtml(doc, "2026-11-19T09:00:00Z");
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("@media print");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Bilal &amp; Co");
    expect(html).toContain("5 / 6 (83.3%)");
    expect(html).toContain("N/A (Website lane not run)");
    expect(html).toContain("not consumer-app results");
  });

  it("escapes the five special characters", () => {
    expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
  });
});

describe("json and file names", () => {
  it("keeps ids and drops answer text", () => {
    const withResponse = { ...doc, evidence: [{ ...doc.evidence[0], response: { answerText: "secret answer" } as never }] };
    const json = JSON.parse(reportToJson(withResponse, "2026-11-19T09:00:00Z"));
    expect(json.evidence[0].ids.responseId).toBe("resp-aud-003-1");
    expect(JSON.stringify(json)).not.toContain("secret answer");
    expect(json.demonstrationData).toBe(true);
    expect(json.metrics[0]).toMatchObject({ n: 5, d: 6 });
  });

  it("makes safe file names", () => {
    expect(exportFileName("rep-aud-002", "csv")).toBe("rep-aud-002.csv");
    expect(exportFileName("../a b", "html")).toBe("a-b.html");
  });
});
