/**
 * DEMONSTRATION DATA — not real.
 * Audit detail around the registry audits (src/demo/registry.ts): configuration,
 * live progress of aud-004, and the website-readiness lane for runpro.pk and runpro.ae
 * (crawled pages, checks, AI crawler access). Read it only through src/services/audit.ts.
 *
 * Headline numbers (jobs, mention/recommendation, page coverage) come from the registry
 * and the response generator; this file only adds detail that never contradicts them.
 */
import type { AuditConfig, AuditStage, CheckGroup, CrawledPage, CrawlerAccess, PageType, WebsiteCheck } from "@/types/audit";

export const SITE = "https://runpro.pk";

/** Approximate provider cost per planned request (matches ≈ $3.2 per 54-job run). */
export const APPROX_COST_PER_JOB_USD = 0.06;
export const APPROX_COST_PER_PAGE_USD = 0.0004;

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
  /** Lab LCP before any per-page override. */
  lcp: (n: number) => number;
  deliveryText: string;
};

const PK_PAGE_PROFILE: PageProfile = {
  idPrefix: "pg",
  site: SITE,
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
    metaDescription: title ? `${title.split("|")[0].trim()} from RunPro. ${profile.deliveryText}` : null,
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
  ck("chk-15", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "Single-market site (PK). runpro.ae is audited as its own store."),
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
  ck("chk-ae-10", "url_quality", "Hreflang annotations", "not_applicable", "Scope", "No other language versions of runpro.ae exist. runpro.pk is audited as its own store."),
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
        snippet: `9 of 64 sitemap URLs answer 301 to the Pakistan store (runpro.pk):\n${AE_REDIRECT_LINES}\n… and 5 more`,
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

// ---------------------------------------------------------------------------
// Per-store lookup used by src/services/audit.ts
// ---------------------------------------------------------------------------

export type WebsiteBase = { pages: CrawledPage[]; checks: WebsiteCheck[]; crawlers: CrawlerAccess[] };

export const WEBSITE_BASES: Record<string, WebsiteBase> = {
  "runpro-pk": { pages: BASE_PAGES, checks: BASE_CHECKS, crawlers: BASE_CRAWLERS },
  "runpro-ae": { pages: AE_BASE_PAGES, checks: AE_BASE_CHECKS, crawlers: AE_BASE_CRAWLERS },
};

/** Configuration of every audit of every store, keyed by audit id (ids never collide across stores). */
export const ALL_AUDIT_CONFIGS: Record<string, AuditConfig> = { ...AUDIT_CONFIGS, ...AE_AUDIT_CONFIGS };

/** Website-lane variant of every audit that has a website lane. */
export const ALL_WEBSITE_VARIANTS: Record<string, WebsiteVariant> = { ...WEBSITE_VARIANTS, ...AE_WEBSITE_VARIANTS };
