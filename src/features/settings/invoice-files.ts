/**
 * Client-side files for the demonstration invoices. Built from the row that is shown on screen.
 * Every file says it is a demonstration document. Nothing is sent anywhere.
 */
import { formatCurrency, formatDate } from "@/lib/format";
import type { BillingInvoice } from "@/types/settings";

import { INVOICE_STATUS_LABEL } from "./billing-model";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Quotes a CSV cell and neutralises spreadsheet formulas. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function invoicesCsv(invoices: BillingInvoice[]): string {
  const header = ["Invoice", "Date", "Period", "Description", "Amount (USD)", "Status", "Note", "Demo"];
  const lines = invoices.map((inv) => [inv.id, inv.issuedOn, inv.period, inv.description, inv.amountUsd.toFixed(2), INVOICE_STATUS_LABEL[inv.status], inv.note ?? "", "Demo invoice, no real payment"].map(csvCell).join(","));
  return `${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}

export function invoiceHtml(invoice: BillingInvoice, context: { organization: string }): string {
  const { organization } = context;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(invoice.id)} (demo invoice)</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 system-ui, sans-serif; color: #171923; margin: 0; padding: 32px; max-width: 720px; }
  .demo { border: 1px solid #955a06; background: #fff6e8; color: #955a06; padding: 8px 12px; border-radius: 8px; font-weight: 600; margin-bottom: 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  .muted { color: #667085; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e6e8ef; }
  td.num, th.num { text-align: right; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .status { display: inline-block; border: 1px solid #667085; border-radius: 999px; padding: 0 10px; font-size: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<p class="demo">Demo invoice. No real payment was taken and this is not a tax document.</p>
<h1>Invoice ${escapeHtml(invoice.id)}</h1>
<p class="muted">Issued ${escapeHtml(formatDate(invoice.issuedOn))} &middot; Period ${escapeHtml(invoice.period)}</p>
<div class="meta">
  <div><strong>Billed to</strong><br>${escapeHtml(organization)}</div>
  <div><strong>From</strong><br>Rankvora AI (demo)<br>Status: <span class="status">${escapeHtml(INVOICE_STATUS_LABEL[invoice.status])}</span></div>
</div>
<table>
  <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
  <tbody><tr><td>${escapeHtml(invoice.description)}</td><td class="num">${escapeHtml(formatCurrency(invoice.amountUsd))}</td></tr></tbody>
  <tfoot><tr><th>Total (USD)</th><th class="num">${escapeHtml(formatCurrency(invoice.amountUsd))}</th></tr></tfoot>
</table>
${invoice.note ? `<p class="muted">${escapeHtml(invoice.note)}</p>` : ""}
</body>
</html>
`;
}

/** Saves text as a file from the browser. Call only from event handlers. */
export function downloadFile(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
