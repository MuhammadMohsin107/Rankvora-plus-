/**
 * Report exports built in the browser from the data on screen: CSV, JSON and a self-contained HTML document
 * (also used for the preview and for printing). Pure; no React. Rates always carry numerator and denominator.
 */
import { formatDateTime, formatPercent, ratePercent } from "@/lib/format";
import type { Rate } from "@/types/core";
import type { AiLane, AuditDetail, AuditFinding, AuditTaskLink, WebsiteLane } from "@/types/audit";

import { AUDIT_TYPE_LABEL, CHECK_GROUP_LABEL, FINDING_CATEGORY_LABEL } from "./labels";

export type AuditReportData = {
  audit: AuditDetail;
  ai: AiLane | null;
  web: WebsiteLane | null;
  findings: AuditFinding[];
  tasks: AuditTaskLink[];
  websiteName: string;
  /** True for audits created in this browser. */
  simulated: boolean;
  generatedAt: string;
};

const rate = (r: Rate | null) => (r && r.d > 0 ? `${formatPercent(ratePercent(r.n, r.d))} (${r.n}/${r.d})` : "N/A");
const rateJson = (r: Rate | null) => (r && r.d > 0 ? { n: r.n, d: r.d, percent: Math.round(((r.n / r.d) * 1000)) / 10 } : { n: null, d: null, percent: null });

export const reportBaseName = (data: AuditReportData) => `audit-${data.audit.id}${data.audit.snapshotId ? `-${data.audit.snapshotId}` : ""}`;

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function buildCsv(data: AuditReportData): string {
  const head = ["record_type", "id", "label", "group", "status", "result", "detail"];
  const rows: (string | number | null)[][] = [];
  for (const r of data.ai?.responses ?? []) {
    rows.push(["ai_response", r.id, r.promptText, `${r.providerLabel} · sample ${r.sample}`, r.status, r.status === "failed" ? "failed (not counted as absent)" : `${r.brandMentioned === "yes" ? "mentioned" : "not mentioned"} · ${r.recommendation}`, `${r.citations.length} citations · ${r.market} ${r.language}`]);
  }
  for (const c of data.web?.checks ?? []) {
    rows.push(["website_check", c.id, c.name, CHECK_GROUP_LABEL[c.group], c.status, c.affected === null ? "site-wide" : `${c.affected} pages`, c.evidence.snippet.replace(/\s+/g, " ")]);
  }
  for (const p of data.web?.pages ?? []) {
    rows.push(["page", p.id, p.url, p.type, `HTTP ${p.status}`, p.indexable ? "indexable" : "not indexable", p.title ?? ""]);
  }
  for (const f of data.findings) {
    rows.push(["finding", f.id, f.title, FINDING_CATEGORY_LABEL[f.category], f.status, f.severity, `${f.taskIds.length} tasks`]);
  }
  return [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

export function buildJson(data: AuditReportData): string {
  const { audit, ai, web } = data;
  const payload = {
    simulated: data.simulated,
    note: data.simulated ? "Simulated audit in a demonstration. Nothing was sent to a provider or crawled." : "Demonstration data.",
    audit: { id: audit.id, title: audit.title, type: audit.type, status: audit.status, lanes: audit.lanes, snapshotId: audit.snapshotId, startedAt: audit.startedAt, completedAt: audit.completedAt },
    scope: audit.config,
    coverage: {
      responses: rateJson(audit.coverage.responses),
      prompts: rateJson(audit.coverage.prompts),
      providers: rateJson(audit.coverage.providers),
      pages: rateJson(audit.coverage.pages),
      checks: rateJson(audit.coverage.checks),
    },
    aiVisibility: ai ? { mention: rateJson(ai.mention), recommendation: rateJson(ai.recommendation), ownedCitation: rateJson(ai.ownedCitation), responses: ai.responses.map((r) => ({ id: r.id, promptId: r.promptId, promptVersion: r.promptVersion, channelId: r.channelId, sample: r.sample, status: r.status, outcome: r.outcome, citations: r.citations.length, rawPayloadRef: r.rawPayloadRef })) } : null,
    websiteReadiness: web ? { technical: rateJson(web.technical), content: rateJson(web.content), checkCoverage: rateJson(web.checkCoverage), checks: web.checks.map((c) => ({ id: c.id, group: c.group, name: c.name, status: c.status, affected: c.affected, findingId: c.findingId })) } : null,
    findings: data.findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      status: f.status,
      evidence: f.evidenceIds ?? null,
      fixHandoff: data.tasks.filter((t) => t.findingId === f.id).map((t) => ({ taskId: t.id, status: t.status })),
    })),
    limitations: audit.limitations.map((l) => l.text),
    generatedAt: data.generatedAt,
  };
  return JSON.stringify(payload, null, 2);
}

// ---------------------------------------------------------------------------
// HTML (preview, download, print)
// ---------------------------------------------------------------------------

const esc = (value: string | number) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#171923;margin:0;padding:32px;max-width:860px}
  h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px;padding-top:12px;border-top:1px solid #e6e8ef}
  .muted{color:#667085}.badge{display:inline-block;border:1px solid #e6e8ef;border-radius:999px;padding:1px 10px;font-size:12px;margin-right:6px}
  table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef0f4;vertical-align:top}th{color:#667085;font-weight:500}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{border:1px solid #e6e8ef;border-radius:10px;padding:12px}
  .metric b{display:block;font-size:20px}ul{padding-left:18px;margin:6px 0}
  @media print{body{padding:0;max-width:none}h2{break-after:avoid}table,.metric{break-inside:avoid}}
`;

const metric = (label: string, r: Rate | null) => `<div class="metric"><span class="muted">${esc(label)}</span><b>${r && r.d > 0 ? esc(formatPercent(ratePercent(r.n, r.d))) : "N/A"}</b><span class="muted">${r && r.d > 0 ? `${r.n} of ${r.d}` : "no data"}</span></div>`;

export function buildHtml(data: AuditReportData): string {
  const { audit, ai, web } = data;
  const sev = ["critical", "high", "medium", "low", "informational"].map((s) => `${s} ${data.findings.filter((f) => f.severity === s).length}`).join(" · ");
  const tasksFor = (id: string) => data.tasks.filter((t) => t.findingId === id);
  const body = [
    `<h1>${esc(audit.title)}</h1>`,
    `<p class="muted">${esc(data.websiteName)} · ${esc(AUDIT_TYPE_LABEL[audit.type])} audit · ${esc(audit.status.replace(/_/g, " "))}${audit.snapshotId ? ` · snapshot ${esc(audit.snapshotId)}` : ""}</p>`,
    `<p><span class="badge">${data.simulated ? "Simulated audit" : "Demonstration data"}</span><span class="badge">Generated ${esc(formatDateTime(data.generatedAt))} UTC</span></p>`,
    `<h2>1. Coverage</h2><div class="grid">${[metric("Responses returned", audit.coverage.responses), metric("Prompts answered", audit.coverage.prompts), metric("Pages assessed", audit.coverage.pages)].join("")}</div>`,
    ai ? `<h2>2. AI visibility</h2><p class="muted">API answer samples. Failed requests are excluded from every rate.</p><div class="grid">${[metric("Mention rate", ai.mention), metric("Recommendation rate", ai.recommendation), metric("Owned citation rate", ai.ownedCitation)].join("")}</div>` : `<h2>2. AI visibility</h2><p class="muted">Not part of this audit.</p>`,
    web
      ? `<h2>3. Website readiness</h2><p class="muted">Technical and content-quality rates are never combined.</p><div class="grid">${[metric("Technical pass rate", web.technical), metric("Content-quality pass rate", web.content), metric("Check coverage", web.checkCoverage)].join("")}</div>${
          web.crawlers.length ? `<h2>AI crawler access</h2><table><tr><th>Crawler</th><th>Purpose</th><th>Access</th></tr>${web.crawlers.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.purpose)}</td><td>${c.allowed ? "Allowed" : "Disallowed"}</td></tr>`).join("")}</table>` : ""
        }`
      : `<h2>3. Website readiness</h2><p class="muted">Not part of this audit.</p>`,
    `<h2>4. Findings (${data.findings.length})</h2><p class="muted">${esc(sev)}</p>${
      data.findings.length
        ? `<table><tr><th>Finding</th><th>Severity</th><th>Status</th><th>Fix tasks</th></tr>${data.findings.map((f) => `<tr><td>${esc(f.id)} · ${esc(f.title)}</td><td>${esc(f.severity)}</td><td>${esc(f.status.replace(/_/g, " "))}</td><td>${tasksFor(f.id).length ? tasksFor(f.id).map((t) => esc(t.id)).join(", ") : "None yet"}</td></tr>`).join("")}</table>`
        : `<p class="muted">No findings in this snapshot.</p>`
    }`,
    `<h2>5. Limitations</h2><ul>${audit.limitations.map((l) => `<li>${esc(l.text)}</li>`).join("")}</ul>`,
    `<p class="muted">Rates: ${esc(rate(audit.coverage.responses))} responses returned.</p>`,
  ].join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(audit.title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}
