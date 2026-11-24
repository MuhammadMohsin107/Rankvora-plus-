/**
 * DEMONSTRATION DATA — not real.
 * Audit detail around the registry audits (src/demo/registry.ts): configuration,
 * live progress of aud-004, and the website-readiness lane for runpro.pk, runpro.ae, nutrition.example and threadly.example
 * (crawled pages, checks, AI crawler access). Read it only through src/services/audit.ts.
 *
 * Headline numbers (jobs, mention/recommendation, page coverage) come from the registry
 * and the response generator; this file only adds detail that never contradicts them.
 */
import type { AuditConfig, AuditLane, AuditStage, AuditTrigger, AuditType, AuditVerifies, CheckGroup, CrawledPage, CrawlerAccess, PageType, SimScenario, WebsiteCheck } from "@/types/audit";

export const SITE = "https://runpro.pk";

/** Approximate provider cost per planned request (matches ≈ $3.2 per 54-job run). Defined with the lane builders. */
export { APPROX_COST_PER_JOB_USD, APPROX_COST_PER_PAGE_USD } from "@/features/audit/lanes";

// ---------------------------------------------------------------------------
// Configuration per audit
// ---------------------------------------------------------------------------

const baseConfig: AuditConfig = {
  promptScope: "all_active",
  promptIds: [],
  channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"],
  samples: 2,
  market: "PK",
  language: "en",
  startPoints: ["Homepage", "Sitemap"],
  maxUrls: 150,
  maxDepth: 4,
  pageTypes: ["Home", "Collections", "Products", "Guides", "Pages"],
  excludedPaths: ["/cart", "/checkout", "/account"],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: true, pageSpeed: true, cms: true },
  limits: { maxRequests: 200, concurrency: 4, budgetUsd: 8 },
};

export const AUDIT_CONFIGS: Record<string, AuditConfig> = {
  "aud-001": { ...baseConfig, criteriaVersion: "1.4", integrations: { searchConsole: false, pageSpeed: true, cms: true } },
  "aud-002": { ...baseConfig, criteriaVersion: "2.0" },
  "aud-003": {
    ...baseConfig,
    promptScope: "ids",
    promptIds: ["p-005", "p-001"],
    samples: 1,
    startPoints: ["URL list (8 URLs)"],
    maxUrls: 10,
    maxDepth: 1,
    pageTypes: ["Home", "Collections", "Products", "Guides", "Pages"],
    limits: { maxRequests: 20, concurrency: 2, budgetUsd: 1 },
  },
  "aud-004": baseConfig,
};

// ---------------------------------------------------------------------------
// aud-004 live progress (static parts; counts agree with the registry)
// ---------------------------------------------------------------------------

export const AUD_004_STAGES: AuditStage[] = [
  { id: "validating", label: "Validating", state: "done", done: 12, total: 12, unit: "setup checks", note: "Prompts, keys, robots.txt reachable" },
  { id: "ai_requests", label: "AI requests", state: "running", done: 33, total: 54, unit: "jobs" },
  { id: "crawling", label: "Crawling", state: "running", done: 61, total: 120, unit: "pages" },
  { id: "analysis", label: "Analysis", state: "running", done: 29, total: 31, unit: "responses analysed" },
  { id: "evaluation", label: "Evaluation", state: "queued", done: 0, total: 29, unit: "checks", note: "Starts when the crawl finishes" },
  { id: "report", label: "Report", state: "queued", done: 0, total: 9, unit: "sections" },
];

export const AUD_004_WARNINGS = [
  "runpro.pk answered 429 to the crawler; it backed off to 2 concurrent requests.",
  "3 pages timed out and are queued for one retry.",
];

export const AUD_004_CURRENT_URL = `${SITE}/products/stride-trail`;

// ---------------------------------------------------------------------------
// Website lane: pages
// ---------------------------------------------------------------------------

const DEFAULT_DEPTH: Record<PageType, number> = { home: 0, collection: 1, product: 2, guide: 2, page: 1, policy: 1 };

type PageSeed = Partial<Omit<CrawledPage, "id" | "url" | "path" | "type">>;

/** What differs between stores when a crawled page is built. */
type PageProfile = {
  idPrefix: string;
  site: string;
  /** Brand name used in generated meta descriptions. */
  brand: string;
  /** Lab LCP before any per-page override. */
  lcp: (n: number) => number;
  deliveryText: string;
};

const PK_PAGE_PROFILE: PageProfile = {
  idPrefix: "pg",
  site: SITE,
  brand: "RunPro",
  lcp: (n) => 1700 + ((n * 173) % 1300),
  deliveryText: "Free delivery across Pakistan.",
};

function makePage(profile: PageProfile, n: number, path: string, type: PageType, title: string | null, seed: PageSeed = {}): CrawledPage {
  const url = `${profile.site}${path === "/" ? "/" : path}`;
  return {
    id: `${profile.idPrefix}-${String(n).padStart(2, "0")}`,
    url,
    path,
    type,
    status: 200,
    finalUrl: null,
    redirectHops: 0,
    contentType: "text/html; charset=utf-8",
    sizeKb: 84 + ((n * 13) % 120),
    depth: DEFAULT_DEPTH[type],
    rendered: false,
    publishedAt: null,
    indexable: true,
    metaRobots: "index, follow",
    xRobots: null,
    canonical: url,
    canonicalSelf: true,
    title,
    metaDescription: title ? `${title.split("|")[0].trim()} from ${profile.brand}. ${profile.deliveryText}` : null,
    h1: title ? [title.split(/[|—]/)[0].trim()] : [],
    h2: [],
    schemaTypes: ["BreadcrumbList"],
    schemaIssues: [],
    words: 320 + ((n * 47) % 500),
    inlinks: 8 + ((n * 7) % 40),
    outInternal: 24 + ((n * 5) % 30),
    outExternal: n % 4,
    brokenLinks: [],
    lab: { lcpMs: profile.lcp(n), cls: ((n * 7) % 12) / 100, tbtMs: 90 + ((n * 29) % 260) },
    field: null,
    crawledAt: "",
    ...seed,
  };
}

const pg = (n: number, path: string, type: PageType, title: string | null, seed: PageSeed = {}) => makePage(PK_PAGE_PROFILE, n, path, type, title, seed);

const MISSING_META: PageSeed = { metaDescription: null };

export const BASE_PAGES: CrawledPage[] = [
  pg(1, "/", "home", "RunPro — Running shoes made for Pakistan", {
    schemaTypes: ["Organization", "WebSite"],
    h2: ["Shop by terrain", "Bestsellers", "Why RunPro"],
    words: 640,
    inlinks: 118,
    outInternal: 46,
    field: { lcpMs: 2600, cls: 0.05, inpMs: 180 },
    lab: { lcpMs: 2100, cls: 0.04, tbtMs: 140 },
  }),
  pg(2, "/collections/road", "collection", "Road running shoes | RunPro", { brokenLinks: ["/products/glide-1-legacy"], schemaTypes: ["BreadcrumbList", "ItemList"], h2: ["Filter", "Best for beginners"] }),
  pg(3, "/collections/trail", "collection", "Trail running shoes | RunPro", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(4, "/collections/everyday", "collection", "Everyday running shoes | RunPro", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(5, "/collections/sale", "collection", "Sale — running shoes | RunPro", { brokenLinks: ["/products/velocity-x"], lab: { lcpMs: 2900, cls: 0.06, tbtMs: 240 }, schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(6, "/collections/new-arrivals", "collection", "New arrivals | RunPro", { ...MISSING_META, schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(7, "/collections/men", "collection", "Men's running shoes | RunPro", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(8, "/collections/women", "collection", "Women's running shoes | RunPro", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pg(9, "/products/glide-2", "product", "RunPro Glide 2 — Road running shoe", {
    schemaTypes: ["Product", "Offer", "BreadcrumbList"],
    schemaIssues: ["Offer price 13500 differs from the visible price PKR 12,900"],
    h2: ["Sizes", "Delivery"],
    words: 210,
    lab: { lcpMs: 2900, cls: 0.03, tbtMs: 210 },
    metaDescription: "RunPro Glide 2 road running shoe. PKR 12,900, free delivery across Pakistan.",
  }),
  pg(10, "/products/stride-trail", "product", "RunPro Stride Trail — Trail running shoe", { schemaTypes: ["Product", "Offer", "BreadcrumbList"], h2: ["Grip and outsole", "Sizes"] }),
  pg(11, "/products/daily-trainer", "product", "RunPro Daily Trainer — Everyday running shoe", { schemaTypes: ["Product", "Offer", "BreadcrumbList"], h2: ["Cushioning", "Sizes"] }),
  pg(12, "/products/marathon-elite", "product", "RunPro Marathon Elite — Long-distance running shoe", { schemaTypes: ["Product", "Offer", "BreadcrumbList"], h2: ["Built for distance", "Sizes"], lab: { lcpMs: 2700, cls: 0.02, tbtMs: 190 } }),
  pg(13, "/products/flat-foot-support", "product", "RunPro Arch Support — Running shoe for flat feet", { schemaTypes: ["Product", "Offer", "BreadcrumbList"], h2: ["Arch support", "Sizes"] }),
  pg(14, "/products/aero-sprint", "product", "RunPro Aero Sprint — Lightweight racing shoe", { schemaTypes: ["Product", "Offer", "BreadcrumbList"] }),
  pg(15, "/products/cushion-max", "product", "RunPro Cushion Max — Maximum cushioning shoe", { ...MISSING_META, schemaTypes: ["Product", "Offer", "BreadcrumbList"] }),
  pg(16, "/products/glide-1-legacy", "product", null, { status: 404, indexable: false, metaRobots: null, canonical: null, canonicalSelf: false, schemaTypes: [], words: 0, lab: null, publishedAt: "2026-10-01T00:00:00Z", inlinks: 1 }),
  pg(17, "/products/velocity-x", "product", null, { status: 404, indexable: false, metaRobots: null, canonical: null, canonicalSelf: false, schemaTypes: [], words: 0, lab: null, publishedAt: "2026-10-01T00:00:00Z", inlinks: 1 }),
  pg(18, "/products/glide-1", "product", null, { status: 301, finalUrl: `${SITE}/products/glide-2`, redirectHops: 1, indexable: false, metaRobots: null, canonical: null, canonicalSelf: false, schemaTypes: [], words: 0, lab: null, publishedAt: "2026-10-01T00:00:00Z" }),
  pg(19, "/blogs/guides", "guide", "Running guides | RunPro Journal", { lab: { lcpMs: 3100, cls: 0.08, tbtMs: 260 }, schemaTypes: ["Blog", "BreadcrumbList"], h2: ["Latest guides"] }),
  pg(20, "/blogs/guides/how-to-choose-a-running-shoe", "guide", "How to choose a running shoe as a beginner | RunPro Journal", { publishedAt: "2026-11-15T07:00:00Z", schemaTypes: ["Article", "BreadcrumbList"], h2: ["Know your terrain", "Fit and sizing", "Cushioning", "What to avoid"], words: 1180 }),
  pg(21, "/blogs/guides/marathon-training-plan", "guide", "A 16-week marathon training plan | RunPro Journal", { schemaTypes: ["Article", "BreadcrumbList"], words: 1420 }),
  pg(22, "/blogs/guides/running-shoe-care", "guide", "How to care for your running shoes | RunPro Journal", { schemaTypes: ["Article", "BreadcrumbList"], words: 760 }),
  pg(23, "/pages/about", "page", "About RunPro", { schemaTypes: ["AboutPage", "BreadcrumbList"], words: 520 }),
  pg(24, "/pages/contact", "page", "Contact RunPro", { schemaTypes: ["ContactPage", "BreadcrumbList"] }),
  pg(25, "/pages/store-locator", "page", "Find a RunPro store in Lahore, Karachi and Islamabad", { schemaTypes: ["LocalBusiness", "BreadcrumbList"] }),
  pg(26, "/pages/size-guide", "page", "Running shoe size guide | RunPro", { ...MISSING_META }),
  pg(27, "/pages/faq", "page", "Frequently asked questions | RunPro", { ...MISSING_META, schemaTypes: ["FAQPage", "BreadcrumbList"] }),
  pg(28, "/policies/shipping-policy", "policy", "Shipping policy | RunPro"),
  pg(29, "/policies/refund-policy", "policy", "Refund policy | RunPro"),
  pg(30, "/policies/privacy-policy", "policy", "Privacy policy | RunPro"),
];

// ---------------------------------------------------------------------------
// Website lane: checks (state as of aud-002; other audits override)
// ---------------------------------------------------------------------------

type CheckSeed = {
  affected?: number | null;
  paths?: string[];
  findingId?: string;
};

function ck(id: string, group: CheckGroup, name: string, status: WebsiteCheck["status"], label: string, snippet: string, seed: CheckSeed = {}): WebsiteCheck {
  return {
    id,
    group,
    kind: group === "content_entity" ? "content" : "technical",
    name,
    status,
    affected: seed.affected === undefined ? null : seed.affected,
    affectedPaths: seed.paths ?? [],
    evidence: { label, snippet },
    findingId: seed.findingId ?? null,
  };
}

export const BASE_CHECKS: WebsiteCheck[] = [
  ck("chk-01", "reachability", "Homepage responds with 200", "pass", "Request", "GET https://runpro.pk/  →  200 OK · 412 ms"),
  ck("chk-02", "reachability", "No server errors (5xx) on assessed pages", "pass", "Crawl result", "0 of 112 assessed pages returned a 5xx status", { affected: 0 }),
  ck("chk-03", "indexing", "robots.txt is reachable and parseable", "pass", "Request", "GET https://runpro.pk/robots.txt  →  200 OK · text/plain · 18 lines"),
  ck("chk-04", "indexing", "No unintended noindex on key pages", "pass", "Crawl result", "noindex found only on /cart and /checkout (excluded paths)", { affected: 0 }),
  ck("chk-05", "indexing", "AI crawler rules reviewed per user-agent", "warning", "robots.txt", "User-agent: OAI-SearchBot\nDisallow: /", { findingId: "fnd-006" }),
  ck("chk-06", "indexing", "Search Console indexing coverage", "error", "Search Console API", "429 Too Many Requests after 3 attempts. Indexing coverage was not assessed."),
  ck("chk-07", "canonical", "Indexable pages declare a self-referencing canonical", "pass", "Crawl result", "112 of 112 assessed indexable pages carry rel=canonical to themselves", { affected: 0 }),
  ck("chk-08", "canonical", "Canonical targets return 200", "pass", "Crawl result", "All canonical targets resolved with status 200", { affected: 0 }),
  ck("chk-09", "sitemaps", "Sitemap is declared in robots.txt", "pass", "robots.txt", "Sitemap: https://runpro.pk/sitemap.xml"),
  ck("chk-10", "sitemaps", "Sitemap URLs return 200 and are indexable", "warning", "Sitemap audit", "3 of 120 sitemap URLs return 404 or 301:\n/products/glide-1-legacy  404\n/products/velocity-x  404\n/products/glide-1  301", {
    affected: 3,
    paths: ["/products/glide-1-legacy", "/products/velocity-x", "/products/glide-1"],
  }),
  ck("chk-11", "linking", "Internal links resolve (no 404)", "fail", "Link extraction", '<a href="/products/glide-1-legacy">  →  404\n<a href="/products/velocity-x">  →  404', {
    affected: 2,
    paths: ["/collections/road", "/collections/sale"],
    findingId: "fnd-003",
  }),
  ck("chk-12", "rendering", "Core content is present in raw HTML", "pass", "Raw vs rendered", "Title, H1, price and description present before JavaScript runs", { affected: 0 }),
  ck("chk-13", "rendering", "Rendered and raw HTML match", "inconclusive", "Renderer", "Renderer timed out on 3 of 12 sampled product pages, so parity is not determinate."),
  ck("chk-14", "url_quality", "Clean URLs without session or tracking parameters", "pass", "Crawl result", "0 of 120 in-scope URLs contain session or tracking parameters", { affected: 0 }),
  ck("chk-15", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "Single-market site (PK). runpro.ae is audited as its own website."),
  ck("chk-16", "url_quality", "Faceted and parameter URLs are controlled", "not_assessed", "Scope", "Parameter URLs (/*?filter=) were outside the crawl scope."),
  ck("chk-17", "metadata", "Each indexable page has a unique title", "pass", "Crawl result", "Collection titles differ only by pagination suffix (reviewed: intended behaviour)", { affected: 0 }),
  ck("chk-18", "metadata", "Meta description present (up to 160 characters)", "warning", "Crawl result", "9 of 112 assessed pages have no meta description", {
    affected: 9,
    paths: ["/collections/new-arrivals", "/products/cushion-max", "/pages/size-guide", "/pages/faq"],
  }),
  ck("chk-19", "mobile_a11y", "Images have alternative text", "warning", "Crawl result", '11 of 112 assessed pages contain <img> elements without alt text', { affected: 11, paths: ["/collections/new-arrivals", "/collections/sale", "/products/cushion-max"] }),
  ck("chk-20", "mobile_a11y", "Largest Contentful Paint up to 2.5 s (lab, mobile)", "warning", "PageSpeed lab data", "Lab LCP above 2.5 s (simulated mobile):\n/blogs/guides  3.1 s\n/collections/sale  2.9 s\n/products/glide-2  2.9 s\n/products/marathon-elite  2.7 s", {
    affected: 4,
    paths: ["/blogs/guides", "/collections/sale", "/products/glide-2", "/products/marathon-elite"],
    findingId: "fnd-011",
  }),
  ck("chk-21", "mobile_a11y", "Field performance (CrUX)", "inconclusive", "CrUX", "Field data exists for the origin only. 111 of 112 URLs have no field data."),
  ck("chk-22", "structured_data", "Organization schema includes sameAs and contactPoint", "fail", "JSON-LD", '{ "@type": "Organization", "name": "RunPro" }\n// sameAs and contactPoint are missing', { affected: 1, paths: ["/"], findingId: "fnd-008" }),
  ck("chk-23", "structured_data", "Product price in JSON-LD matches the visible price", "fail", "JSON-LD vs page", 'offers.price = "13500"\nVisible price: PKR 12,900', { affected: 1, paths: ["/products/glide-2"], findingId: "fnd-002" }),
  ck("chk-24", "structured_data", "BreadcrumbList on collection and product pages", "pass", "JSON-LD", "BreadcrumbList found on 86 of 86 collection and product pages", { affected: 0 }),
  ck("chk-25", "content_entity", "Brand name is spelled consistently", "pass", "Text scan", 'Official spelling "RunPro" on all 6 core pages', { affected: 0 }),
  ck("chk-26", "content_entity", "Product pages state key attributes (surface, cushioning, weight)", "fail", "Page content", "Glide 2: price and sizes present; surface suitability, cushioning level and weight missing (3 of 5 attributes)", {
    affected: 1,
    paths: ["/products/glide-2"],
    findingId: "fnd-001",
  }),
  ck("chk-27", "content_entity", "An indexable page answers the beginner buying question", "fail", "Topic coverage", 'No indexed page covers "how to choose a running shoe"', { findingId: "fnd-007" }),
  ck("chk-28", "content_entity", "Local store details with address are published", "pass", "Page content", "/pages/store-locator lists stores in Lahore, Karachi and Islamabad with addresses", { affected: 0 }),
  ck("chk-29", "content_entity", "Delivery and returns policies are discoverable", "pass", "Page content", "/policies/shipping-policy and /policies/refund-policy linked from the footer on all pages", { affected: 0 }),
];

type CheckOverride = Partial<Pick<WebsiteCheck, "status" | "affected" | "affectedPaths" | "findingId">> & { snippet?: string; label?: string };

export type WebsiteVariant = {
  coverage: { inScope: number; assessed: number; excluded: number; blocked: number; unvisited: number };
  pageIds: string[] | "all";
  checkIds: string[] | "all";
  overrides: Record<string, CheckOverride>;
  /** Only these groups have been evaluated; the others are "not assessed" (audit still running). */
  evaluatedGroups?: CheckGroup[];
  crawlerOverrides: Record<string, Partial<CrawlerAccess>>;
  /** Page facts that differ from the base crawl at the time of this audit, keyed by page id (e.g. a fix made between audits). */
  pageOverrides?: Record<string, Partial<CrawledPage>>;
  notice: string | null;
};

export const WEBSITE_VARIANTS: Record<string, WebsiteVariant> = {
  "aud-001": {
    coverage: { inScope: 120, assessed: 103, excluded: 8, blocked: 4, unvisited: 13 },
    pageIds: "all",
    checkIds: "all",
    evaluatedGroups: undefined,
    overrides: {
      "chk-05": { status: "pass", snippet: "No rule for OAI-SearchBot; default group applies (Allow: /)", findingId: null },
      "chk-06": { status: "blocked", snippet: "Search Console property was not verified at audit time. Indexing coverage not assessed." },
      "chk-11": { status: "pass", affected: 0, affectedPaths: [], snippet: "0 internal links returned 404", findingId: null },
      "chk-10": { status: "pass", affected: 0, affectedPaths: [], snippet: "0 of 118 sitemap URLs return a non-200 status" },
      "chk-20": { affected: 5, snippet: "Lab LCP above 2.5 s (simulated mobile) on 5 pages" },
      "chk-23": { status: "pass", affected: 0, affectedPaths: [], snippet: 'offers.price = "12900" matches the visible price', findingId: null },
      "chk-26": { status: "pass", affected: 0, affectedPaths: [], snippet: "Glide 2: surface, cushioning and weight stated", findingId: null },
      "chk-27": { snippet: 'No indexed page covers "how to choose a running shoe"' },
    },
    crawlerOverrides: {
      "oai-searchbot": { allowed: true, rule: "(no OAI-SearchBot group)\nUser-agent: *\nAllow: /", consequence: "Covered by the default rule. Pages can be crawled for ChatGPT search.", findingId: null },
    },
    notice: null,
  },
  "aud-002": {
    coverage: { inScope: 120, assessed: 112, excluded: 8, blocked: 3, unvisited: 5 },
    pageIds: "all",
    checkIds: "all",
    overrides: {},
    crawlerOverrides: {},
    notice: null,
  },
  "aud-003": {
    coverage: { inScope: 8, assessed: 8, excluded: 0, blocked: 0, unvisited: 0 },
    pageIds: ["pg-01", "pg-09", "pg-12", "pg-02", "pg-23", "pg-19", "pg-18", "pg-27"],
    checkIds: ["chk-01", "chk-07", "chk-18", "chk-20", "chk-22", "chk-23", "chk-25", "chk-26", "chk-27"],
    overrides: {
      "chk-22": { status: "pass", affected: 0, affectedPaths: [], snippet: '{ "@type": "Organization", "sameAs": [3 profiles], "contactPoint": [1] }', findingId: null },
      "chk-25": { status: "warning", affected: 2, affectedPaths: ["/", "/pages/about"], snippet: '"Run Pro" found on /pages/about and in the footer of /. Official spelling: "RunPro".', findingId: "fnd-005" },
      "chk-18": { affected: 1, affectedPaths: ["/pages/faq"], snippet: "1 of 8 assessed pages has no meta description" },
      "chk-20": { affected: 3, affectedPaths: ["/blogs/guides", "/products/glide-2", "/products/marathon-elite"], snippet: "Lab LCP above 2.5 s (simulated mobile):\n/blogs/guides  3.1 s\n/products/glide-2  2.9 s\n/products/marathon-elite  2.7 s" },
      "chk-07": { snippet: "8 of 8 assessed indexable pages carry a self-referencing canonical" },
    },
    crawlerOverrides: {},
    notice: "Scoped to 8 URLs and 9 of 29 checks. Not comparable with a full audit.",
  },
  "aud-004": {
    coverage: { inScope: 120, assessed: 61, excluded: 8, blocked: 1, unvisited: 58 },
    pageIds: ["pg-01", "pg-02", "pg-03", "pg-04", "pg-05", "pg-06", "pg-07", "pg-08", "pg-09", "pg-10", "pg-11", "pg-12", "pg-13", "pg-14", "pg-15", "pg-19", "pg-23", "pg-27"],
    checkIds: "all",
    evaluatedGroups: ["reachability", "indexing", "sitemaps"],
    overrides: {
      "chk-06": { status: "pass", snippet: "Search Console property verified. Coverage report fetched for 120 URLs." },
    },
    crawlerOverrides: {},
    notice: "Crawl in progress. Only reachability, indexing and sitemap checks have run.",
  },
};

// ---------------------------------------------------------------------------
// AI crawler access (reported separately per crawler, never merged)
// ---------------------------------------------------------------------------

export const BASE_CRAWLERS: CrawlerAccess[] = [
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    purpose: "ChatGPT search",
    allowed: false,
    rule: "User-agent: OAI-SearchBot\nDisallow: /",
    consequence: "This crawler cannot fetch any page, so pages may not be eligible for ChatGPT search results.",
    findingId: "fnd-006",
  },
  {
    id: "gptbot",
    name: "GPTBot",
    purpose: "Model training",
    allowed: true,
    rule: "(no GPTBot group)\nUser-agent: *\nDisallow: /cart\nDisallow: /checkout\nAllow: /",
    consequence: "Covered by the default rule, except /cart and /checkout. Training access is separate from ChatGPT search.",
    findingId: null,
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    purpose: "User-requested visits",
    allowed: true,
    rule: "(no ChatGPT-User group)\nUser-agent: *\nDisallow: /cart\nDisallow: /checkout\nAllow: /",
    consequence: "Covered by the default rule. A ChatGPT user can have a page fetched on request.",
    findingId: null,
  },
];

// ===========================================================================
// runpro-ae (WooCommerce, https://runpro.ae)
// Audits aud-ae-001 (initial, 16 Sep), aud-ae-002 (full, 5 Nov) and aud-ae-003 (focused,
// AI lane only, 14 Nov). Headline numbers agree with REGISTRY_AE_AUDITS and findings
// fnd-ae-001 … fnd-ae-006 (src/demo/shared-records.ts).
// ===========================================================================

export const AE_SITE = "https://runpro.ae";

const aeBaseConfig: AuditConfig = {
  promptScope: "all_active",
  promptIds: [],
  channelIds: ["ch-openai", "ch-gemini"],
  samples: 3,
  market: "AE",
  language: "en",
  startPoints: ["Homepage", "Sitemap"],
  maxUrls: 100,
  maxDepth: 4,
  pageTypes: ["Home", "Collections", "Products", "Guides", "Pages"],
  excludedPaths: ["/cart", "/checkout", "/my-account", "/wp-admin", "/wc-ajax"],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: false, pageSpeed: true, cms: true },
  limits: { maxRequests: 100, concurrency: 4, budgetUsd: 4 },
};

export const AE_AUDIT_CONFIGS: Record<string, AuditConfig> = {
  "aud-ae-001": { ...aeBaseConfig, criteriaVersion: "1.4" },
  "aud-ae-002": aeBaseConfig,
  // Focused, AI lane only: 2 prompts × 2 channels × 3 samples = 12 requests. No website settings apply.
  "aud-ae-003": {
    ...aeBaseConfig,
    promptScope: "ids",
    promptIds: ["p-ae-002", "p-ae-005"],
    startPoints: [],
    maxUrls: 0,
    maxDepth: 0,
    pageTypes: [],
    excludedPaths: [],
    integrations: { searchConsole: false, pageSpeed: false, cms: false },
    limits: { maxRequests: 24, concurrency: 2, budgetUsd: 1.5 },
  },
};

// ---------------------------------------------------------------------------
// Website lane: pages
// ---------------------------------------------------------------------------

const AE_PAGE_PROFILE: PageProfile = {
  idPrefix: "pg-ae",
  site: AE_SITE,
  brand: "RunPro",
  lcp: (n) => 1600 + ((n * 137) % 800),
  deliveryText: "Delivery across the UAE.",
};

const pa = (n: number, path: string, type: PageType, title: string | null, seed: PageSeed = {}) => makePage(AE_PAGE_PROFILE, n, path, type, title, seed);

/** A sitemap URL that answers 301 to the Pakistan store (audit aud-ae-001 only). */
const paRedirect = (n: number, path: string, type: PageType): CrawledPage =>
  pa(n, path, type, null, {
    status: 301,
    finalUrl: `https://runpro.pk${path}`,
    redirectHops: 1,
    indexable: false,
    metaRobots: null,
    canonical: null,
    canonicalSelf: false,
    schemaTypes: [],
    words: 0,
    lab: null,
    sizeKb: 1,
    depth: 1,
  });

const AE_NO_META: PageSeed = { metaDescription: null };
const AE_SLOW = (lcpMs: number): PageSeed => ({ lab: { lcpMs, cls: 0.08, tbtMs: 240 } });

export const AE_BASE_PAGES: CrawledPage[] = [
  pa(1, "/", "home", "RunPro UAE — Running shoes delivered across the UAE", {
    schemaTypes: ["Organization", "WebSite", "WebPage"],
    h2: ["Shop by terrain", "Bestsellers", "Delivery across the UAE"],
    words: 610,
    inlinks: 96,
    outInternal: 42,
  }),
  pa(2, "/shop", "collection", "Shop running shoes | RunPro UAE", { schemaTypes: ["BreadcrumbList", "ItemList"], h2: ["Filter by terrain", "All shoes"] }),
  pa(3, "/product-category/road", "collection", "Road running shoes | RunPro UAE", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(4, "/product-category/trail", "collection", "Trail running shoes | RunPro UAE", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(5, "/product-category/everyday", "collection", "Everyday running shoes | RunPro UAE", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(6, "/product-category/sale", "collection", "Sale — running shoes | RunPro UAE", { ...AE_SLOW(2900), schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(7, "/product-category/men", "collection", "Men's running shoes | RunPro UAE", { schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(8, "/product-category/women", "collection", "Women's running shoes | RunPro UAE", { ...AE_NO_META, schemaTypes: ["BreadcrumbList", "ItemList"] }),
  pa(9, "/product/glide-2", "product", "RunPro Glide 2 — Road running shoe | RunPro UAE", {
    // No Product node; a standalone Offer fragment from an old currency plugin reports USD.
    schemaTypes: ["BreadcrumbList", "Offer"],
    schemaIssues: ["No Product JSON-LD", "Standalone Offer fragment: priceCurrency USD, price 349. Visible price is AED 1,280"],
    h2: ["Description", "Additional information", "Reviews"],
    words: 240,
    ...AE_SLOW(2900),
    metaDescription: "RunPro Glide 2 road running shoe. AED 1,280, delivery across the UAE.",
  }),
  pa(10, "/product/daily-trainer", "product", "RunPro Daily Trainer — Everyday running shoe | RunPro UAE", {
    schemaTypes: ["BreadcrumbList"],
    schemaIssues: ["No Product JSON-LD"],
    h2: ["Description", "Additional information", "Reviews"],
    words: 230,
  }),
  pa(11, "/product/marathon-elite", "product", "RunPro Marathon Elite — Long-distance running shoe | RunPro UAE", {
    schemaTypes: ["BreadcrumbList"],
    schemaIssues: ["No Product JSON-LD"],
    h2: ["Description", "Delivery and returns", "Reviews"],
    words: 310,
    ...AE_SLOW(2700),
  }),
  pa(12, "/blog", "guide", "RunPro Journal — running guides for the UAE", { ...AE_SLOW(3100), schemaTypes: ["Blog", "BreadcrumbList"], h2: ["Latest guides"] }),
  pa(13, "/blog/best-time-to-run-in-dubai", "guide", "Best time of day to run in Dubai | RunPro Journal", {
    publishedAt: "2026-10-08T07:00:00Z",
    schemaTypes: ["Article", "BreadcrumbList"],
    h2: ["Early morning", "Evening", "Heat and hydration", "Treadmill days"],
    words: 980,
  }),
  pa(14, "/blog/choosing-running-shoes-uae", "guide", "How to choose running shoes in the UAE | RunPro Journal", { schemaTypes: ["Article", "BreadcrumbList"], h2: ["Know your terrain", "Fit and sizing", "Cushioning"], words: 1120 }),
  pa(15, "/blog/marathon-training-abu-dhabi", "guide", "Marathon training in Abu Dhabi: a 16-week plan | RunPro Journal", { schemaTypes: ["Article", "BreadcrumbList"], words: 1380 }),
  pa(16, "/about-us", "page", "About RunPro UAE", { schemaTypes: ["AboutPage", "BreadcrumbList"], words: 480 }),
  pa(17, "/contact", "page", "Contact RunPro UAE", { schemaTypes: ["ContactPage", "BreadcrumbList"] }),
  pa(18, "/delivery-and-returns", "policy", "Delivery and returns in the UAE | RunPro UAE", { words: 540 }),
  pa(19, "/size-guide", "page", "Running shoe size guide | RunPro UAE", { ...AE_NO_META }),
  pa(20, "/faq", "page", "Frequently asked questions | RunPro UAE", { ...AE_NO_META, schemaTypes: ["FAQPage", "BreadcrumbList"] }),
  pa(21, "/privacy-policy", "policy", "Privacy policy | RunPro UAE"),
  pa(22, "/terms-and-conditions", "policy", "Terms and conditions | RunPro UAE"),
  pa(23, "/product-category/new-arrivals", "collection", "New arrivals | RunPro UAE", { publishedAt: "2026-10-20T07:00:00Z", schemaTypes: ["BreadcrumbList", "ItemList"] }),
  // Sitemap URLs copied from the Pakistan store; they redirect to runpro.pk (aud-ae-001 only).
  paRedirect(24, "/products/glide-2", "product"),
  paRedirect(25, "/products/stride-trail", "product"),
  paRedirect(26, "/products/daily-trainer", "product"),
  paRedirect(27, "/products/marathon-elite", "product"),
  paRedirect(28, "/products/flat-foot-support", "product"),
  paRedirect(29, "/products/aero-sprint", "product"),
  paRedirect(30, "/products/cushion-max", "product"),
  paRedirect(31, "/collections/road", "collection"),
  paRedirect(32, "/collections/trail", "collection"),
];

const AE_REDIRECT_PATHS = AE_BASE_PAGES.filter((p) => p.status === 301).map((p) => p.path);
const AE_PRODUCT_PATHS = ["/product/glide-2", "/product/daily-trainer", "/product/marathon-elite"];
const AE_SLOW_PATHS = ["/blog", "/product-category/sale", "/product/glide-2", "/product/marathon-elite"];
const AE_NO_META_PATHS = ["/product-category/women", "/size-guide", "/faq"];
const AE_NO_ALT_PATHS = ["/product-category/sale", "/product-category/women", "/product/marathon-elite"];

// ---------------------------------------------------------------------------
// Website lane: checks (state as of aud-ae-002; aud-ae-001 overrides)
// ---------------------------------------------------------------------------

const AE_ROBOTS = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nDisallow: /cart/\nDisallow: /checkout/\nDisallow: /my-account/";

export const AE_BASE_CHECKS: WebsiteCheck[] = [
  ck("chk-ae-01", "reachability", "Homepage responds with 200", "pass", "Request", "GET https://runpro.ae/  →  200 OK · 538 ms"),
  ck("chk-ae-02", "indexing", "robots.txt is reachable and parseable", "pass", "Request", "GET https://runpro.ae/robots.txt  →  200 OK · text/plain · 11 lines"),
  ck("chk-ae-03", "indexing", "AI crawler rules reviewed per user-agent", "pass", "robots.txt", "OAI-SearchBot and ChatGPT-User: default group applies (allowed).\nGPTBot: Disallow: /  (model training only, separate from ChatGPT search)."),
  ck("chk-ae-04", "indexing", "Search Console indexing coverage", "not_assessed", "Scope", "Search Console is not connected for runpro.ae. Indexing coverage was not assessed."),
  ck("chk-ae-05", "canonical", "Indexable pages declare a self-referencing canonical", "pass", "Crawl result", "58 of 58 assessed indexable pages carry rel=canonical to themselves", { affected: 0 }),
  ck("chk-ae-06", "sitemaps", "Sitemap is declared in robots.txt", "pass", "robots.txt", "Sitemap: https://runpro.ae/sitemap.xml"),
  ck("chk-ae-07", "sitemaps", "Sitemap URLs return 200 and are indexable", "pass", "Sitemap audit", "0 of 55 sitemap URLs return a non-200 status. The 9 redirecting URLs from the September audit are no longer listed.", {
    affected: 0,
    findingId: "fnd-ae-005",
  }),
  ck("chk-ae-08", "linking", "Internal links resolve to final URLs (no 404 or redirect)", "pass", "Link extraction", "0 internal links return 404 or redirect on 58 assessed pages", { affected: 0 }),
  ck("chk-ae-09", "rendering", "Core content is present in raw HTML", "pass", "Raw vs rendered", "Title, H1, price and description present before JavaScript runs on 8 of 8 sampled product and category pages", { affected: 0 }),
  ck("chk-ae-10", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "No other language versions of runpro.ae exist. runpro.pk is audited as its own website."),
  ck("chk-ae-11", "url_quality", "Clean URLs without session or tracking parameters", "pass", "Crawl result", "0 of 60 in-scope URLs contain session or tracking parameters", { affected: 0 }),
  ck("chk-ae-12", "metadata", "Each indexable page has a unique title", "pass", "Crawl result", "58 of 58 assessed titles are unique", { affected: 0 }),
  ck("chk-ae-13", "metadata", "Meta description present (up to 160 characters)", "warning", "Crawl result", "6 of 58 assessed pages have no meta description", { affected: 6, paths: AE_NO_META_PATHS }),
  ck("chk-ae-14", "mobile_a11y", "Images have alternative text", "warning", "Crawl result", "7 of 58 assessed pages contain <img> elements without alt text", { affected: 7, paths: AE_NO_ALT_PATHS }),
  ck("chk-ae-15", "mobile_a11y", "Largest Contentful Paint up to 2.5 s (lab, mobile)", "warning", "PageSpeed lab data", "Lab LCP above 2.5 s (simulated mobile) on 4 pages:\n/blog  3.1 s\n/product-category/sale  2.9 s\n/product/glide-2  2.9 s\n/product/marathon-elite  2.7 s", {
    affected: 4,
    paths: AE_SLOW_PATHS,
  }),
  ck("chk-ae-16", "mobile_a11y", "Field performance (CrUX)", "inconclusive", "CrUX", "Origin-level field data exists. 58 of 58 assessed URLs have no URL-level field data."),
  ck("chk-ae-17", "structured_data", "Product and Offer structured data on product pages", "fail", "JSON-LD", "No Product node found in JSON-LD on 3 of 3 sampled product pages.\nTypes present: BreadcrumbList (WooCommerce breadcrumb markup).", {
    affected: 3,
    paths: AE_PRODUCT_PATHS,
    findingId: "fnd-ae-001",
  }),
  ck("chk-ae-18", "structured_data", "Currency in JSON-LD matches the visible currency", "fail", "JSON-LD vs page", '{ "@type": "Offer", "price": "349", "priceCurrency": "USD" }\n// standalone Offer fragment, not attached to a Product\nVisible price: AED 1,280', {
    affected: 1,
    paths: ["/product/glide-2"],
    findingId: "fnd-ae-002",
  }),
  ck("chk-ae-19", "structured_data", "Organization schema includes sameAs and contactPoint", "pass", "JSON-LD", '{ "@type": "Organization", "name": "RunPro", "sameAs": [3 profiles], "contactPoint": [1] }', { affected: 0 }),
  ck("chk-ae-20", "content_entity", "Product pages state UAE delivery area, delivery time and returns", "warning", "Page content", "4 sampled product pages:\n/product/glide-2  footer shipping line only; returns on /delivery-and-returns\n/product/daily-trainer  footer shipping line only; returns on /delivery-and-returns\n/product/marathon-elite  UAE delivery and returns stated\n/product/stride-trail  UAE delivery and returns stated", {
    affected: 2,
    paths: ["/product/glide-2", "/product/daily-trainer"],
    findingId: "fnd-ae-003",
  }),
  ck("chk-ae-21", "content_entity", "Product pages state key attributes (surface, cushioning, weight)", "pass", "Page content", "Glide 2, Daily Trainer and Marathon Elite: surface suitability, cushioning level and weight stated", { affected: 0 }),
  ck("chk-ae-22", "content_entity", "Brand name is spelled consistently", "pass", "Text scan", 'Official spelling "RunPro" on all 6 core pages', { affected: 0 }),
  ck("chk-ae-23", "content_entity", "An indexable page covers hot-weather running", "warning", "Topic coverage", 'No dedicated page covers "running shoes for hot weather". /blog/best-time-to-run-in-dubai mentions heat in 1 of 4 sections.'),
  ck("chk-ae-24", "content_entity", "Delivery and returns policy pages are discoverable", "pass", "Page content", "/delivery-and-returns is linked from the footer on all 58 assessed pages", { affected: 0 }),
];

const AE_REDIRECT_LINES = AE_REDIRECT_PATHS.slice(0, 4)
  .map((p) => `${p}  →  301 https://runpro.pk${p}`)
  .join("\n");

export const AE_WEBSITE_VARIANTS: Record<string, WebsiteVariant> = {
  "aud-ae-001": {
    coverage: { inScope: 60, assessed: 41, excluded: 6, blocked: 4, unvisited: 15 },
    pageIds: [
      "pg-ae-01", "pg-ae-02", "pg-ae-03", "pg-ae-04", "pg-ae-05", "pg-ae-06", "pg-ae-07", "pg-ae-08", "pg-ae-09", "pg-ae-10", "pg-ae-11", "pg-ae-12",
      "pg-ae-14", "pg-ae-15", "pg-ae-16", "pg-ae-17", "pg-ae-18", "pg-ae-19", "pg-ae-20", "pg-ae-21", "pg-ae-22",
      "pg-ae-24", "pg-ae-25", "pg-ae-26", "pg-ae-27", "pg-ae-28", "pg-ae-29", "pg-ae-30", "pg-ae-31", "pg-ae-32",
    ],
    // Criteria 1.4 has no product-page delivery check.
    checkIds: AE_BASE_CHECKS.filter((c) => c.id !== "chk-ae-20").map((c) => c.id),
    overrides: {
      "chk-ae-05": { snippet: "32 of 32 assessed indexable pages carry rel=canonical to themselves" },
      "chk-ae-07": {
        status: "warning",
        affected: 9,
        affectedPaths: AE_REDIRECT_PATHS,
        findingId: "fnd-ae-005",
        snippet: `9 of 64 sitemap URLs answer 301 to the Pakistan website (runpro.pk):\n${AE_REDIRECT_LINES}\n… and 5 more`,
      },
      "chk-ae-08": {
        status: "warning",
        affected: 3,
        affectedPaths: ["/", "/blog", "/about-us"],
        findingId: null,
        snippet: '<a href="/collections/road">  →  301 https://runpro.pk/collections/road\nFound on /, /blog and /about-us',
      },
      "chk-ae-12": { snippet: "32 of 32 assessed indexable titles are unique" },
      "chk-ae-13": { affected: 11, snippet: "11 of 41 assessed pages have no meta description" },
      "chk-ae-14": { affected: 9, snippet: "9 of 41 assessed pages contain <img> elements without alt text" },
      "chk-ae-15": {
        affected: 6,
        snippet: "Lab LCP above 2.5 s (simulated mobile) on 6 pages. Slowest four:\n/blog  3.1 s\n/product-category/sale  2.9 s\n/product/glide-2  2.9 s\n/product/marathon-elite  2.7 s",
      },
      "chk-ae-16": { snippet: "Origin-level field data exists. 41 of 41 assessed URLs have no URL-level field data." },
      "chk-ae-23": { snippet: 'No indexed page covers "running shoes for hot weather".' },
      "chk-ae-24": { snippet: "/delivery-and-returns is linked from the footer on all 41 assessed pages" },
    },
    crawlerOverrides: {},
    notice: "Criteria 1.4: the product-page delivery and returns check did not exist yet. It first runs in the November audit.",
  },
  "aud-ae-002": {
    coverage: { inScope: 60, assessed: 58, excluded: 6, blocked: 0, unvisited: 2 },
    pageIds: [
      "pg-ae-01", "pg-ae-02", "pg-ae-03", "pg-ae-04", "pg-ae-05", "pg-ae-06", "pg-ae-07", "pg-ae-08", "pg-ae-09", "pg-ae-10", "pg-ae-11", "pg-ae-12",
      "pg-ae-13", "pg-ae-14", "pg-ae-15", "pg-ae-16", "pg-ae-17", "pg-ae-18", "pg-ae-19", "pg-ae-20", "pg-ae-21", "pg-ae-22", "pg-ae-23",
    ],
    checkIds: "all",
    overrides: {},
    crawlerOverrides: {},
    notice: null,
  },
};

// ---------------------------------------------------------------------------
// AI crawler access (reported separately per crawler, never merged)
// ---------------------------------------------------------------------------

export const AE_BASE_CRAWLERS: CrawlerAccess[] = [
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    purpose: "ChatGPT search",
    allowed: true,
    rule: `(no OAI-SearchBot group)\n${AE_ROBOTS}`,
    consequence: "Covered by the default rule, except /cart, /checkout, /my-account and /wp-admin. Pages can be crawled for ChatGPT search.",
    findingId: null,
  },
  {
    id: "gptbot",
    name: "GPTBot",
    purpose: "Model training",
    allowed: false,
    rule: "User-agent: GPTBot\nDisallow: /",
    consequence: "This crawler cannot fetch any page. It affects model training only; ChatGPT search and user-requested visits have their own rules.",
    findingId: null,
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    purpose: "User-requested visits",
    allowed: true,
    rule: `(no ChatGPT-User group)\n${AE_ROBOTS}`,
    consequence: "Covered by the default rule. A ChatGPT user can have a page fetched on request.",
    findingId: null,
  },
];

// ===========================================================================
// nutrition (informational website, WordPress, https://nutrition.example)
// Audits aud-nu-001 (initial, 8 Oct), aud-nu-002 (scheduled, 22 Oct), aud-nu-003 (full, 9 Nov),
// aud-nu-004 (verification, 16 Nov, 5 pages, AI + website) and aud-nu-005 (triggered, 18 Nov, AI lane only).
// Headline numbers agree with REGISTRY_NU_AUDITS and findings fnd-nu-001 … fnd-nu-008
// (src/demo/shared-records.ts). Pages assessed: 24 / 27 / 29 / 5 of 30 in scope.
// ===========================================================================

export const NU_SITE = "https://nutrition.example";

const NU_CHANNELS = ["ch-openai", "ch-gemini", "ch-perplexity"];

const nuBaseConfig: AuditConfig = {
  promptScope: "all_active",
  promptIds: [],
  channelIds: NU_CHANNELS,
  samples: 2,
  market: "SG",
  language: "en",
  startPoints: ["Homepage", "Sitemap"],
  maxUrls: 100,
  maxDepth: 4,
  pageTypes: ["Home", "Categories", "Guides", "Courses and services", "Pages", "Policies"],
  excludedPaths: ["/wp-admin", "/wp-login.php", "/wp-json", "/?s="],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: true, pageSpeed: true, cms: true },
  limits: { maxRequests: 120, concurrency: 3, budgetUsd: 5 },
};

export const NU_AUDIT_CONFIGS: Record<string, AuditConfig> = {
  // Criteria 1.4, Search Console not connected yet.
  "aud-nu-001": { ...nuBaseConfig, criteriaVersion: "1.4", integrations: { searchConsole: false, pageSpeed: true, cms: true } },
  // Monthly scheduled full audit (22nd, 09:00 Singapore time = 01:00 UTC). Criteria 2.0.
  "aud-nu-002": {
    ...nuBaseConfig,
    criteriaVersion: "2.0",
    trigger: { source: "schedule", reason: "Monthly, 22nd at 09:00 Singapore time", cadence: "monthly", nextRunAt: "2026-11-22T01:00:00Z", dedupKey: "schedule:monthly:2026-10-22" },
  },
  "aud-nu-003": nuBaseConfig,
  // Verification of the noindex fix: 2 prompts × 3 channels × 1 sample = 6 requests, 5 pages.
  "aud-nu-004": {
    ...nuBaseConfig,
    promptScope: "ids",
    promptIds: ["p-nu-002", "p-nu-006"],
    samples: 1,
    startPoints: ["URL list (5 URLs)"],
    maxUrls: 5,
    maxDepth: 1,
    pageTypes: ["Guides", "Courses and services", "Pages"],
    limits: { maxRequests: 20, concurrency: 2, budgetUsd: 1 },
    verifies: { findingId: "fnd-nu-003", taskId: "task-nu-003" },
  },
  // Triggered, AI lane only: 2 prompts × 3 channels × 2 samples = 12 requests. No website settings apply.
  "aud-nu-005": {
    ...nuBaseConfig,
    promptScope: "ids",
    promptIds: ["p-nu-001", "p-nu-007"],
    startPoints: [],
    maxUrls: 0,
    maxDepth: 0,
    pageTypes: [],
    excludedPaths: [],
    integrations: { searchConsole: false, pageSpeed: false, cms: false },
    limits: { maxRequests: 24, concurrency: 2, budgetUsd: 1.5 },
    trigger: { source: "competitor_suggested", reason: "New competitor suggested: GreenFork Guide", dedupKey: "competitor_suggested:c-greenfork-nu:2026-11-18" },
  },
};

// ---------------------------------------------------------------------------
// Website lane: pages
// ---------------------------------------------------------------------------

const NU_PAGE_PROFILE: PageProfile = {
  idPrefix: "pg-nu",
  site: NU_SITE,
  brand: "Nutrition",
  lcp: (n) => 1500 + ((n * 131) % 700),
  deliveryText: "Free to read, no sign-up needed.",
};

const pn = (n: number, path: string, type: PageType, title: string | null, seed: PageSeed = {}) => makePage(NU_PAGE_PROFILE, n, path, type, title, seed);

const NU_NO_META: PageSeed = { metaDescription: null };
const NU_REVIEWER_ISSUE = ["Article markup names an author without credentials and has no reviewedBy"];
const NU_RECIPE_TITLE = "Recipes | Nutrition";
const NU_RECIPE_META = "Easy recipes for everyday healthy eating.";
const NU_RECIPE: PageSeed = { metaDescription: NU_RECIPE_META, schemaTypes: ["Recipe", "BreadcrumbList"], words: 420 };

export const NU_BASE_PAGES: CrawledPage[] = [
  pn(1, "/", "home", "Nutrition — Practical guides to everyday healthy eating", {
    schemaTypes: ["Organization", "WebSite"],
    schemaIssues: ["Organization sameAs is empty"],
    h2: ["Start with a guide", "Free Nutrition Basics course", "Weekly Wellness newsletter"],
    words: 580,
    inlinks: 132,
    outInternal: 38,
  }),
  pn(2, "/guides", "collection", "Nutrition guides | Nutrition", { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Eating basics", "Planning", "Reading labels"] }),
  pn(3, "/guides/meal-planning", "guide", "Weekly meal planning for beginners | Nutrition", {
    schemaTypes: ["Article", "BreadcrumbList"],
    schemaIssues: ["No FAQPage markup for the 6 visible questions and answers"],
    h2: ["Plan around three anchors", "Build a shopping list", "Batch prep", "Common questions"],
    words: 1640,
    metaDescription: "A simple weekly meal-planning routine for beginners: anchors, a shopping list and batch prep.",
  }),
  pn(4, "/guides/macros", "guide", "Macros explained: protein, carbohydrate and fat | Nutrition", {
    schemaTypes: ["Article", "BreadcrumbList"],
    schemaIssues: NU_REVIEWER_ISSUE,
    h2: ["What macros are", "Protein", "Carbohydrate", "Fat"],
    words: 1480,
  }),
  pn(5, "/guides/protein-intake", "guide", "How much protein do you need each day? | Nutrition", {
    schemaTypes: ["Article", "BreadcrumbList"],
    schemaIssues: NU_REVIEWER_ISSUE,
    h2: ["General ranges", "Protein across the day", "Plant and animal sources"],
    words: 1320,
  }),
  pn(6, "/guides/reading-food-labels", "guide", "How to read a food label | Nutrition", { schemaTypes: ["Article", "BreadcrumbList"], h2: ["Serving size", "Per 100 g", "Ingredient order"], words: 960 }),
  pn(7, "/guides/fibre-basics", "guide", "Fibre basics: where to find it and why it matters | Nutrition", { schemaTypes: ["Article", "BreadcrumbList"], words: 870 }),
  pn(8, "/courses", "collection", "Free courses | Nutrition", { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Nutrition Basics"] }),
  pn(9, "/courses/nutrition-basics", "product", "Nutrition Basics: a free 5-day email course | Nutrition", {
    // Carries a noindex tag in aud-nu-001 to aud-nu-003; removed before aud-nu-004 (see the variant page overrides).
    indexable: false,
    metaRobots: "noindex, follow",
    schemaTypes: ["Course", "BreadcrumbList"],
    h2: ["What you learn", "How the 5 days work", "Free, no card needed"],
    words: 540,
    metaDescription: "Nutrition Basics is a free 5-day email course. Learn portions, protein, fibre and label reading.",
  }),
  pn(10, "/newsletter", "product", "Weekly Wellness newsletter | Nutrition", { schemaTypes: ["WebPage", "BreadcrumbList"], words: 260 }),
  pn(11, "/consultations", "product", "Nutrition information consultations | Nutrition", { schemaTypes: ["WebPage", "BreadcrumbList"], h2: ["What a session covers", "What it does not cover"], words: 430 }),
  pn(12, "/about", "page", "About Nutrition", { schemaTypes: ["AboutPage", "BreadcrumbList"], words: 480 }),
  pn(13, "/team", "page", "Our editorial team and reviewers | Nutrition", { schemaTypes: ["WebPage", "BreadcrumbList"], words: 350 }),
  pn(14, "/recipes", "collection", "Recipes | Nutrition", { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Breakfast", "Lunch", "Meal prep"], metaDescription: NU_RECIPE_META }),
  // Six recipe pages repeat the category title and meta description until the November fix (fnd-nu-004).
  pn(15, "/recipes/meal-prep", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["Meal-prep recipes for the week"] }),
  pn(16, "/recipes/high-protein-breakfast", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["High-protein breakfast recipes"] }),
  pn(17, "/recipes/lentil-soup", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["Red lentil soup"] }),
  pn(18, "/recipes/overnight-oats", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["Overnight oats, three ways"] }),
  pn(19, "/recipes/veggie-stir-fry", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["Ten-minute veggie stir-fry"] }),
  pn(20, "/recipes/chickpea-salad", "guide", NU_RECIPE_TITLE, { ...NU_RECIPE, h1: ["Chickpea and cucumber salad"] }),
  pn(21, "/tools/calorie-calculator", "page", "Calorie calculator | Nutrition", {
    schemaTypes: ["WebApplication", "BreadcrumbList"],
    h2: ["Your details", "Your estimate", "How the estimate works"],
    words: 390,
    lab: { lcpMs: 3400, cls: 0.09, tbtMs: 310 },
  }),
  pn(22, "/blog", "collection", "Nutrition blog | Nutrition", { schemaTypes: ["Blog", "BreadcrumbList"], h2: ["Latest posts"], lab: { lcpMs: 2300, cls: 0.06, tbtMs: 200 } }),
  pn(23, "/blog/hydration", "guide", "How much water do you really need? | Nutrition", {
    schemaTypes: ["Article", "BreadcrumbList"],
    schemaIssues: ["Article markup names no author and has no reviewedBy"],
    h2: ["Thirst and habit", "Food counts too", "When to drink more"],
    words: 780,
  }),
  pn(24, "/blog/sleep-and-appetite", "guide", "Sleep and appetite: what the research suggests | Nutrition", { schemaTypes: ["Article", "BreadcrumbList"], words: 910 }),
  pn(25, "/blog/meal-prep-mistakes", "guide", "Five meal-prep mistakes to avoid | Nutrition", { schemaTypes: ["Article", "BreadcrumbList"], words: 840 }),
  pn(26, "/faq", "page", "Frequently asked questions | Nutrition", { ...NU_NO_META, schemaTypes: ["FAQPage", "BreadcrumbList"] }),
  pn(27, "/contact", "page", "Contact Nutrition", { schemaTypes: ["ContactPage", "BreadcrumbList"] }),
  pn(28, "/privacy", "policy", "Privacy policy | Nutrition", { ...NU_NO_META }),
  pn(29, "/terms", "policy", "Terms of use | Nutrition"),
  pn(30, "/blog/plant-protein-sources", "guide", "Plant protein sources, compared | Nutrition", { schemaTypes: ["Article", "BreadcrumbList"], words: 1050 }),
];

const NU_PATH = (n: number) => NU_BASE_PAGES[n - 1].path;
const NU_ALL_PAGE_IDS = NU_BASE_PAGES.map((p) => p.id);
const nuPageId = (n: number) => NU_BASE_PAGES[n - 1].id;
const nuAssessed = (leftOut: number[]) => NU_ALL_PAGE_IDS.filter((id) => !leftOut.map(nuPageId).includes(id));

/** Pages assessed per audit. aud-nu-001: 24 of 30; aud-nu-002: 27 of 30; aud-nu-003: 29 of 30. */
const NU_PAGES_001 = nuAssessed([30, 29, 25, 7, 11, 13]);
const NU_PAGES_002 = nuAssessed([30, 29, 25]);
const NU_PAGES_003 = nuAssessed([30]);
/** aud-nu-004 re-assesses the 5 pages behind the verified findings: the course page, the calculator and 3 recipe pages. */
const NU_PAGES_004 = [9, 21, 15, 16, 19].map(nuPageId);

const NU_RECIPE_PATHS = [15, 16, 17, 18, 19, 20].map(NU_PATH);
const NU_REVIEWER_PATHS = [5, 4, 23].map(NU_PATH);
const NU_NO_META_PATHS = [26, 28].map(NU_PATH);
const NU_NO_ALT_PATHS = [14, 22, 18].map(NU_PATH);

/** Count-dependent evidence for a variant, derived from the pages it assessed. */
function nuCounts(ids: string[]) {
  const pages = NU_BASE_PAGES.filter((p) => ids.includes(p.id));
  const n = pages.length;
  const noindex = pages.filter((p) => p.id === nuPageId(9)).length;
  const articles = pages.filter((p) => p.schemaTypes.includes("Article")).length;
  const crumbs = pages.filter((p) => p.schemaTypes.includes("BreadcrumbList")).length;
  const indexable = n - noindex;
  return { n, noindex, articles, crumbs, indexable };
}

// ---------------------------------------------------------------------------
// Website lane: checks (state as of aud-nu-003; earlier audits and the verification override)
// ---------------------------------------------------------------------------

const NU_ROBOTS = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\nSitemap: https://nutrition.example/wp-sitemap.xml";
const NU_C003 = nuCounts(NU_PAGES_003);

const nuReviewerSnippet = (articles: number) =>
  `${articles} sampled health articles:\n${NU_PATH(5)}  author named, no credentials, no reviewer\n${NU_PATH(4)}  author named, no credentials, no reviewer\n${NU_PATH(23)}  "Nutrition editorial team", no reviewer\n${articles - 3} other articles name a reviewer with credentials and a review date`;

const nuRecipeLines = NU_RECIPE_PATHS.map((p) => `${p}  title "${NU_RECIPE_TITLE}"`).join("\n");

export const NU_BASE_CHECKS: WebsiteCheck[] = [
  ck("chk-nu-01", "reachability", "Homepage responds with 200", "pass", "Request", "GET https://nutrition.example/  →  200 OK · 446 ms"),
  ck("chk-nu-02", "reachability", "No server errors (5xx) on assessed pages", "pass", "Crawl result", `0 of ${NU_C003.n} assessed pages returned a 5xx status`, { affected: 0 }),
  ck("chk-nu-03", "indexing", "robots.txt is reachable and parseable", "pass", "Request", "GET https://nutrition.example/robots.txt  →  200 OK · text/plain · 4 lines"),
  ck("chk-nu-04", "indexing", "AI crawler rules reviewed per user-agent", "pass", "robots.txt", "No group for OAI-SearchBot, GPTBot, ChatGPT-User, PerplexityBot or Google-Extended; the default group applies (allowed)."),
  ck("chk-nu-05", "indexing", "No unintended noindex on key pages", "fail", "Crawl result", `<meta name="robots" content="noindex, follow">\nfound on ${NU_PATH(9)}`, {
    affected: 1,
    paths: [NU_PATH(9)],
    findingId: "fnd-nu-003",
  }),
  ck("chk-nu-06", "indexing", "Search Console indexing coverage", "warning", "Search Console API", `Coverage report fetched for 30 URLs: 29 indexed, 1 excluded by noindex (${NU_PATH(9)})`, {
    affected: 1,
    paths: [NU_PATH(9)],
    findingId: "fnd-nu-003",
  }),
  ck("chk-nu-07", "canonical", "Indexable pages declare a self-referencing canonical", "pass", "Crawl result", `${NU_C003.indexable} of ${NU_C003.indexable} assessed indexable pages carry rel=canonical to themselves`, { affected: 0 }),
  ck("chk-nu-08", "canonical", "Canonical targets return 200", "pass", "Crawl result", "All canonical targets resolved with status 200", { affected: 0 }),
  ck("chk-nu-09", "sitemaps", "Sitemap is declared in robots.txt", "pass", "robots.txt", "Sitemap: https://nutrition.example/wp-sitemap.xml"),
  ck("chk-nu-10", "sitemaps", "Sitemap URLs return 200", "pass", "Sitemap audit", "0 of 30 sitemap URLs return a non-200 status", { affected: 0 }),
  ck("chk-nu-11", "linking", "Internal links resolve (no 404 or redirect)", "pass", "Link extraction", `0 internal links return 404 or redirect on ${NU_C003.n} assessed pages`, { affected: 0 }),
  ck("chk-nu-12", "rendering", "Core content is present in raw HTML", "pass", "Raw vs rendered", "Title, H1 and article text present before JavaScript runs on 6 of 6 sampled pages", { affected: 0 }),
  ck("chk-nu-13", "url_quality", "Clean URLs without session or tracking parameters", "pass", "Crawl result", "0 of 30 in-scope URLs contain session or tracking parameters", { affected: 0 }),
  ck("chk-nu-14", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "Single-language site (English, Singapore market). No other language versions exist."),
  ck("chk-nu-15", "metadata", "Each indexable page has a unique title and meta description", "fail", "Crawl result", `6 recipe pages share the title "${NU_RECIPE_TITLE}" and one meta description:\n${nuRecipeLines}`, {
    affected: 6,
    paths: NU_RECIPE_PATHS,
    findingId: "fnd-nu-004",
  }),
  ck("chk-nu-16", "metadata", "Meta description present (up to 160 characters)", "warning", "Crawl result", `2 of ${NU_C003.n} assessed pages have no meta description`, { affected: 2, paths: NU_NO_META_PATHS }),
  ck("chk-nu-17", "mobile_a11y", "Images have alternative text", "warning", "Crawl result", `3 of ${NU_C003.n} assessed pages contain <img> elements without alt text`, { affected: 3, paths: NU_NO_ALT_PATHS }),
  ck("chk-nu-18", "mobile_a11y", "Largest Contentful Paint up to 2.5 s (lab, mobile)", "warning", "PageSpeed lab data", `Lab LCP above 2.5 s (simulated mobile) on 1 page:\n${NU_PATH(21)}  3.4 s`, {
    affected: 1,
    paths: [NU_PATH(21)],
    findingId: "fnd-nu-007",
  }),
  ck("chk-nu-19", "mobile_a11y", "Field performance (CrUX)", "inconclusive", "CrUX", `No field data at origin or URL level (low traffic). ${NU_C003.n} of ${NU_C003.n} assessed URLs have lab data only.`),
  ck("chk-nu-20", "structured_data", "Guides with question-and-answer sections have FAQPage markup", "fail", "JSON-LD vs page", `${NU_PATH(3)}: 6 visible questions and answers\nJSON-LD types found: Article, BreadcrumbList\n// FAQPage is missing`, {
    affected: 1,
    paths: [NU_PATH(3)],
    findingId: "fnd-nu-001",
  }),
  ck("chk-nu-21", "structured_data", "Organization schema includes sameAs", "fail", "JSON-LD", '{ "@type": "Organization", "name": "Nutrition", "logo": "…", "sameAs": [] }\n// sameAs is empty', { affected: 1, paths: ["/"], findingId: "fnd-nu-005" }),
  ck("chk-nu-22", "structured_data", "Article markup has headline, author and dates", "pass", "JSON-LD", `Article markup complete on ${NU_C003.articles} of ${NU_C003.articles} assessed guides and posts`, { affected: 0 }),
  ck("chk-nu-23", "structured_data", "BreadcrumbList on guides, courses and recipes", "pass", "JSON-LD", `BreadcrumbList found on ${NU_C003.crumbs} of ${NU_C003.crumbs} assessed pages that carry breadcrumbs`, { affected: 0 }),
  ck("chk-nu-24", "content_entity", "Health articles name an author and a qualified reviewer", "fail", "Page content", nuReviewerSnippet(NU_C003.articles), {
    affected: 3,
    paths: NU_REVIEWER_PATHS,
    findingId: "fnd-nu-002",
  }),
  ck("chk-nu-25", "content_entity", "The course page states that the course is free", "pass", "Page content", `${NU_PATH(9)}: "Free · 5 daily emails" in the first screen; Course JSON-LD has isAccessibleForFree: true`, { affected: 0 }),
  ck("chk-nu-26", "content_entity", "Brand name is spelled consistently", "pass", "Text scan", 'Official spelling "Nutrition" on all 6 core pages', { affected: 0 }),
  ck("chk-nu-27", "content_entity", "Information-only disclaimer is on health pages", "pass", "Page content", "“General information, not personal medical advice” is in the footer of every assessed page", { affected: 0 }),
];

/** Evidence that depends on how many pages an audit assessed, for audits other than aud-nu-003. */
function nuCountOverrides(ids: string[]): Record<string, CheckOverride> {
  const c = nuCounts(ids);
  return {
    "chk-nu-02": { snippet: `0 of ${c.n} assessed pages returned a 5xx status` },
    "chk-nu-07": { snippet: `${c.indexable} of ${c.indexable} assessed indexable pages carry rel=canonical to themselves` },
    "chk-nu-11": { snippet: `0 internal links return 404 or redirect on ${c.n} assessed pages` },
    "chk-nu-16": { snippet: `2 of ${c.n} assessed pages have no meta description` },
    "chk-nu-17": { snippet: `3 of ${c.n} assessed pages contain <img> elements without alt text` },
    "chk-nu-19": { snippet: `No field data at origin or URL level (low traffic). ${c.n} of ${c.n} assessed URLs have lab data only.` },
    "chk-nu-22": { snippet: `Article markup complete on ${c.articles} of ${c.articles} assessed guides and posts` },
    "chk-nu-23": { snippet: `BreadcrumbList found on ${c.crumbs} of ${c.crumbs} assessed pages that carry breadcrumbs` },
    "chk-nu-24": { snippet: nuReviewerSnippet(c.articles) },
  };
}

/** Before 9 Nov the calculator loaded in about 2.3 s; the heavier chart widget arrived in the first week of November. */
const NU_CALCULATOR_FAST: Partial<CrawledPage> = { lab: { lcpMs: 2300, cls: 0.05, tbtMs: 180 } };
const NU_LCP_PASS: CheckOverride = { status: "pass", affected: 0, affectedPaths: [], findingId: null, snippet: "0 assessed pages above 2.5 s (lab, simulated mobile). Slowest: /blog  2.3 s" };

export const NU_WEBSITE_VARIANTS: Record<string, WebsiteVariant> = {
  "aud-nu-001": {
    coverage: { inScope: 30, assessed: NU_PAGES_001.length, excluded: 5, blocked: 2, unvisited: 4 },
    pageIds: NU_PAGES_001,
    // Criteria 1.4 has no Organization sameAs check.
    checkIds: NU_BASE_CHECKS.filter((c) => c.id !== "chk-nu-21").map((c) => c.id),
    overrides: {
      ...nuCountOverrides(NU_PAGES_001),
      "chk-nu-06": { status: "not_assessed", affected: null, affectedPaths: [], findingId: null, label: "Scope", snippet: "Search Console was not connected at audit time. Indexing coverage was not assessed." },
      "chk-nu-18": NU_LCP_PASS,
      "chk-nu-20": { snippet: `${NU_PATH(3)}: 6 visible questions and answers\nJSON-LD types found: Article, BreadcrumbList\n// FAQPage is missing` },
    },
    pageOverrides: { [nuPageId(1)]: { schemaIssues: [] }, [nuPageId(21)]: NU_CALCULATOR_FAST },
    crawlerOverrides: {},
    notice: "Criteria 1.4: the Organization sameAs check did not exist yet. It first runs in the October scheduled audit.",
  },
  "aud-nu-002": {
    coverage: { inScope: 30, assessed: NU_PAGES_002.length, excluded: 5, blocked: 1, unvisited: 2 },
    pageIds: NU_PAGES_002,
    checkIds: "all",
    overrides: {
      ...nuCountOverrides(NU_PAGES_002),
      "chk-nu-18": NU_LCP_PASS,
    },
    pageOverrides: { [nuPageId(21)]: NU_CALCULATOR_FAST },
    crawlerOverrides: {},
    notice: null,
  },
  "aud-nu-003": {
    coverage: { inScope: 30, assessed: NU_PAGES_003.length, excluded: 5, blocked: 0, unvisited: 1 },
    pageIds: NU_PAGES_003,
    checkIds: "all",
    overrides: {},
    pageOverrides: {},
    crawlerOverrides: {},
    notice: null,
  },
  "aud-nu-004": {
    coverage: { inScope: 5, assessed: 5, excluded: 0, blocked: 0, unvisited: 0 },
    pageIds: NU_PAGES_004,
    checkIds: ["chk-nu-01", "chk-nu-05", "chk-nu-06", "chk-nu-07", "chk-nu-15", "chk-nu-18", "chk-nu-25"],
    overrides: {
      "chk-nu-05": {
        status: "pass",
        affected: 0,
        affectedPaths: [],
        findingId: null,
        snippet: `${NU_PATH(9)}: meta robots is now "index, follow". No noindex directive on 5 of 5 assessed pages.`,
      },
      "chk-nu-06": { status: "pass", affected: 0, affectedPaths: [], findingId: null, snippet: `Coverage report fetched for 5 URLs: 5 indexed (${NU_PATH(9)} re-indexed after the tag was removed)` },
      "chk-nu-07": { snippet: "5 of 5 assessed indexable pages carry rel=canonical to themselves" },
      "chk-nu-15": {
        status: "warning",
        affected: 1,
        affectedPaths: [NU_PATH(19)],
        findingId: "fnd-nu-004",
        snippet: `Re-crawled 3 of the 6 recipe pages that shared a title:\n${NU_PATH(15)}  unique title\n${NU_PATH(16)}  unique title\n${NU_PATH(19)}  still "${NU_RECIPE_TITLE}"\nThe CMS change log shows 4 of 6 pages updated. The other 3 pages were not re-crawled in this audit.`,
      },
      "chk-nu-18": { snippet: `Lab LCP above 2.5 s (simulated mobile) on 1 of 5 assessed pages:\n${NU_PATH(21)}  3.4 s` },
    },
    pageOverrides: {
      [nuPageId(9)]: { indexable: true, metaRobots: "index, follow" },
      [nuPageId(15)]: { title: "Meal-prep recipes for the week | Nutrition", metaDescription: "Batch-cook recipes that keep for the week, with storage times and portion notes." },
      [nuPageId(16)]: { title: "High-protein breakfast recipes | Nutrition", metaDescription: "Quick breakfasts built around eggs, yoghurt and legumes, with the protein per serving." },
    },
    crawlerOverrides: {},
    notice: `Scoped to 5 URLs and 7 of ${NU_BASE_CHECKS.length} checks. Not comparable with a full audit.`,
  },
};

// ---------------------------------------------------------------------------
// AI crawler access (reported separately per crawler, never merged)
// ---------------------------------------------------------------------------

const NU_DEFAULT_RULE = `(no group for this crawler)\n${NU_ROBOTS}`;

export const NU_BASE_CRAWLERS: CrawlerAccess[] = [
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    purpose: "ChatGPT search",
    allowed: true,
    rule: NU_DEFAULT_RULE.replace("this crawler", "OAI-SearchBot"),
    consequence: "Covered by the default rule, except /wp-admin. Pages can be crawled for ChatGPT search.",
    findingId: null,
  },
  {
    id: "gptbot",
    name: "GPTBot",
    purpose: "Model training",
    allowed: true,
    rule: NU_DEFAULT_RULE.replace("this crawler", "GPTBot"),
    consequence: "Covered by the default rule. Training access is separate from ChatGPT search.",
    findingId: null,
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    purpose: "User-requested visits",
    allowed: true,
    rule: NU_DEFAULT_RULE.replace("this crawler", "ChatGPT-User"),
    consequence: "Covered by the default rule. A ChatGPT user can have a page fetched on request.",
    findingId: null,
  },
  {
    id: "perplexitybot",
    name: "PerplexityBot",
    purpose: "Perplexity search",
    allowed: true,
    rule: NU_DEFAULT_RULE.replace("this crawler", "PerplexityBot"),
    consequence: "Covered by the default rule. Pages can be crawled for Perplexity answers.",
    findingId: null,
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    purpose: "Gemini model training",
    allowed: true,
    rule: NU_DEFAULT_RULE.replace("this crawler", "Google-Extended"),
    consequence: "Covered by the default rule. This control affects Gemini training only, not Google Search.",
    findingId: null,
  },
];

// ===========================================================================
// threadly (fashion store, Shopify, https://threadly.example, United Kingdom)
// Audits aud-th-001 (initial, 8 Oct), aud-th-002 (scheduled, 22 Oct), aud-th-003 (full, 9 Nov),
// aud-th-004 (verification, 16 Nov, 5 pages, AI + website) and aud-th-005 (triggered, 18 Nov, AI lane only).
// Headline numbers agree with REGISTRY_TH_AUDITS and findings fnd-th-001 … fnd-th-008
// (src/demo/shared-records.ts). Pages assessed: 24 / 27 / 29 / 5 of 30 in scope.
// Same shape and numbers as the block above; only identity, wording and times differ.
// ===========================================================================

export const TH_SITE = "https://threadly.example";

const TH_CHANNELS = ["ch-openai", "ch-gemini", "ch-perplexity"];

const thBaseConfig: AuditConfig = {
  promptScope: "all_active",
  promptIds: [],
  channelIds: TH_CHANNELS,
  samples: 2,
  market: "GB",
  language: "en",
  startPoints: ["Homepage", "Sitemap"],
  maxUrls: 100,
  maxDepth: 4,
  pageTypes: ["Home", "Collections", "Products", "Guides", "Pages", "Policies"],
  excludedPaths: ["/admin", "/cart", "/checkout", "/search"],
  criteriaVersion: "2.1",
  analysisVersion: "1.2",
  integrations: { searchConsole: true, pageSpeed: true, cms: true },
  limits: { maxRequests: 120, concurrency: 3, budgetUsd: 5 },
};

export const TH_AUDIT_CONFIGS: Record<string, AuditConfig> = {
  // Criteria 1.4, Search Console not connected yet.
  "aud-th-001": { ...thBaseConfig, criteriaVersion: "1.4", integrations: { searchConsole: false, pageSpeed: true, cms: true } },
  // Monthly scheduled full audit (22nd, 09:00 London time; 08:00 UTC while British Summer Time lasted). Criteria 2.0.
  "aud-th-002": {
    ...thBaseConfig,
    criteriaVersion: "2.0",
    trigger: { source: "schedule", reason: "Monthly, 22nd at 09:00 London time", cadence: "monthly", nextRunAt: "2026-11-22T09:00:00Z", dedupKey: "schedule:monthly:2026-10-22" },
  },
  "aud-th-003": thBaseConfig,
  // Verification of the noindex fix: 2 prompts × 3 channels × 1 sample = 6 requests, 5 pages.
  "aud-th-004": {
    ...thBaseConfig,
    promptScope: "ids",
    promptIds: ["p-th-002", "p-th-006"],
    samples: 1,
    startPoints: ["URL list (5 URLs)"],
    maxUrls: 5,
    maxDepth: 1,
    pageTypes: ["Collections", "Products", "Pages"],
    limits: { maxRequests: 20, concurrency: 2, budgetUsd: 1 },
    verifies: { findingId: "fnd-th-003", taskId: "task-th-003" },
  },
  // Triggered, AI lane only: 2 prompts × 3 channels × 2 samples = 12 requests. No website settings apply.
  "aud-th-005": {
    ...thBaseConfig,
    promptScope: "ids",
    promptIds: ["p-th-001", "p-th-007"],
    startPoints: [],
    maxUrls: 0,
    maxDepth: 0,
    pageTypes: [],
    excludedPaths: [],
    integrations: { searchConsole: false, pageSpeed: false, cms: false },
    limits: { maxRequests: 24, concurrency: 2, budgetUsd: 1.5 },
    trigger: { source: "competitor_suggested", reason: "New competitor suggested: Oakline", dedupKey: "competitor_suggested:c-oakline-th:2026-11-18" },
  },
};

// ---------------------------------------------------------------------------
// Website lane: pages
// ---------------------------------------------------------------------------

const TH_PAGE_PROFILE: PageProfile = {
  idPrefix: "pg-th",
  site: TH_SITE,
  brand: "Threadly",
  lcp: (n) => 1500 + ((n * 131) % 700),
  deliveryText: "Free UK delivery on orders over £60.",
};

const pth = (n: number, path: string, type: PageType, title: string | null, seed: PageSeed = {}) => makePage(TH_PAGE_PROFILE, n, path, type, title, seed);

const TH_NO_META: PageSeed = { metaDescription: null };
const TH_PRODUCT_ISSUE = ["Product offers.price and availability differ from the visible price and stock"];
const TH_COLLECTION_TITLE = "Shop clothing | Threadly";
const TH_COLLECTION_META = "Sustainable everyday clothing in linen, denim and merino.";
const TH_COLLECTION: PageSeed = { metaDescription: TH_COLLECTION_META, schemaTypes: ["CollectionPage", "BreadcrumbList"], words: 420 };

export const TH_BASE_PAGES: CrawledPage[] = [
  pth(1, "/", "home", "Threadly — Sustainable linen, denim and knitwear", {
    schemaTypes: ["Organization", "WebSite"],
    schemaIssues: ["Organization sameAs is empty"],
    h2: ["Shop by collection", "Everyday Linen Shirt", "Threadly Journal newsletter"],
    words: 580,
    inlinks: 132,
    outInternal: 38,
  }),
  pth(2, "/collections", "collection", "All collections | Threadly", { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Shirts", "Denim", "Knitwear"] }),
  pth(3, "/pages/size-and-fit-guide", "guide", "Size and fit guide | Threadly", {
    schemaTypes: ["WebPage", "BreadcrumbList"],
    schemaIssues: ["No FAQPage markup for the 6 visible questions and answers"],
    h2: ["How to measure yourself", "Shirts and tops", "Denim and trousers", "Common questions"],
    words: 1640,
    metaDescription: "How to measure yourself and choose your size in Threadly shirts, denim and knitwear, with a size chart in cm.",
  }),
  pth(4, "/products/everyday-linen-shirt", "product", "Everyday Linen Shirt | Threadly", {
    schemaTypes: ["Product", "BreadcrumbList"],
    schemaIssues: TH_PRODUCT_ISSUE,
    h2: ["Fit and fabric", "Sizing", "Delivery and returns", "Care"],
    words: 640,
  }),
  pth(5, "/products/relaxed-linen-shirt", "product", "Relaxed Linen Shirt | Threadly", {
    schemaTypes: ["Product", "BreadcrumbList"],
    schemaIssues: TH_PRODUCT_ISSUE,
    h2: ["Fit and fabric", "Sizing", "Care"],
    words: 580,
  }),
  pth(6, "/blogs/journal/how-to-care-for-linen", "guide", "How to care for linen: washing, drying and ironing | Threadly", { schemaTypes: ["Article", "BreadcrumbList"], h2: ["Washing", "Drying", "Ironing or not"], words: 960 }),
  pth(7, "/blogs/journal/linen-vs-cotton", "guide", "Linen vs cotton shirts: which is cooler? | Threadly", { schemaTypes: ["Article", "BreadcrumbList"], words: 870 }),
  pth(8, "/collections/linen", "collection", "Linen | Threadly", { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Linen shirts"] }),
  pth(9, "/collections/summer-linen", "collection", "Summer Linen | Threadly", {
    // Carries a noindex tag in aud-th-001 to aud-th-003; removed before aud-th-004 (see the variant page overrides).
    indexable: false,
    metaRobots: "noindex, follow",
    schemaTypes: ["CollectionPage", "BreadcrumbList"],
    h2: ["Shirts", "Shorts and trousers", "Summer layers"],
    words: 540,
    metaDescription: "Summer Linen is Threadly's edit of cool, breathable linen shirts, shorts and trousers for warm weather.",
  }),
  pth(10, "/products/short-sleeve-linen-shirt", "product", "Short-Sleeve Linen Shirt | Threadly", {
    schemaTypes: ["Product", "BreadcrumbList"],
    schemaIssues: TH_PRODUCT_ISSUE,
    words: 560,
  }),
  pth(11, "/pages/free-fit-advice", "page", "Free fit-advice chat | Threadly", { schemaTypes: ["WebPage", "BreadcrumbList"], h2: ["What we can help with", "What we cannot help with"], words: 430 }),
  pth(12, "/pages/about-us", "page", "About Threadly", { schemaTypes: ["AboutPage", "BreadcrumbList"], words: 480 }),
  pth(13, "/pages/shipping-and-returns", "page", "Shipping and returns | Threadly", { schemaTypes: ["WebPage", "BreadcrumbList"], h2: ["UK delivery", "Free returns", "Refunds"], words: 350 }),
  pth(14, "/collections/all", "collection", TH_COLLECTION_TITLE, { schemaTypes: ["CollectionPage", "BreadcrumbList"], h2: ["Shirts", "Denim", "Knitwear"], metaDescription: TH_COLLECTION_META }),
  // Six collection pages repeat the category title and meta description until the November fix (fnd-th-004).
  pth(15, "/collections/new-in", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["New in"] }),
  pth(16, "/collections/linen-shirts", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["Linen shirts"] }),
  pth(17, "/collections/organic-denim", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["Organic denim"] }),
  pth(18, "/collections/knitwear", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["Merino knitwear"] }),
  pth(19, "/collections/trousers", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["Linen trousers and shorts"] }),
  pth(20, "/collections/accessories", "collection", TH_COLLECTION_TITLE, { ...TH_COLLECTION, h1: ["Accessories"] }),
  pth(21, "/products/waxed-cotton-trench", "product", "Waxed Cotton Trench | Threadly", {
    schemaTypes: ["Product", "BreadcrumbList"],
    h2: ["Fit and fabric", "Sizing", "Care"],
    words: 390,
    lab: { lcpMs: 3400, cls: 0.09, tbtMs: 310 },
  }),
  pth(22, "/blogs/journal", "collection", "Threadly Journal | Threadly", { schemaTypes: ["Blog", "BreadcrumbList"], h2: ["Latest articles"], lab: { lcpMs: 2300, cls: 0.06, tbtMs: 200 } }),
  pth(23, "/blogs/journal/how-organic-denim-is-made", "guide", "How organic cotton denim is made | Threadly", {
    schemaTypes: ["Article", "BreadcrumbList"],
    h2: ["Growing the cotton", "Weaving and dyeing", "Finishing"],
    words: 780,
  }),
  pth(24, "/blogs/journal/measuring-for-a-shirt", "guide", "Measuring yourself for a shirt: a five-minute guide | Threadly", { schemaTypes: ["Article", "BreadcrumbList"], words: 910 }),
  pth(25, "/blogs/journal/summer-capsule-wardrobe", "guide", "A ten-piece summer capsule wardrobe | Threadly", { schemaTypes: ["Article", "BreadcrumbList"], words: 840 }),
  pth(26, "/pages/faq", "page", "Frequently asked questions | Threadly", { ...TH_NO_META, schemaTypes: ["FAQPage", "BreadcrumbList"] }),
  pth(27, "/pages/contact", "page", "Contact Threadly", { schemaTypes: ["ContactPage", "BreadcrumbList"] }),
  pth(28, "/policies/privacy-policy", "policy", "Privacy policy | Threadly", { ...TH_NO_META }),
  pth(29, "/policies/refund-policy", "policy", "Refund policy | Threadly"),
  pth(30, "/blogs/journal/caring-for-merino-knitwear", "guide", "Caring for merino knitwear so it lasts | Threadly", { schemaTypes: ["Article", "BreadcrumbList"], words: 1050 }),
];

const TH_PATH = (n: number) => TH_BASE_PAGES[n - 1].path;
const TH_ALL_PAGE_IDS = TH_BASE_PAGES.map((p) => p.id);
const thPageId = (n: number) => TH_BASE_PAGES[n - 1].id;
const thAssessed = (leftOut: number[]) => TH_ALL_PAGE_IDS.filter((id) => !leftOut.map(thPageId).includes(id));

/** Pages assessed per audit. aud-th-001: 24 of 30; aud-th-002: 27 of 30; aud-th-003: 29 of 30. */
const TH_PAGES_001 = thAssessed([30, 29, 25, 7, 11, 13]);
const TH_PAGES_002 = thAssessed([30, 29, 25]);
const TH_PAGES_003 = thAssessed([30]);
/** aud-th-004 re-assesses the 5 pages behind the verified findings: the Summer Linen collection, the trench coat product page and 3 collection pages. */
const TH_PAGES_004 = [9, 21, 15, 16, 19].map(thPageId);

const TH_COLLECTION_PATHS = [15, 16, 17, 18, 19, 20].map(TH_PATH);
const TH_LINEN_PRODUCT_PATHS = [4, 5, 10].map(TH_PATH);
const TH_NO_META_PATHS = [26, 28].map(TH_PATH);
const TH_NO_ALT_PATHS = [14, 22, 18].map(TH_PATH);

/** Count-dependent evidence for a variant, derived from the pages it assessed. */
function thCounts(ids: string[]) {
  const pages = TH_BASE_PAGES.filter((p) => ids.includes(p.id));
  const n = pages.length;
  const noindex = pages.filter((p) => p.id === thPageId(9)).length;
  const articles = pages.filter((p) => p.schemaTypes.includes("Article")).length;
  const products = pages.filter((p) => p.type === "product").length;
  const crumbs = pages.filter((p) => p.schemaTypes.includes("BreadcrumbList")).length;
  const indexable = n - noindex;
  return { n, noindex, articles, products, crumbs, indexable };
}

// ---------------------------------------------------------------------------
// Website lane: checks (state as of aud-th-003; earlier audits and the verification override)
// ---------------------------------------------------------------------------

const TH_ROBOTS = "User-agent: *\nDisallow: /admin\nDisallow: /cart\nDisallow: /checkout\nDisallow: /account\nSitemap: https://threadly.example/sitemap.xml";
const TH_C003 = thCounts(TH_PAGES_003);

const thProductSnippet = (products: number) =>
  `${products} product pages compared with their Product JSON-LD:\n${TH_PATH(4)}  availability InStock, every size sold out on the page\n${TH_PATH(5)}  offers.price "65.00", page shows £49.00\n${TH_PATH(10)}  offers.price "65.00", page shows £49.00\n${products - 3} of ${products} product pages match their markup`;

const thCollectionLines = TH_COLLECTION_PATHS.map((p) => `${p}  title "${TH_COLLECTION_TITLE}"`).join("\n");

export const TH_BASE_CHECKS: WebsiteCheck[] = [
  ck("chk-th-01", "reachability", "Homepage responds with 200", "pass", "Request", "GET https://threadly.example/  →  200 OK · 446 ms"),
  ck("chk-th-02", "reachability", "No server errors (5xx) on assessed pages", "pass", "Crawl result", `0 of ${TH_C003.n} assessed pages returned a 5xx status`, { affected: 0 }),
  ck("chk-th-03", "indexing", "robots.txt is reachable and parseable", "pass", "Request", "GET https://threadly.example/robots.txt  →  200 OK · text/plain · 6 lines"),
  ck("chk-th-04", "indexing", "AI crawler rules reviewed per user-agent", "pass", "robots.txt", "No group for OAI-SearchBot, GPTBot, ChatGPT-User, PerplexityBot or Google-Extended; the default group applies (allowed)."),
  ck("chk-th-05", "indexing", "No unintended noindex on key pages", "fail", "Crawl result", `<meta name="robots" content="noindex, follow">\nfound on ${TH_PATH(9)}`, {
    affected: 1,
    paths: [TH_PATH(9)],
    findingId: "fnd-th-003",
  }),
  ck("chk-th-06", "indexing", "Search Console indexing coverage", "warning", "Search Console API", `Coverage report fetched for 30 URLs: 29 indexed, 1 excluded by noindex (${TH_PATH(9)})`, {
    affected: 1,
    paths: [TH_PATH(9)],
    findingId: "fnd-th-003",
  }),
  ck("chk-th-07", "canonical", "Indexable pages declare a self-referencing canonical", "pass", "Crawl result", `${TH_C003.indexable} of ${TH_C003.indexable} assessed indexable pages carry rel=canonical to themselves`, { affected: 0 }),
  ck("chk-th-08", "canonical", "Canonical targets return 200", "pass", "Crawl result", "All canonical targets resolved with status 200", { affected: 0 }),
  ck("chk-th-09", "sitemaps", "Sitemap is declared in robots.txt", "pass", "robots.txt", "Sitemap: https://threadly.example/sitemap.xml"),
  ck("chk-th-10", "sitemaps", "Sitemap URLs return 200", "pass", "Sitemap audit", "0 of 30 sitemap URLs return a non-200 status", { affected: 0 }),
  ck("chk-th-11", "linking", "Internal links resolve (no 404 or redirect)", "pass", "Link extraction", `0 internal links return 404 or redirect on ${TH_C003.n} assessed pages`, { affected: 0 }),
  ck("chk-th-12", "rendering", "Core content is present in raw HTML", "pass", "Raw vs rendered", "Title, H1, price and product text present before JavaScript runs on 6 of 6 sampled pages", { affected: 0 }),
  ck("chk-th-13", "url_quality", "Clean URLs without session or tracking parameters", "pass", "Crawl result", "0 of 30 in-scope URLs contain session or tracking parameters", { affected: 0 }),
  ck("chk-th-14", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "Single-language site (English, United Kingdom market). No other language versions exist."),
  ck("chk-th-15", "metadata", "Each indexable page has a unique title and meta description", "fail", "Crawl result", `6 collection pages share the title "${TH_COLLECTION_TITLE}" and one meta description:\n${thCollectionLines}`, {
    affected: 6,
    paths: TH_COLLECTION_PATHS,
    findingId: "fnd-th-004",
  }),
  ck("chk-th-16", "metadata", "Meta description present (up to 160 characters)", "warning", "Crawl result", `2 of ${TH_C003.n} assessed pages have no meta description`, { affected: 2, paths: TH_NO_META_PATHS }),
  ck("chk-th-17", "mobile_a11y", "Images have alternative text", "warning", "Crawl result", `3 of ${TH_C003.n} assessed pages contain <img> elements without alt text`, { affected: 3, paths: TH_NO_ALT_PATHS }),
  ck("chk-th-18", "mobile_a11y", "Largest Contentful Paint up to 2.5 s (lab, mobile)", "warning", "PageSpeed lab data", `Lab LCP above 2.5 s (simulated mobile) on 1 page:\n${TH_PATH(21)}  3.4 s`, {
    affected: 1,
    paths: [TH_PATH(21)],
    findingId: "fnd-th-007",
  }),
  ck("chk-th-19", "mobile_a11y", "Field performance (CrUX)", "inconclusive", "CrUX", `No field data at origin or URL level (low traffic). ${TH_C003.n} of ${TH_C003.n} assessed URLs have lab data only.`),
  ck("chk-th-20", "structured_data", "Fit guides with question-and-answer sections have FAQPage markup", "fail", "JSON-LD vs page", `${TH_PATH(3)}: 6 visible questions and answers\nJSON-LD types found: WebPage, BreadcrumbList\n// FAQPage is missing`, {
    affected: 1,
    paths: [TH_PATH(3)],
    findingId: "fnd-th-001",
  }),
  ck("chk-th-21", "structured_data", "Organization schema includes sameAs", "fail", "JSON-LD", '{ "@type": "Organization", "name": "Threadly", "logo": "…", "sameAs": [] }\n// sameAs is empty', { affected: 1, paths: ["/"], findingId: "fnd-th-005" }),
  ck("chk-th-22", "structured_data", "Article markup has headline, author and dates", "pass", "JSON-LD", `Article markup complete on ${TH_C003.articles} of ${TH_C003.articles} assessed journal articles`, { affected: 0 }),
  ck("chk-th-23", "structured_data", "BreadcrumbList on collections, products and journal articles", "pass", "JSON-LD", `BreadcrumbList found on ${TH_C003.crumbs} of ${TH_C003.crumbs} assessed pages that carry breadcrumbs`, { affected: 0 }),
  ck("chk-th-24", "content_entity", "Linen shirt pages show the same price and availability in Product schema", "fail", "JSON-LD vs page", thProductSnippet(TH_C003.products), {
    affected: 3,
    paths: TH_LINEN_PRODUCT_PATHS,
    findingId: "fnd-th-002",
  }),
  ck("chk-th-25", "content_entity", "The Summer Linen collection page lists its products with prices and stock", "pass", "Page content", `${TH_PATH(9)}: 12 products listed with £ prices and "In stock" or "Sold out" labels; CollectionPage JSON-LD has numberOfItems: 12`, { affected: 0 }),
  ck("chk-th-26", "content_entity", "Brand name is spelled consistently", "pass", "Text scan", 'Official spelling "Threadly" on all 6 core pages', { affected: 0 }),
  ck("chk-th-27", "content_entity", "Delivery and returns terms are shown on product pages", "pass", "Page content", "“Free UK returns within 30 days · Free delivery over £60” is shown under the add-to-basket button on every assessed product page", { affected: 0 }),
];

/** Evidence that depends on how many pages an audit assessed, for audits other than aud-th-003. */
function thCountOverrides(ids: string[]): Record<string, CheckOverride> {
  const c = thCounts(ids);
  return {
    "chk-th-02": { snippet: `0 of ${c.n} assessed pages returned a 5xx status` },
    "chk-th-07": { snippet: `${c.indexable} of ${c.indexable} assessed indexable pages carry rel=canonical to themselves` },
    "chk-th-11": { snippet: `0 internal links return 404 or redirect on ${c.n} assessed pages` },
    "chk-th-16": { snippet: `2 of ${c.n} assessed pages have no meta description` },
    "chk-th-17": { snippet: `3 of ${c.n} assessed pages contain <img> elements without alt text` },
    "chk-th-19": { snippet: `No field data at origin or URL level (low traffic). ${c.n} of ${c.n} assessed URLs have lab data only.` },
    "chk-th-22": { snippet: `Article markup complete on ${c.articles} of ${c.articles} assessed journal articles` },
    "chk-th-23": { snippet: `BreadcrumbList found on ${c.crumbs} of ${c.crumbs} assessed pages that carry breadcrumbs` },
    "chk-th-24": { snippet: thProductSnippet(c.products) },
  };
}

/** Before 9 Nov the trench coat product page loaded in about 2.3 s; the larger, unoptimised photo gallery arrived in the first week of November. */
const TH_PRODUCT_FAST: Partial<CrawledPage> = { lab: { lcpMs: 2300, cls: 0.05, tbtMs: 180 } };
const TH_LCP_PASS: CheckOverride = { status: "pass", affected: 0, affectedPaths: [], findingId: null, snippet: "0 assessed pages above 2.5 s (lab, simulated mobile). Slowest: /blogs/journal  2.3 s" };

export const TH_WEBSITE_VARIANTS: Record<string, WebsiteVariant> = {
  "aud-th-001": {
    coverage: { inScope: 30, assessed: TH_PAGES_001.length, excluded: 5, blocked: 2, unvisited: 4 },
    pageIds: TH_PAGES_001,
    // Criteria 1.4 has no Organization sameAs check.
    checkIds: TH_BASE_CHECKS.filter((c) => c.id !== "chk-th-21").map((c) => c.id),
    overrides: {
      ...thCountOverrides(TH_PAGES_001),
      "chk-th-06": { status: "not_assessed", affected: null, affectedPaths: [], findingId: null, label: "Scope", snippet: "Search Console was not connected at audit time. Indexing coverage was not assessed." },
      "chk-th-18": TH_LCP_PASS,
      "chk-th-20": { snippet: `${TH_PATH(3)}: 6 visible questions and answers\nJSON-LD types found: WebPage, BreadcrumbList\n// FAQPage is missing` },
    },
    pageOverrides: { [thPageId(1)]: { schemaIssues: [] }, [thPageId(21)]: TH_PRODUCT_FAST },
    crawlerOverrides: {},
    notice: "Criteria 1.4: the Organization sameAs check did not exist yet. It first runs in the October scheduled audit.",
  },
  "aud-th-002": {
    coverage: { inScope: 30, assessed: TH_PAGES_002.length, excluded: 5, blocked: 1, unvisited: 2 },
    pageIds: TH_PAGES_002,
    checkIds: "all",
    overrides: {
      ...thCountOverrides(TH_PAGES_002),
      "chk-th-18": TH_LCP_PASS,
    },
    pageOverrides: { [thPageId(21)]: TH_PRODUCT_FAST },
    crawlerOverrides: {},
    notice: null,
  },
  "aud-th-003": {
    coverage: { inScope: 30, assessed: TH_PAGES_003.length, excluded: 5, blocked: 0, unvisited: 1 },
    pageIds: TH_PAGES_003,
    checkIds: "all",
    overrides: {},
    pageOverrides: {},
    crawlerOverrides: {},
    notice: null,
  },
  "aud-th-004": {
    coverage: { inScope: 5, assessed: 5, excluded: 0, blocked: 0, unvisited: 0 },
    pageIds: TH_PAGES_004,
    checkIds: ["chk-th-01", "chk-th-05", "chk-th-06", "chk-th-07", "chk-th-15", "chk-th-18", "chk-th-25"],
    overrides: {
      "chk-th-05": {
        status: "pass",
        affected: 0,
        affectedPaths: [],
        findingId: null,
        snippet: `${TH_PATH(9)}: meta robots is now "index, follow". No noindex directive on 5 of 5 assessed pages.`,
      },
      "chk-th-06": { status: "pass", affected: 0, affectedPaths: [], findingId: null, snippet: `Coverage report fetched for 5 URLs: 5 indexed (${TH_PATH(9)} re-indexed after the tag was removed)` },
      "chk-th-07": { snippet: "5 of 5 assessed indexable pages carry rel=canonical to themselves" },
      "chk-th-15": {
        status: "warning",
        affected: 1,
        affectedPaths: [TH_PATH(19)],
        findingId: "fnd-th-004",
        snippet: `Re-crawled 3 of the 6 collection pages that shared a title:\n${TH_PATH(15)}  unique title\n${TH_PATH(16)}  unique title\n${TH_PATH(19)}  still "${TH_COLLECTION_TITLE}"\nThe Shopify theme change log shows 4 of 6 pages updated. The other 3 pages were not re-crawled in this audit.`,
      },
      "chk-th-18": { snippet: `Lab LCP above 2.5 s (simulated mobile) on 1 of 5 assessed pages:\n${TH_PATH(21)}  3.4 s` },
    },
    pageOverrides: {
      [thPageId(9)]: { indexable: true, metaRobots: "index, follow" },
      [thPageId(15)]: { title: "New in | Threadly", metaDescription: "The latest linen, denim and merino arrivals, with sizes and stock updated daily." },
      [thPageId(16)]: { title: "Linen shirts | Threadly", metaDescription: "Everyday, relaxed and short-sleeve linen shirts in European flax, with fit and care notes." },
    },
    crawlerOverrides: {},
    notice: `Scoped to 5 URLs and 7 of ${TH_BASE_CHECKS.length} checks. Not comparable with a full audit.`,
  },
};

// ---------------------------------------------------------------------------
// AI crawler access (reported separately per crawler, never merged)
// ---------------------------------------------------------------------------

const TH_DEFAULT_RULE = `(no group for this crawler)\n${TH_ROBOTS}`;

export const TH_BASE_CRAWLERS: CrawlerAccess[] = [
  {
    id: "oai-searchbot",
    name: "OAI-SearchBot",
    purpose: "ChatGPT search",
    allowed: true,
    rule: TH_DEFAULT_RULE.replace("this crawler", "OAI-SearchBot"),
    consequence: "Covered by the default rule, except /admin, /cart, /checkout and /account. Pages can be crawled for ChatGPT search.",
    findingId: null,
  },
  {
    id: "gptbot",
    name: "GPTBot",
    purpose: "Model training",
    allowed: true,
    rule: TH_DEFAULT_RULE.replace("this crawler", "GPTBot"),
    consequence: "Covered by the default rule. Training access is separate from ChatGPT search.",
    findingId: null,
  },
  {
    id: "chatgpt-user",
    name: "ChatGPT-User",
    purpose: "User-requested visits",
    allowed: true,
    rule: TH_DEFAULT_RULE.replace("this crawler", "ChatGPT-User"),
    consequence: "Covered by the default rule. A ChatGPT user can have a page fetched on request.",
    findingId: null,
  },
  {
    id: "perplexitybot",
    name: "PerplexityBot",
    purpose: "Perplexity search",
    allowed: true,
    rule: TH_DEFAULT_RULE.replace("this crawler", "PerplexityBot"),
    consequence: "Covered by the default rule. Pages can be crawled for Perplexity answers.",
    findingId: null,
  },
  {
    id: "google-extended",
    name: "Google-Extended",
    purpose: "Gemini model training",
    allowed: true,
    rule: TH_DEFAULT_RULE.replace("this crawler", "Google-Extended"),
    consequence: "Covered by the default rule. This control affects Gemini training only, not Google Search.",
    findingId: null,
  },
];

// ---------------------------------------------------------------------------
// Per-store lookup used by src/services/audit.ts
// ---------------------------------------------------------------------------

export type WebsiteBase = { pages: CrawledPage[]; checks: WebsiteCheck[]; crawlers: CrawlerAccess[] };

export const WEBSITE_BASES: Record<string, WebsiteBase> = {
  "runpro-pk": { pages: BASE_PAGES, checks: BASE_CHECKS, crawlers: BASE_CRAWLERS },
  "runpro-ae": { pages: AE_BASE_PAGES, checks: AE_BASE_CHECKS, crawlers: AE_BASE_CRAWLERS },
  nutrition: { pages: NU_BASE_PAGES, checks: NU_BASE_CHECKS, crawlers: NU_BASE_CRAWLERS },
  threadly: { pages: TH_BASE_PAGES, checks: TH_BASE_CHECKS, crawlers: TH_BASE_CRAWLERS },
};

/** Configuration of every audit of every store, keyed by audit id (ids never collide across stores). */
export const ALL_AUDIT_CONFIGS: Record<string, AuditConfig> = { ...AUDIT_CONFIGS, ...AE_AUDIT_CONFIGS, ...NU_AUDIT_CONFIGS, ...TH_AUDIT_CONFIGS };

/** Website-lane variant of every audit that has a website lane. */
export const ALL_WEBSITE_VARIANTS: Record<string, WebsiteVariant> = { ...WEBSITE_VARIANTS, ...AE_WEBSITE_VARIANTS, ...NU_WEBSITE_VARIANTS, ...TH_WEBSITE_VARIANTS };

// ---------------------------------------------------------------------------
// Extra demonstration audits: the origin types and end states the registry audits do not cover.
// They are built like simulated audits (same engine, frozen clock), so the history shows every type and status.
// ---------------------------------------------------------------------------

export type ExtraAuditSpec = {
  id: string;
  title: string;
  type: AuditType;
  lanes: AuditLane[];
  startedAt: string;
  createdBy: string;
  scenario: SimScenario;
  /** Cancelled audits stop at this share of the run. */
  cancelAt?: number;
  promptIds?: string[];
  samples: number;
  trigger?: AuditTrigger;
  verifies?: AuditVerifies;
};

export const EXTRA_AUDIT_SPECS: Record<string, ExtraAuditSpec[]> = {
  "runpro-pk": [
    {
      id: "aud-005",
      title: "Triggered audit — fix applied",
      type: "triggered",
      lanes: ["ai_visibility", "website_readiness"],
      startedAt: "2026-11-16T10:05:00Z",
      createdBy: "System",
      scenario: "normal",
      samples: 2,
      trigger: { source: "fix_applied", reason: "Fix task for the Glide 2 product schema was marked applied", dedupKey: "fix_applied:fnd-002:2026-11-16" },
    },
    {
      id: "aud-006",
      title: "Scheduled audit — weekly AI visibility",
      type: "scheduled",
      lanes: ["ai_visibility"],
      startedAt: "2026-11-09T06:00:00Z",
      createdBy: "Schedule",
      scenario: "normal",
      promptIds: ["p-001", "p-002", "p-003"],
      samples: 2,
      trigger: { source: "schedule", reason: "Weekly, Mondays 06:00 UTC", cadence: "weekly", nextRunAt: "2026-11-23T06:00:00Z", dedupKey: "schedule:weekly:2026-11-09" },
    },
    {
      id: "aud-007",
      title: "Focused audit — delivery questions",
      type: "focused",
      lanes: ["ai_visibility"],
      startedAt: "2026-11-17T13:20:00Z",
      createdBy: "Sana Iqbal",
      scenario: "normal",
      cancelAt: 0.55,
      promptIds: ["p-002", "p-004"],
      samples: 2,
    },
    {
      id: "aud-008",
      title: "Verification — Glide 2 price schema",
      type: "verification",
      lanes: ["ai_visibility"],
      startedAt: "2026-11-18T08:00:00Z",
      createdBy: "Sana Iqbal",
      scenario: "provider_outage",
      promptIds: ["p-005", "p-001"],
      samples: 1,
      verifies: { findingId: "fnd-002" },
    },
    {
      id: "aud-009",
      title: "Full audit — crawl blocked",
      type: "full",
      lanes: ["ai_visibility", "website_readiness"],
      startedAt: "2026-11-18T15:30:00Z",
      createdBy: "Hira Malik",
      scenario: "crawl_blocked",
      samples: 2,
    },
  ],
};
