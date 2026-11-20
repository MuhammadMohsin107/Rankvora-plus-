/**
 * Export builders: CSV, JSON and standalone HTML (which carries its own print stylesheet), all generated in the
 * browser from the displayed ReportDocument. Pure strings in, pure strings out.
 */
import { formatRate } from "@/lib/format";
import type { ReportCell, ReportDocument, ReportMetric } from "@/types/shared-records";

/** Quotes a CSV cell and neutralises spreadsheet formulas: a leading = + - @ tab or CR gets a single quote in front. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const rateOrNa = (n: number | null, d: number | null) => (n === null || d === null ? "N/A" : d === 0 ? "N/A" : formatRate(n, d));

/** One table, long format: section, row label, metric, numerator, denominator, rate. Missing data is "N/A", never 0. */
export function reportToCsv(doc: ReportDocument): string {
  const header = ["section", "item", "metric", "numerator", "denominator", "rate", "previous_numerator", "previous_denominator", "text"];
  const rows: (string | number | null)[][] = [];
  for (const m of doc.metrics) {
    rows.push([
      "headline",
      "",
      m.label,
      m.n === null ? "N/A" : m.n,
      m.n === null ? "N/A" : (m.d ?? ""),
      m.n === null ? "N/A" : m.d === null ? "" : rateOrNa(m.n, m.d),
      m.previous === undefined ? "" : m.previous === null ? "N/A" : m.previous.n,
      m.previous === undefined ? "" : m.previous === null ? "N/A" : m.previous.d,
      "",
    ]);
  }
  for (const c of doc.coverage) rows.push(["coverage", "", c.label, c.n, c.d, rateOrNa(c.n, c.d), "", "", ""]);
  for (const table of doc.tables) {
    for (const row of table.rows) {
      const label = String(row[table.columns[0]?.id] ?? "");
      for (const col of table.columns.slice(1)) {
        const cell = row[col.id];
        if (cell !== null && typeof cell === "object") rows.push([table.title, label, col.label, cell.n, cell.d, rateOrNa(cell.n, cell.d), "", "", ""]);
        else if (col.kind === "rate") rows.push([table.title, label, col.label, "N/A", "N/A", "N/A", "", "", ""]);
        else rows.push([table.title, label, col.label, typeof cell === "number" ? cell : "", "", "", "", "", cell === null ? "N/A" : typeof cell === "string" ? cell : ""]);
      }
    }
  }
  for (const e of doc.evidence) rows.push(["evidence", e.id, e.title, "", "", "", "", "", ""]);
  return toCsv(header, rows);
}

/** Export JSON: the document without original answer text (evidence keeps ids so the answers can be opened in the app). */
export function reportToJson(doc: ReportDocument, exportedAt: string): string {
  const evidence = doc.evidence.map((item) => ({ id: item.id, title: item.title, note: item.note, ids: item.ids }));
  return JSON.stringify({ exportedAt, demonstrationData: true, ...doc, evidence }, null, 2);
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (value: string | number): string => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function cellText(cell: ReportCell | undefined): string {
  if (cell === null || cell === undefined) return "N/A";
  if (typeof cell === "object") return cell.d === 0 ? "N/A" : `${cell.n} / ${cell.d} (${formatRate(cell.n, cell.d)})`;
  return String(cell);
}

function metricText(m: ReportMetric): string {
  if (m.n === null) return `N/A${m.naReason ? ` (${m.naReason})` : ""}`;
  if (m.d === null) return String(m.n);
  return `${m.n} / ${m.d} (${rateOrNa(m.n, m.d)})`;
}

const STYLE = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#171923;font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 24px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e6e8ef;padding-bottom:6px}
p{margin:4px 0}.muted{color:#667085}.badge{display:inline-block;border:1px solid #e6e8ef;border-radius:999px;padding:0 8px;font-size:12px;margin-right:6px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef0f4;vertical-align:top}
th{color:#667085;font-weight:600}.r{text-align:right}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.metric{border:1px solid #e6e8ef;border-radius:8px;padding:12px}.metric b{display:block;font-size:20px}
ul{padding-left:20px;margin:6px 0}footer{margin-top:32px;font-size:12px;color:#667085}
@page{margin:16mm}
@media print{main{padding:0;max-width:none}h2{break-after:avoid}table,.metric,li{break-inside:avoid}a{color:inherit;text-decoration:none}}
`;

/** A complete standalone HTML page (inline CSS, print stylesheet, no scripts). Every value is escaped. */
export function reportToHtml(doc: ReportDocument, exportedAt: string): string {
  const e = escapeHtml;
  const metrics = doc.metrics
    .map(
      (m) =>
        `<div class="metric"><span class="muted">${e(m.label)}</span><b>${e(metricText(m))}</b>${m.previous === undefined ? "" : `<span class="muted">${m.previous === null ? "Previous: N/A" : `Previous: ${e(m.previous.n)} / ${e(m.previous.d)} (${e(rateOrNa(m.previous.n, m.previous.d))})`}</span>`}${m.basis ? `<br><span class="muted">${e(m.basis)}</span>` : ""}</div>`,
    )
    .join("");
  const tables = doc.tables
    .map(
      (t) =>
        `<h2>${e(t.title)}</h2><table><thead><tr>${t.columns.map((c) => `<th class="${c.align === "right" ? "r" : ""}">${e(c.label)}</th>`).join("")}</tr></thead><tbody>${t.rows
          .map((row) => `<tr>${t.columns.map((c) => `<td class="${c.align === "right" ? "r" : ""}">${e(cellText(row[c.id]))}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(doc.title)}</title><style>${STYLE}</style></head>
<body><main>
<p class="muted">${e(doc.websiteName)} · ${e(doc.type)} report · demonstration data</p>
<h1>${e(doc.title)}</h1>
<p><span class="badge">${e(doc.period)}</span><span class="badge">${e(doc.version)}</span>${doc.verdict ? `<span class="badge">${e(doc.verdict.label)}</span>` : ""}</p>
<h2>Summary</h2><ul>${doc.summary.map((line) => `<li>${e(line)}</li>`).join("")}</ul>
${doc.metrics.length > 0 ? `<h2>Headline metrics</h2><div class="metrics">${metrics}</div>` : ""}
${doc.coverage.length > 0 ? `<h2>Sample coverage</h2><ul>${doc.coverage.map((c) => `<li>${e(c.label)}: ${e(c.n)} of ${e(c.d)}</li>`).join("")}</ul>` : ""}
${tables}
<h2>Scope</h2><table><tbody>${doc.scope.map((s) => `<tr><th>${e(s.label)}</th><td>${e(s.value)}</td></tr>`).join("")}</tbody></table>
${doc.evidence.length > 0 ? `<h2>Evidence</h2><ul>${doc.evidence.map((item) => `<li>${e(item.title)} <span class="muted">(${e(item.id)}${item.note ? ` · ${e(item.note)}` : ""})</span></li>`).join("")}</ul>` : ""}
<h2>Limitations</h2><ul>${doc.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>
<h2>Methodology</h2><ul>${doc.methodology.map((l) => `<li>${e(l)}</li>`).join("")}</ul>
<footer>Source ${e(doc.source.id)}${doc.source.snapshotIds.length ? ` · ${doc.source.snapshotIds.map(e).join(", ")}` : ""} · Report generated ${e(doc.generatedAt)} · Exported ${e(exportedAt)} · API answer samples, not consumer-app results.</footer>
</main></body></html>`;
}

/** Safe file name stem: "rep-aud-002" stays, anything odd becomes a dash. */
export function exportFileName(reportId: string, extension: "csv" | "json" | "html"): string {
  return `${reportId.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[.-]+/, "") || "report"}.${extension}`;
}
