import { describe, expect, it } from "vitest";

import { DEMO_BILLING_INVOICES } from "@/demo/settings";

import { csvCell, escapeHtml, invoiceHtml, invoicesCsv } from "./invoice-files";

describe("invoice files", () => {
  it("escapes HTML so a description cannot inject markup", () => {
    expect(escapeHtml(`<img src=x onerror="a()">&'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;");
    const html = invoiceHtml({ ...DEMO_BILLING_INVOICES[0], description: "<script>x</script>" }, { organization: "Org" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("Demo invoice. No real payment was taken");
  });

  it("builds one CSV row per invoice with the status label and a demo marker", () => {
    const lines = invoicesCsv(DEMO_BILLING_INVOICES).trim().split("\r\n");
    expect(lines).toHaveLength(DEMO_BILLING_INVOICES.length + 1);
    expect(lines[0]).toContain("Invoice,Date,Period");
    expect(lines.some((l) => l.includes("Open"))).toBe(true);
    expect(lines.some((l) => l.includes("Refunded"))).toBe(true);
    expect(lines.every((l, i) => i === 0 || l.includes("Demo invoice, no real payment") || l.includes('"Demo invoice, no real payment"'))).toBe(true);
  });

  it("quotes commas and neutralises formulas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=SUM(A1)")).toBe("'=SUM(A1)");
  });
});
