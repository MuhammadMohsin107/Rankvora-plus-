/**
 * DEMONSTRATION DATA — not real.
 * Findings and AI response samples shared by Audit, Fixes, Monitoring and Comparison.
 * Generated deterministically from src/demo/registry.ts so headline numbers always agree.
 */
import { ALL_PROMPTS, DEMO_CHANNELS, DEMO_COMPETITORS, DEMO_STORES } from "@/demo/shared";
import { AE, REGISTRY_STORE_IDS, RP, registryFor } from "@/demo/registry";
import type { Finding, ResponseCitation, ResponseSample } from "@/types/shared-records";

// ---------------------------------------------------------------------------
// Findings (11). Statuses match the registry tasks: 8 open, 3 closed.
// ---------------------------------------------------------------------------

const f = (x: Omit<Finding, "storeId" | "recurrenceCount" | "taskIds"> & { recurrenceCount?: number; taskIds?: string[] }): Finding => ({
  storeId: RP,
  recurrenceCount: 1,
  taskIds: [],
  ...x,
});

const PK_FINDINGS: Finding[] = [
  f({
    id: "fnd-001",
    title: "Glide 2 page lacks running-surface and cushioning details",
    category: "product",
    severity: "medium",
    priority: "P1",
    confidence: "high",
    status: "in_remediation",
    lane: "website_readiness",
    firstDetectedAt: "2026-10-20T05:34:00Z",
    lastObservedAt: "2026-11-19T08:55:00Z",
    auditId: "aud-002",
    affectedUrls: ["https://runpro.pk/products/glide-2"],
    affectedPromptIds: ["p-005", "p-010"],
    expected: "Surface suitability, cushioning level and weight are stated on the product page.",
    actual: "Page lists price and sizes only; 3 of 5 expected product attributes are missing.",
    recurrenceCount: 2,
    taskIds: ["task-001"],
  }),
  f({
    id: "fnd-002",
    title: "Structured-data price does not match visible price on Glide 2",
    category: "schema",
    severity: "high",
    priority: "P1",
    confidence: "high",
    status: "in_remediation",
    lane: "website_readiness",
    firstDetectedAt: "2026-10-20T05:40:00Z",
    lastObservedAt: "2026-11-19T08:56:00Z",
    auditId: "aud-002",
    affectedUrls: ["https://runpro.pk/products/glide-2"],
    affectedPromptIds: [],
    expected: "Product/Offer price in JSON-LD equals the visible page price.",
    actual: "JSON-LD shows PKR 13,500; visible price is PKR 12,900.",
    taskIds: ["task-002"],
  }),
  f({
    id: "fnd-003",
    title: "Two internal links to discontinued products return 404",
    category: "technical",
    severity: "medium",
    priority: "P2",
    confidence: "high",
    status: "confirmed",
    lane: "website_readiness",
    firstDetectedAt: "2026-10-20T05:28:00Z",
    lastObservedAt: "2026-11-19T08:50:00Z",
    auditId: "aud-002",
    affectedUrls: ["https://runpro.pk/collections/road", "https://runpro.pk/collections/sale"],
    affectedPromptIds: [],
    expected: "Internal links resolve to live pages.",
    actual: "2 internal links on collection pages return HTTP 404.",
    recurrenceCount: 3,
    taskIds: ["task-003"],
  }),
  f({
    id: "fnd-004",
    title: "Brand inconsistent on affordable-shoes prompt on Gemini",
    category: "ai_visibility",
    severity: "high",
    priority: "P2",
    confidence: "medium",
    status: "confirmed",
    lane: "ai_visibility",
    firstDetectedAt: "2026-11-17T04:44:00Z",
    lastObservedAt: "2026-11-17T04:44:00Z",
    auditId: "run-008",
    affectedUrls: [],
    affectedPromptIds: ["p-002"],
    expected: "Brand appears in a majority of samples for this neutral prompt.",
    actual: "Brand mentioned in 1 of 2 Gemini samples on the latest run. Samples vary between runs; repeat check pending.",
    recurrenceCount: 1,
    taskIds: ["task-007"],
  }),
  f({
    id: "fnd-005",
    title: "Brand written as “Run Pro” in the About page and footer",
    category: "entity",
    severity: "low",
    priority: "P2",
    confidence: "high",
    status: "new",
    lane: "website_readiness",
    firstDetectedAt: "2026-11-12T07:20:00Z",
    lastObservedAt: "2026-11-12T07:20:00Z",
    auditId: "aud-003",
    affectedUrls: ["https://runpro.pk/pages/about", "https://runpro.pk/"],
    affectedPromptIds: [],
    expected: "One official spelling across core pages.",
    actual: "“Run Pro” used on 2 of 6 core pages; “RunPro” elsewhere.",
  }),
  f({
    id: "fnd-006",
    title: "robots.txt disallows OAI-SearchBot",
    category: "technical",
    severity: "high",
    priority: "P1",
    confidence: "high",
    status: "under_review",
    lane: "website_readiness",
    firstDetectedAt: "2026-10-20T05:22:00Z",
    lastObservedAt: "2026-11-19T08:44:00Z",
    auditId: "aud-002",
    affectedUrls: ["https://runpro.pk/robots.txt"],
    affectedPromptIds: [],
    expected: "Crawler policy is a deliberate choice, reported separately per crawler.",
    actual: "OAI-SearchBot is disallowed; GPTBot and ChatGPT-User follow the default rule.",
    recurrenceCount: 4,
    taskIds: ["task-006"],
  }),
  f({
    id: "fnd-007",
    title: "No guide answering “how to choose a running shoe”",
    category: "content",
    severity: "medium",
    priority: "P2",
    confidence: "medium",
    status: "awaiting_verification",
    lane: "website_readiness",
    firstDetectedAt: "2026-08-12T06:30:00Z",
    lastObservedAt: "2026-11-15T09:00:00Z",
    auditId: "aud-001",
    affectedUrls: ["https://runpro.pk/blogs/guides"],
    affectedPromptIds: ["p-007"],
    expected: "A page directly answers the beginner buying question.",
    actual: "No indexed page covers the topic; guide published 15 Nov, not yet re-checked.",
    recurrenceCount: 3,
    taskIds: ["task-004"],
  }),
  f({
    id: "fnd-008",
    title: "Organization schema missing sameAs and contact points",
    category: "schema",
    severity: "low",
    priority: "P3",
    confidence: "high",
    status: "verified_resolved",
    lane: "website_readiness",
    firstDetectedAt: "2026-08-12T06:33:00Z",
    lastObservedAt: "2026-11-12T07:25:00Z",
    auditId: "aud-001",
    affectedUrls: ["https://runpro.pk/"],
    affectedPromptIds: [],
    expected: "Organization markup includes sameAs and contactPoint.",
    actual: "Verified present on 12 Nov re-crawl.",
    taskIds: ["task-005"],
  }),
  f({
    id: "fnd-009",
    title: "Brand X cited more than runpro.pk on comparison prompts",
    category: "ai_visibility",
    severity: "medium",
    priority: "P2",
    confidence: "medium",
    status: "new",
    lane: "ai_visibility",
    firstDetectedAt: "2026-11-17T04:50:00Z",
    lastObservedAt: "2026-11-17T04:50:00Z",
    auditId: "run-008",
    affectedUrls: [],
    affectedPromptIds: ["p-003", "p-004"],
    expected: "Owned domain appears among cited sources for brand-specific comparisons.",
    actual: "brandx.example cited in 5 responses; runpro.pk in 2 (citation-capable responses).",
    taskIds: ["task-008"],
  }),
  f({
    id: "fnd-010",
    title: "Duplicate title tags on collection pages",
    category: "technical",
    severity: "low",
    priority: "P3",
    confidence: "low",
    status: "false_positive",
    lane: "website_readiness",
    firstDetectedAt: "2026-08-12T06:36:00Z",
    lastObservedAt: "2026-10-20T05:30:00Z",
    auditId: "aud-001",
    affectedUrls: ["https://runpro.pk/collections/road"],
    affectedPromptIds: [],
    expected: "Each collection page has a unique title.",
    actual: "Reviewed: titles differ by pagination suffix, intended behaviour.",
  }),
  f({
    id: "fnd-011",
    title: "Blog index loads slowly on mobile (lab LCP 3.1 s)",
    category: "technical",
    severity: "low",
    priority: "P3",
    confidence: "medium",
    status: "accepted_risk",
    lane: "website_readiness",
    firstDetectedAt: "2026-10-20T05:45:00Z",
    lastObservedAt: "2026-11-19T08:58:00Z",
    auditId: "aud-002",
    affectedUrls: ["https://runpro.pk/blogs/guides"],
    affectedPromptIds: [],
    expected: "Lab LCP ≤ 2.5 s (lab measurement, no field data available).",
    actual: "Lab LCP 3.1 s on mobile. Accepted by owner, review in January.",
  }),
];

// ---------------------------------------------------------------------------
// runpro-ae findings (6). Statuses match REGISTRY_AE_TASKS: 4 open, 2 closed.
// ---------------------------------------------------------------------------

const fa = (x: Omit<Finding, "storeId" | "recurrenceCount" | "taskIds"> & { recurrenceCount?: number; taskIds?: string[] }): Finding => ({
  storeId: AE,
  recurrenceCount: 1,
  taskIds: [],
  ...x,
});

const AE_FINDINGS: Finding[] = [
  fa({
    id: "fnd-ae-001",
    title: "Product and Offer schema missing on WooCommerce product pages",
    category: "schema",
    severity: "high",
    priority: "P1",
    confidence: "high",
    status: "in_remediation",
    lane: "website_readiness",
    firstDetectedAt: "2026-09-16T05:28:00Z",
    lastObservedAt: "2026-11-19T06:10:00Z",
    auditId: "aud-ae-001",
    affectedUrls: ["https://runpro.ae/product/glide-2", "https://runpro.ae/product/daily-trainer", "https://runpro.ae/product/marathon-elite"],
    affectedPromptIds: ["p-ae-002", "p-ae-005"],
    expected: "Every product page exposes Product and Offer structured data (name, price, currency, availability).",
    actual: "Complete Product and Offer markup is missing on 3 of 3 sampled product pages. Daily Trainer and Marathon Elite have none; Glide 2 has only a stray Offer block with the wrong currency (fnd-ae-002). Only the WooCommerce breadcrumb markup is otherwise present.",
    recurrenceCount: 2,
    taskIds: ["task-ae-001"],
  }),
  fa({
    id: "fnd-ae-002",
    title: "JSON-LD price currency is USD while the visible price is AED",
    category: "schema",
    severity: "critical",
    priority: "P0",
    confidence: "high",
    status: "confirmed",
    lane: "website_readiness",
    firstDetectedAt: "2026-09-16T05:31:00Z",
    lastObservedAt: "2026-11-19T06:11:00Z",
    auditId: "aud-ae-001",
    affectedUrls: ["https://runpro.ae/product/glide-2"],
    affectedPromptIds: [],
    expected: "priceCurrency in the Offer equals the currency shown on the page (AED).",
    actual: "Offer reports priceCurrency USD with price 349; the page shows AED 1,280.",
    recurrenceCount: 2,
    taskIds: ["task-ae-002"],
  }),
  fa({
    id: "fnd-ae-003",
    title: "UAE delivery and returns policy is not stated on product pages",
    category: "content",
    severity: "medium",
    priority: "P2",
    confidence: "medium",
    status: "under_review",
    lane: "website_readiness",
    firstDetectedAt: "2026-11-05T05:33:00Z",
    lastObservedAt: "2026-11-19T06:12:00Z",
    auditId: "aud-ae-002",
    affectedUrls: ["https://runpro.ae/product/glide-2", "https://runpro.ae/product/daily-trainer"],
    affectedPromptIds: ["p-ae-002"],
    expected: "Delivery area, delivery time and returns window are stated on each product page.",
    actual: "2 of 4 sampled product pages mention shipping only in the footer; returns are on a separate page.",
    taskIds: ["task-ae-003"],
  }),
  fa({
    id: "fnd-ae-004",
    title: "GulfRun is cited more often than runpro.ae on Dubai prompts",
    category: "ai_visibility",
    severity: "medium",
    priority: "P2",
    confidence: "medium",
    status: "new",
    lane: "ai_visibility",
    firstDetectedAt: "2026-11-05T05:38:00Z",
    lastObservedAt: "2026-11-18T05:30:00Z",
    auditId: "aud-ae-002",
    affectedUrls: ["https://runpro.ae/"],
    affectedPromptIds: ["p-ae-002", "p-ae-005"],
    expected: "Owned pages are cited at least as often as a single competitor on local buying prompts.",
    actual: "In the November audit, gulfrun.example is cited in 10 of 12 responses to the two local prompts (p-ae-002, p-ae-005); runpro.ae in 1 of 12. Citation-capable responses only; no failed requests in that audit.",
    taskIds: ["task-ae-004"],
  }),
  fa({
    id: "fnd-ae-005",
    title: "Sitemap lists 9 URLs that redirect to runpro.pk",
    category: "technical",
    severity: "low",
    priority: "P3",
    confidence: "high",
    status: "verified_resolved",
    lane: "website_readiness",
    firstDetectedAt: "2026-09-16T05:26:00Z",
    lastObservedAt: "2026-11-05T05:30:00Z",
    auditId: "aud-ae-001",
    affectedUrls: ["https://runpro.ae/sitemap.xml"],
    affectedPromptIds: [],
    expected: "Every URL in the sitemap returns 200 on runpro.ae.",
    actual: "Resolved: the latest audit found 0 redirecting URLs in the sitemap.",
    taskIds: ["task-ae-005"],
  }),
  fa({
    id: "fnd-ae-006",
    title: "Hot-weather running guidance is not mentioned in AI answers",
    category: "ai_visibility",
    severity: "informational",
    priority: "P3",
    confidence: "low",
    status: "accepted_risk",
    lane: "ai_visibility",
    firstDetectedAt: "2026-11-05T05:39:00Z",
    lastObservedAt: "2026-11-18T05:30:00Z",
    auditId: "aud-ae-002",
    affectedUrls: ["https://runpro.ae/"],
    affectedPromptIds: ["p-ae-003"],
    expected: "The brand appears for hot-weather running prompts.",
    actual: "Brand absent in 6 of 6 successful responses for this prompt (2 channels x 3 samples) in both the November audit and the 18 Nov weekly run. Accepted by the owner for now.",
    taskIds: ["task-ae-006"],
  }),
];

export const DEMO_FINDINGS: Finding[] = [...PK_FINDINGS, ...AE_FINDINGS];

// ---------------------------------------------------------------------------
// AI response samples
// ---------------------------------------------------------------------------

type Outcome = "recommended" | "mentioned" | "absent";

type GenProfile = {
  storeId: string;
  market: string;
  /** Flagship product named in answers and cited as the owned page. */
  product: string;
  ownedUrl: string;
  ownedDomain: string;
  /** Sentence fragments that vary by market. */
  shipsPhrase: string;
  soldPhrase: string;
  /** Competitor / third-party option names the generated answers draw from. */
  optionSets: string[][];
  competitorCitation: ResponseCitation;
  thirdParty: ResponseCitation[];
  /** Default samples per prompt × channel slot. */
  samples: number;
  channelBonus: Record<string, number>;
};

const PROFILES: Record<string, GenProfile> = {
  [RP]: {
    storeId: RP,
    market: "PK",
    product: "RunPro Glide 2",
    ownedUrl: "https://runpro.pk/products/glide-2",
    ownedDomain: "runpro.pk",
    shipsPhrase: "RunPro ships across Pakistan",
    soldPhrase: "RunPro is also sold in Pakistan",
    optionSets: [
      ["SwiftStride Road Lite", "Brand X Starter", "TrailMate Terra"],
      ["Brand X Starter", "SwiftStride Road Lite"],
      ["TrailMate Terra", "SwiftStride Road Lite", "Brand X Starter"],
      ["SwiftStride Road Lite", "TrailMate Terra"],
      ["Brand X Starter", "TrailMate Terra"],
      ["SwiftStride Road Lite", "Brand X Starter"],
    ],
    competitorCitation: { url: "https://brandx.example/starter", title: "Brand X Starter", domain: "brandx.example", source: "competitor" },
    thirdParty: [
      { url: "https://runnersguide.example/best-beginner-shoes", title: "Best beginner running shoes", domain: "runnersguide.example", source: "third_party" },
      { url: "https://shoereview.example/pakistan-running-brands", title: "Running shoe brands in Pakistan", domain: "shoereview.example", source: "third_party" },
      { url: "https://pkfitness.example/how-to-choose-running-shoes", title: "How to choose running shoes", domain: "pkfitness.example", source: "third_party" },
    ],
    samples: 2,
    channelBonus: { "ch-openai": 0.6, "ch-gemini": 0.2, "ch-perplexity": 0.4 },
  },
  [AE]: {
    storeId: AE,
    market: "AE",
    product: "RunPro Glide 2",
    ownedUrl: "https://runpro.ae/product/glide-2",
    ownedDomain: "runpro.ae",
    shipsPhrase: "RunPro delivers across the UAE",
    soldPhrase: "RunPro is also sold in the UAE",
    optionSets: [
      ["SwiftStride Road Lite", "GulfRun Marina", "DesertRun Oasis"],
      ["Brand X Starter", "GulfRun Marina"],
      ["DesertRun Oasis", "SwiftStride Road Lite", "Brand X Starter"],
      ["GulfRun Marina", "DesertRun Oasis"],
      ["Brand X Starter", "SwiftStride Road Lite"],
      ["GulfRun Marina", "Brand X Starter", "DesertRun Oasis"],
    ],
    competitorCitation: { url: "https://gulfrun.example/marina", title: "GulfRun Marina", domain: "gulfrun.example", source: "competitor" },
    thirdParty: [
      { url: "https://uaerunners.example/best-running-shoes-dubai", title: "Best running shoes in Dubai", domain: "uaerunners.example", source: "third_party" },
      { url: "https://gccfitness.example/hot-weather-running-shoes", title: "Running shoes for hot weather", domain: "gccfitness.example", source: "third_party" },
      { url: "https://dubaisports.example/where-to-buy-running-shoes", title: "Where to buy running shoes in the UAE", domain: "dubaisports.example", source: "third_party" },
    ],
    samples: 3,
    channelBonus: { "ch-openai": 0.6, "ch-gemini": 0.2 },
  },
};

const profileForStore = (storeId: string): GenProfile => PROFILES[storeId] ?? PROFILES[RP];

const activePromptsOf = (storeId: string) => ALL_PROMPTS.filter((p) => p.storeId === storeId && p.status === "active");
const competitorNamesOf = (storeId: string) => DEMO_COMPETITORS.filter((c) => c.storeId === storeId && c.status === "confirmed").map((c) => c.name);

/** Prompt text/version at the time a run happened (prompts p-001 and p-003 were edited). */
export function promptVersionAt(promptId: string, isoDate: string): number {
  const t = Date.parse(isoDate);
  if (promptId === "p-001") return t < Date.parse("2026-10-02T09:00:00Z") ? 1 : 2;
  if (promptId === "p-003") return t < Date.parse("2026-09-05T00:00:00Z") ? 1 : t < Date.parse("2026-10-15T00:00:00Z") ? 2 : 3;
  return 1;
}

type RunConfig = {
  storeId: string;
  kind: "audit" | "monitoring";
  startedAt: string;
  planned: number;
  failed: number;
  mention: number;
  recommended: number;
  /** Only the first N slots exist (run still in progress). */
  completedSlots?: number;
  /** Restrict to these prompts/channels (small verification audits). */
  promptIds?: string[];
  channelIds?: string[];
  samples?: number;
};

function configFor(runId: string): RunConfig | null {
  for (const storeId of REGISTRY_STORE_IDS) {
    const reg = registryFor(storeId);
    const audit = reg.audits.find((a) => a.id === runId);
    if (audit) {
      const samples = profileForStore(storeId).samples;
      if (audit.id === "aud-003") {
        return { storeId, kind: "audit", startedAt: audit.startedAt, planned: 6, failed: 0, mention: 5, recommended: 2, promptIds: ["p-005", "p-001"], samples: 1 };
      }
      if (audit.id === "aud-004") {
        return { storeId, kind: "audit", startedAt: audit.startedAt, planned: 54, failed: 2, mention: 0, recommended: 0, completedSlots: 33 };
      }
      if (audit.id === "aud-ae-003") {
        return { storeId, kind: "audit", startedAt: audit.startedAt, planned: 12, failed: audit.failedJobs, mention: audit.mention?.n ?? 0, recommended: audit.recommendation?.n ?? 0, promptIds: ["p-ae-002", "p-ae-005"], samples };
      }
      return { storeId, kind: "audit", startedAt: audit.startedAt, planned: audit.plannedJobs, failed: audit.failedJobs, mention: audit.mention?.n ?? 0, recommended: audit.recommendation?.n ?? 0, samples };
    }
    const run = reg.runs.find((r) => r.id === runId);
    if (run) {
      return { storeId, kind: "monitoring", startedAt: run.scheduledFor, planned: run.plannedJobs, failed: run.failedJobs, mention: run.mention.n, recommended: run.recommendation.n, samples: profileForStore(storeId).samples };
    }
  }
  return null;
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function buildText(profile: GenProfile, outcome: Outcome, position: number, promptText: string, variant: number): string {
  const options = profile.optionSets[variant % profile.optionSets.length];
  const topic = promptText.replace(/\?$/, "");
  if (outcome === "recommended") {
    const list = [...options];
    list.splice(position - 1, 0, profile.product);
    const lines = list.slice(0, 4).map((name, i) => `${i + 1}. ${name} — ${i === position - 1 ? `balanced cushioning and a wide fit that suits beginners; ${profile.shipsPhrase}` : "a well-reviewed option in this category"}.`);
    return `For “${topic}”, these are commonly recommended:\n${lines.join("\n")}\nFor a first pair, ${profile.product} is a solid choice.`;
  }
  if (outcome === "mentioned") {
    return `For “${topic}”, popular options include ${joinNames(options.slice(0, 2))}. ${profile.soldPhrase}, though reviews of its durability are mixed. Check fit and return policy before buying.`;
  }
  return `For “${topic}”, commonly recommended options are ${joinNames(options)}. Look for cushioning that matches your weekly distance and try shoes on in the afternoon, when feet are slightly larger.`;
}

function spansFor(text: string, competitorNames: string[]): ResponseSample["brandSpans"] {
  const spans: ResponseSample["brandSpans"] = [];
  const find = (needle: string, kind: "brand" | "competitor") => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      spans.push({ start: at, end: at + needle.length, kind });
      from = at + needle.length;
    }
  };
  find("RunPro", "brand");
  for (const name of competitorNames) find(name, "competitor");
  return spans.sort((a, b) => a.start - b.start);
}

const cache = new Map<string, ResponseSample[]>();

/**
 * All responses for a run. Slots are keyed prompt × channel × sample in a fixed
 * order, so the same slot is comparable across runs. Counts match the registry exactly.
 */
export function buildRunResponses(runId: string): ResponseSample[] {
  const cached = cache.get(runId);
  if (cached) return cached;
  const config = configFor(runId);
  if (!config) return [];

  const profile = profileForStore(config.storeId);
  const storeChannelIds = DEMO_STORES.find((st) => st.id === config.storeId)?.channelIds ?? [];
  const ACTIVE_PROMPTS = activePromptsOf(config.storeId);
  const COMPETITOR_NAMES = competitorNamesOf(config.storeId);
  const storeChannels = DEMO_CHANNELS.filter((c) => storeChannelIds.includes(c.id));
  const prompts = config.promptIds ? ACTIVE_PROMPTS.filter((p) => config.promptIds!.includes(p.id)) : ACTIVE_PROMPTS;
  const channels = config.channelIds ? storeChannels.filter((c) => config.channelIds!.includes(c.id)) : storeChannels;
  const samples = config.samples ?? profile.samples;

  const slots: { promptId: string; channelId: string; sample: number }[] = [];
  for (const prompt of prompts) for (const channel of channels) for (let s = 1; s <= samples; s += 1) slots.push({ promptId: prompt.id, channelId: channel.id, sample: s });

  const limit = config.completedSlots ?? slots.length;
  const done = slots.slice(0, limit);

  // Failures: spread evenly through the run.
  const failedIdx = new Set<number>();
  const failedTarget = config.failed;
  for (let i = 0; i < failedTarget; i += 1) failedIdx.add(Math.floor(((i + 0.5) * done.length) / Math.max(failedTarget, 1)) % done.length);

  // Strength score → who is recommended / merely mentioned / absent.
  const channelBonus = profile.channelBonus;
  const scored = done
    .map((slot, idx) => {
      const prompt = ACTIVE_PROMPTS.find((p) => p.id === slot.promptId)!;
      const noise = ((idx * 37 + runId.length * 11) % 11) / 11;
      return { idx, score: (prompt.mentionsBrand ? 3 : 0) + (prompt.isCore ? 0.5 : 0) + (channelBonus[slot.channelId] ?? 0) + (slot.sample === 1 ? 0.05 : 0) + noise };
    })
    .filter((s) => !failedIdx.has(s.idx))
    .sort((a, b) => b.score - a.score || a.idx - b.idx);

  const outcomeAt = new Map<number, Outcome>();
  const completeRun = config.completedSlots === undefined;
  const recTarget = completeRun ? config.recommended : Math.round(scored.length * 0.2);
  const mentionTarget = completeRun ? config.mention : Math.round(scored.length * 0.5);
  scored.forEach((entry, order) => {
    outcomeAt.set(entry.idx, order < recTarget ? "recommended" : order < mentionTarget ? "mentioned" : "absent");
  });

  const responses = done.map<ResponseSample>((slot, idx) => {
    const prompt = ACTIVE_PROMPTS.find((p) => p.id === slot.promptId)!;
    const channel = DEMO_CHANNELS.find((c) => c.id === slot.channelId)!;
    const requested = new Date(Date.parse(config.startedAt) + idx * 47_000).toISOString();
    const version = promptVersionAt(prompt.id, config.startedAt);
    const base = {
      id: `resp-${runId}-${String(idx + 1).padStart(2, "0")}`,
      storeId: config.storeId,
      runKind: config.kind,
      runId,
      promptId: prompt.id,
      promptVersion: version,
      promptText: prompt.text,
      channelId: channel.id,
      providerLabel: channel.providerLabel,
      model: channel.model,
      searchMode: channel.searchMode,
      market: profile.market,
      language: "en",
      sample: slot.sample,
      providerRequestId: `req_${runId.replace("-", "")}_${String(idx + 1).padStart(3, "0")}`,
      rawPayloadRef: `raw/${runId}/${String(idx + 1).padStart(3, "0")}.json.enc`,
      requestedAt: requested,
      analysisVersion: "1.2",
    } as const;

    if (failedIdx.has(idx)) {
      const classes = ["timeout", "rate_limit", "provider_error"] as const;
      const cls = classes[idx % 3];
      const messages = { timeout: "Request timed out after 60 s", rate_limit: "Provider rate limit (429); retries exhausted", provider_error: "Provider returned a 503 error" };
      return {
        ...base,
        searchExecuted: false,
        status: "failed",
        failure: { class: cls, message: messages[cls], attempts: 3 },
        outcome: "failed",
        answerText: "",
        brandSpans: [],
        brandMentioned: "uncertain",
        recommendation: "none",
        sentiment: "unknown",
        confidence: 0,
        evidenceQuote: null,
        position: null,
        competitors: [],
        citations: [],
        citationSupport: "none_returned",
        usage: { inputTokens: 0, outputTokens: 0, searchCalls: 0 },
        completedAt: null,
      };
    }

    const outcome = outcomeAt.get(idx) ?? "absent";
    const position = outcome === "recommended" ? (idx % 3) + 1 : null;
    const answerText = buildText(profile, outcome, position ?? 2, prompt.text, idx);
    const spans = spansFor(answerText, COMPETITOR_NAMES);
    const brandMentioned = outcome === "absent" ? "no" : "yes";
    const owned = outcome !== "absent" && idx % 3 !== 1;
    const noCitations = channel.id === "ch-gemini" && idx % 7 === 0;
    const citations: ResponseCitation[] = noCitations
      ? []
      : [
          ...(owned ? [{ url: profile.ownedUrl, title: profile.product, domain: profile.ownedDomain, source: "owned" as const }] : []),
          ...(outcome === "absent" ? [profile.competitorCitation] : []),
          profile.thirdParty[idx % 3],
          ...(idx % 4 === 0 ? [profile.thirdParty[(idx + 1) % 3]] : []),
        ];
    return {
      ...base,
      searchExecuted: channel.searchMode !== "model_only" && idx % 11 !== 0,
      status: "succeeded",
      outcome,
      answerText,
      brandSpans: spans,
      brandMentioned,
      recommendation: outcome === "recommended" ? "recommended" : outcome === "mentioned" ? "merely_mentioned" : "none",
      sentiment: outcome === "recommended" ? "positive" : outcome === "mentioned" ? "mixed" : "unknown",
      confidence: outcome === "mentioned" ? 0.84 : outcome === "recommended" ? 0.93 : 0.97,
      evidenceQuote:
        outcome === "recommended" ? `For a first pair, ${profile.product} is a solid choice.` : outcome === "mentioned" ? `${profile.soldPhrase}, though reviews of its durability are mixed.` : null,
      position,
      competitors: COMPETITOR_NAMES.map((name, ci) => ({ id: `c-${ci}`, name, mentioned: answerText.includes(name) })),
      citations,
      citationSupport: channel.supportsCitations ? (citations.length ? "returned" : "none_returned") : "not_supported",
      usage: { inputTokens: 120 + (idx % 5) * 14, outputTokens: 210 + (idx % 7) * 33, searchCalls: channel.searchMode === "model_only" ? 0 : 1 + (idx % 3 === 0 ? 1 : 0) },
      completedAt: new Date(Date.parse(requested) + (9 + (idx % 6)) * 1000).toISOString(),
    };
  });

  cache.set(runId, responses);
  return responses;
}
