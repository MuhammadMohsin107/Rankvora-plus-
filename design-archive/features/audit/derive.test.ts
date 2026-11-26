import { describe, expect, it } from "vitest";

import type { AuditBasis, AuditConfig, AuditRow, CrawledPage, WebsiteCheck } from "@/types/audit";
import type { ResponseSample } from "@/types/shared-records";

import { deriveAudit } from "./derive";
import { buildCsv, buildHtml, buildJson, type AuditReportData } from "./export";
import { buildAuditRow } from "./rows";
import { QUEUE_MS, VALIDATE_MS } from "./simulation";

const response = (promptId: string, channelId: string, n: number, mentioned: boolean): ResponseSample => ({
  id: `resp-aud-002-${n}`,
  storeId: "w",
  runKind: "audit",
  runId: "aud-002",
  promptId,
  promptVersion: 1,
  promptText: `Prompt ${promptId}`,
  channelId,
  providerLabel: channelId === "ch-a" ? "ProviderA" : "ProviderB",
  model: "m",
  searchMode: "web_grounded_auto",
  searchExecuted: true,
  market: "PK",
  language: "en",
  sample: 1,
  status: "succeeded",
  outcome: mentioned ? "mentioned" : "absent",
  answerText: "answer",
  brandSpans: [],
  brandMentioned: mentioned ? "yes" : "no",
  recommendation: mentioned ? "merely_mentioned" : "none",
  sentiment: "neutral",
  confidence: 0.9,
  evidenceQuote: null,
  position: null,
  competitors: [],
  citations: [],
  citationSupport: "none_returned",
  usage: { inputTokens: 10, outputTokens: 10, searchCalls: 0 },
  providerRequestId: `req${n}`,
  rawPayloadRef: `raw/${n}`,
  requestedAt: "2026-11-01T00:00:00Z",
  completedAt: "2026-11-01T00:00:01Z",
  analysisVersion: "1.2",
});

const page = (id: string, path: string, type: CrawledPage["type"]): CrawledPage => ({
  id,
  url: `https://x.test${path}`,
  path,
  type,
  status: 200,
  finalUrl: null,
  redirectHops: 0,
  contentType: "text/html",
  sizeKb: 10,
  depth: 1,
  rendered: false,
  publishedAt: null,
  indexable: true,
  metaRobots: null,
  xRobots: null,
  canonical: null,
  canonicalSelf: true,
  title: path,
  metaDescription: null,
  h1: [],
  h2: [],
  schemaTypes: [],
  schemaIssues: [],
  words: 100,
  inlinks: 1,
  outInternal: 1,
  outExternal: 0,
  brokenLinks: [],
  lab: null,
  field: null,
  crawledAt: "",
});

const check = (id: string, name: string, group: WebsiteCheck["group"], status: WebsiteCheck["status"]): WebsiteCheck => ({
  id,
  group,
  kind: "technical",
  name,
  status,
  affected: null,
  affectedPaths: [],
  evidence: { label: "x", snippet: "s" },
  findingId: null,
});

const basis: AuditBasis = {
  storeId: "w",
  brandName: "Brand",
  domain: "x.test",
  market: "PK",
  language: "en",
  basisAudit: { id: "aud-002", title: "Full audit" },
  basisConfig: {} as AuditConfig,
  responses: [response("p1", "ch-a", 1, true), response("p1", "ch-b", 2, false), response("p2", "ch-a", 3, false), response("p2", "ch-b", 4, false)],
  channels: [
    { id: "ch-a", providerLabel: "ProviderA", apiLabel: "API", model: "m", searchMode: "web_grounded_auto", supportsCitations: true },
    { id: "ch-b", providerLabel: "ProviderB", apiLabel: "API", model: "m", searchMode: "web_grounded_auto", supportsCitations: true },
  ],
  prompts: [
    { id: "p1", text: "Prompt p1", version: 1, groupId: null, status: "active" },
    { id: "p2", text: "Prompt p2", version: 1, groupId: null, status: "active" },
  ],
  groups: [],
  suggestedCompetitors: [],
  pages: [page("1", "/", "home"), page("2", "/shop", "collection"), page("3", "/guide", "guide")],
  checks: [check("c1", "Homepage responds", "reachability", "pass"), check("c2", "Product price matches", "structured_data", "fail")],
  crawlers: [],
  findings: [],
  tasks: [],
};

const config: AuditConfig = {
  promptScope: "ids",
  promptIds: ["p1", "p2", "p3"],
  prompts: [
    { id: "p1", text: "Prompt p1", version: 1 },
    { id: "p2", text: "Prompt p2", version: 1 },
    { id: "p3", text: "New local prompt", version: 1 },
  ],
  channelIds: ["ch-a", "ch-b"],
  samples: 1,
  market: "AE",
  language: "en",
  startPoints: ["Homepage"],
  maxUrls: 10,
  maxDepth: 2,
  pageTypes: ["home", "guide"],
  excludedPaths: [],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: true, pageSpeed: true, cms: false },
  limits: { maxRequests: 100, concurrency: 4, budgetUsd: 8 },
  categories: ["technical", "structured_data"],
  noAnswerPromptIds: ["p3"],
};

const T0 = Date.parse("2026-11-19T10:00:00Z");
const row = (): AuditRow => ({
  ...buildAuditRow({ storeId: "w", type: "focused", lanes: ["ai_visibility", "website_readiness"], config, counts: { jobs: 6, pages: 2, checks: 2 }, createdBy: "You", basisAuditId: "aud-002", nowMs: T0, stamp: "x" }),
  id: "demo-audits-1",
});

describe("deriveAudit", () => {
  it("shows nothing but setup before requests are sent", () => {
    const d = deriveAudit(basis, row(), T0 + 500)!;
    expect(d.row.status).toBe("validating");
    expect(d.ai?.responses).toHaveLength(0);
    expect(d.findings).toHaveLength(0);
  });

  it("builds responses for the scoped prompts and providers, reused from the basis and relabelled", () => {
    const r = row();
    const d = deriveAudit(basis, r, T0 + (r.plan?.endAtMs ?? 0))!;
    expect(d.ai?.responses).toHaveLength(6);
    expect(d.ai?.responses.every((x) => x.runId === "demo-audits-1" && x.market === "AE")).toBe(true);
    expect(d.detail.limitations.some((l) => l.id === "simulated")).toBe(true);
    expect(d.detail.limitations.some((l) => l.id === "market")).toBe(true);
  });

  it("counts requests with no demonstration answer as failed, never as brand absent", () => {
    const r = row();
    const d = deriveAudit(basis, r, T0 + (r.plan?.endAtMs ?? 0))!;
    const forNew = d.ai!.responses.filter((x) => x.promptId === "p3");
    expect(forNew).toHaveLength(2);
    expect(forNew.every((x) => x.status === "failed" && x.brandMentioned === "uncertain")).toBe(true);
    expect(d.ai!.mention.d).toBe(d.ai!.succeeded);
    expect(d.detail.coverage.responses.d).toBe(6);
  });

  it("agrees everywhere on how many requests failed because a prompt has no answer", () => {
    const r = row();
    expect(r.plan?.noAnswerSlots).toEqual([4, 5]);
    const d = deriveAudit(basis, r, T0 + (r.plan?.endAtMs ?? 0))!;
    const ok = d.ai!.responses.filter((x) => x.status === "succeeded").length;
    expect(ok).toBeLessThanOrEqual(4);
    expect(d.detail.coverage.responses).toEqual({ n: ok, d: 6 });
    expect(d.progress.jobs.succeeded).toBe(ok);
    expect(d.row.succeededJobs).toBe(ok);
    expect(d.row.failedJobs).toBe(6 - ok);
    expect(d.detail.status).toBe("partially_completed");
    expect(d.detail.limitations.some((l) => l.id === "no-answer")).toBe(true);
    expect(d.detail.limitations.some((l) => l.id === "failed")).toBe(true);
    const noAnswer = d.ai!.responses.filter((x) => x.promptId === "p3");
    expect(noAnswer.every((x) => x.failure?.message.includes("no answer for this prompt and provider"))).toBe(true);
  });

  it("keeps audits without no-answer slots unchanged", () => {
    const legacy = { ...buildAuditRow({ storeId: "w", type: "focused", lanes: ["ai_visibility"], config: { ...config, noAnswerPromptIds: undefined }, counts: { jobs: 6, pages: 0, checks: 0 }, createdBy: "You", basisAuditId: "aud-002", nowMs: T0, stamp: "x" }), id: "demo-audits-2" };
    expect(legacy.plan?.noAnswerSlots).toBeUndefined();
  });

  it("limits the crawl to chosen page types and categories", () => {
    const r = row();
    const d = deriveAudit(basis, r, T0 + (r.plan?.endAtMs ?? 0))!;
    expect(d.web?.pages.map((p) => p.type).sort()).toEqual(["guide", "home"]);
    expect(d.web?.checks.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("keeps the two lanes separate and omits an unselected lane", () => {
    const r = { ...row(), lanes: ["ai_visibility" as const] };
    const d = deriveAudit(basis, r, T0 + 60000)!;
    expect(d.web).toBeNull();
    expect(d.summary.website).toBeNull();
    expect(d.summary.ai).not.toBeNull();
  });

  it("gives a partial result while running and a snapshot-less state when cancelled", () => {
    const r = row();
    const at = VALIDATE_MS + QUEUE_MS + 1500;
    const mid = deriveAudit(basis, r, T0 + at)!;
    expect(mid.detail.provisional).toBe(true);
    expect(mid.ai!.responses.length).toBeLessThan(6);
    const cancelled = deriveAudit(basis, { ...r, status: "cancelled", run: { ...r.run!, endedElapsedMs: at } }, T0 + 999999)!;
    expect(cancelled.detail.status).toBe("cancelled");
    expect(cancelled.detail.snapshotId).toBeNull();
    expect(cancelled.findings).toHaveLength(0);
    expect(cancelled.ai!.responses.length).toBe(mid.ai!.responses.length);
  });
});

describe("report exports", () => {
  const r = row();
  const d = deriveAudit(basis, r, T0 + (r.plan?.endAtMs ?? 0))!;
  const data: AuditReportData = { audit: d.detail, ai: d.ai, web: d.web, findings: d.findings, tasks: [], websiteName: "x.test", simulated: true, generatedAt: "2026-11-19T10:05:00Z" };

  it("writes CSV with a header and one row per record", () => {
    const lines = buildCsv(data).split("\r\n");
    expect(lines[0]).toBe("record_type,id,label,group,status,result,detail");
    expect(lines.length).toBeGreaterThan(6);
    expect(lines.some((l) => l.startsWith("website_check,c1"))).toBe(true);
  });
  it("writes JSON with numerators and denominators and marks it simulated", () => {
    const json = JSON.parse(buildJson(data));
    expect(json.simulated).toBe(true);
    expect(json.coverage.responses.d).toBe(6);
    expect(json.aiVisibility.mention).toHaveProperty("n");
  });
  it("writes a self-contained HTML document with a print stylesheet and escapes text", () => {
    const html = buildHtml({ ...data, audit: { ...d.detail, title: "<b>Audit</b>" } });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("@media print");
    expect(html).toContain("&lt;b&gt;Audit&lt;/b&gt;");
    expect(html).toContain("Simulated audit");
  });
});
