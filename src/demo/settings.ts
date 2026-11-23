/**
 * DEMONSTRATION DATA — not real. Settings, integrations, billing and activity.
 * Fixed timestamps only ("now" is 2026-11-19T09:00:00Z). Read through src/services/settings.ts.
 * Numbers agree with src/demo/shared.ts (members, store request usage, caps, channels).
 */
import type {
  ActivityEntry,
  BillingBase,
  BillingInvoice,
  BillingPlan,
  BillingState,
  BrandKnowledgeBase,
  BrandVersion,
  DomainRecord,
  IntegrationDetail,
  UsageMonth,
  WebsiteUsageSeed,
  NotificationEvent,
  NotificationMatrix,
  NotificationPrefs,
  ProviderConnectionBase,
  StoreNotificationOverride,
  StoreSetupSample,
} from "@/types/settings";
import type { Competitor } from "@/types/core";

/* ───────── Providers ───────── */

export const DEMO_PROVIDERS: ProviderConnectionBase[] = [
  {
    provider: "openai",
    channelId: "ch-openai",
    label: "OpenAI",
    availability: "available",
    status: "connected",
    keyLast4: "7f3a",
    byok: true,
    searchCapability: "Web search tool",
    lastVerifiedAt: "2026-11-19T06:00:00Z",
    testOutcome: { ok: true },
  },
  {
    provider: "gemini",
    channelId: "ch-gemini",
    label: "Gemini",
    availability: "available",
    status: "connected",
    keyLast4: null,
    byok: false,
    searchCapability: "Google Search grounding",
    lastVerifiedAt: "2026-11-19T06:00:00Z",
    testOutcome: { ok: true },
  },
  {
    provider: "perplexity",
    channelId: "ch-perplexity",
    label: "Perplexity",
    availability: "available",
    status: "needs_attention",
    keyLast4: "c91d",
    byok: true,
    searchCapability: "Web search tool",
    lastVerifiedAt: "2026-11-17T04:00:00Z",
    testOutcome: { ok: false, message: "The provider returned a rate-limit error (429). Try again later." },
  },
  {
    provider: "anthropic",
    channelId: null,
    label: "Claude",
    availability: "later",
    status: "not_connected",
    keyLast4: null,
    byok: false,
    searchCapability: "Messages API web search",
    lastVerifiedAt: null,
    testOutcome: { ok: false, message: "Not available yet." },
    laterNote: "Planned. Messages API with web search.",
  },
];

/* ───────── Notifications ───────── */

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  { id: "new_mention", label: "New mention", group: "Mentions and recommendations" },
  { id: "lost_mention", label: "Lost mention", group: "Mentions and recommendations", info: "A prompt that mentioned the brand in the previous run no longer does." },
  { id: "new_recommendation", label: "New recommendation", group: "Mentions and recommendations" },
  { id: "recommendation_lost", label: "Recommendation lost", group: "Mentions and recommendations" },
  { id: "new_owned_citation", label: "New owned citation", group: "Citations" },
  { id: "lost_owned_citation", label: "Lost owned citation", group: "Citations" },
  { id: "sentiment_shift", label: "Sentiment shift", group: "Sentiment and competitors" },
  { id: "competitor_increase", label: "Competitor increase", group: "Sentiment and competitors" },
  { id: "competitor_decrease", label: "Competitor decrease", group: "Sentiment and competitors" },
  { id: "rank_movement", label: "Rank movement", group: "Sentiment and competitors", info: "Only for answers that give an explicit ordered list." },
  { id: "provider_error_spike", label: "Provider outage or error spike", group: "Data quality", info: "Failed requests are reported here, never as brand absent." },
  { id: "run_incomplete", label: "Run incomplete or late", group: "Data quality" },
];

export const DEMO_ORG_NOTIFICATIONS: NotificationPrefs = {
  matrix: {
    new_mention: ["in_app", "email"],
    lost_mention: ["in_app", "email"],
    new_recommendation: ["in_app"],
    recommendation_lost: ["in_app", "email"],
    new_owned_citation: ["in_app"],
    lost_owned_citation: ["in_app"],
    sentiment_shift: ["in_app", "email"],
    competitor_increase: ["in_app"],
    competitor_decrease: ["in_app"],
    rank_movement: ["in_app"],
    provider_error_spike: ["in_app", "email", "webhook"],
    run_incomplete: ["in_app", "email"],
  },
  digest: "weekly",
  quietHours: { enabled: true, from: "22:00", to: "07:00", timezone: "Asia/Karachi", allowCritical: true },
  webhookUrl: "https://hooks.northstar.example/rankvora",
};

const PK_OVERRIDE: NotificationMatrix = {
  ...DEMO_ORG_NOTIFICATIONS.matrix,
  lost_mention: ["in_app", "email", "webhook"],
  competitor_increase: ["in_app", "email"],
};

/** runpro-ae overrides the organization defaults: email on recommendations and owned citations, webhook on late runs. */
const AE_OVERRIDE: NotificationMatrix = {
  ...DEMO_ORG_NOTIFICATIONS.matrix,
  new_recommendation: ["in_app", "email"],
  new_owned_citation: ["in_app", "email"],
  run_incomplete: ["in_app", "email", "webhook"],
};

/** nutrition overrides one setting: email when a competitor gains ground (NourishWell is named most often). */
const NU_OVERRIDE: NotificationMatrix = {
  ...DEMO_ORG_NOTIFICATIONS.matrix,
  competitor_increase: ["in_app", "email"],
};

export const DEMO_STORE_NOTIFICATIONS: StoreNotificationOverride[] = [
  { storeId: "runpro-pk", mode: "override", matrix: PK_OVERRIDE },
  { storeId: "runpro-ae", mode: "override", matrix: AE_OVERRIDE },
  { storeId: "homefit-uk", mode: "inherit", matrix: DEMO_ORG_NOTIFICATIONS.matrix },
  { storeId: "nutrition", mode: "override", matrix: NU_OVERRIDE },
];

/* ───────── Billing (demonstration only: no payments, no card data) ───────── */

/** Three invented plans, USD per month. Limits agree with the demo usage in src/demo/shared.ts (2,400 requests per month on Growth). */
export const DEMO_PLANS: BillingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 49,
    limits: { websites: 2, prompts: 40, requests: 600, searchCalls: 300, usageAllowanceUsd: 25 },
    monitoring: "Weekly and monthly",
    retentionMonths: 3,
  },
  {
    id: "growth",
    name: "Growth",
    priceUsd: 149,
    limits: { websites: 5, prompts: 150, requests: 2400, searchCalls: 1400, usageAllowanceUsd: 100 },
    monitoring: "Daily, weekly and monthly",
    retentionMonths: 12,
  },
  {
    id: "agency",
    name: "Agency",
    priceUsd: 399,
    limits: { websites: 15, prompts: 600, requests: 9600, searchCalls: 4800, usageAllowanceUsd: 400 },
    monitoring: "Daily, weekly and monthly",
    retentionMonths: 24,
  },
];

export const DEMO_BILLING_PERIOD = { label: "Nov 2026", start: "2026-11-01", end: "2026-11-30", renewsOn: "2026-12-01" };

/** Flat per-request cost estimate in USD. One search call is made per request. */
export const DEMO_UNIT_COST_USD = { openai: 0.075, gemini: 0.045, perplexity: 0.05 } as const;

/**
 * Requests per website and provider, Nov 2026 to date. Totals equal DEMO_USAGE in src/demo/shared.ts
 * (912 + 142 + 0 + 198 = 1,252). homefit-uk has no AI channel, so 0.
 */
export const DEMO_USAGE_SEEDS: WebsiteUsageSeed[] = [
  { websiteId: "runpro-pk", requests: { openai: 320, gemini: 304, perplexity: 288 } },
  { websiteId: "runpro-ae", requests: { openai: 72, gemini: 70 } },
  { websiteId: "homefit-uk", requests: {} },
  { websiteId: "nutrition", requests: { openai: 66, gemini: 66, perplexity: 66 } },
];

/** Last six months of AI requests. Nothing was tracked before the first website in August, so Jun and Jul have no data. */
export const DEMO_USAGE_HISTORY: UsageMonth[] = [
  { label: "Jun", requests: null, limit: null },
  { label: "Jul", requests: null, limit: null },
  { label: "Aug", requests: 318, limit: 600 },
  { label: "Sep", requests: 1310, limit: 2400 },
  { label: "Oct", requests: 1742, limit: 2400 },
  { label: "Nov", requests: 1252, limit: 2400 },
];

export const DEMO_BILLING_STATE: BillingState = {
  planId: "growth",
  createdInvoices: [],
  invoiceStatus: {},
};

/** One open and one refunded example are included on purpose. Newest first. */
export const DEMO_BILLING_INVOICES: BillingInvoice[] = [
  { id: "INV-2026-1102", issuedOn: "2026-11-17", period: "Dec 2026", description: "Growth plan", amountUsd: 149, status: "open", note: "Due 1 Dec 2026" },
  { id: "INV-2026-1101", issuedOn: "2026-11-01", period: "Nov 2026", description: "Growth plan", amountUsd: 149, status: "paid" },
  { id: "INV-2026-1001", issuedOn: "2026-10-01", period: "Oct 2026", description: "Growth plan", amountUsd: 149, status: "paid" },
  { id: "INV-2026-0902", issuedOn: "2026-09-20", period: "Sep 2026", description: "Growth plan (duplicate charge)", amountUsd: 149, status: "refunded", note: "Refunded on 21 Sep" },
  { id: "INV-2026-0901", issuedOn: "2026-09-01", period: "Sep 2026", description: "Growth plan", amountUsd: 149, status: "paid" },
  { id: "INV-2026-0804", issuedOn: "2026-08-04", period: "Aug 2026", description: "Starter plan", amountUsd: 49, status: "paid" },
];

export const DEMO_BILLING: BillingBase = {
  plans: DEMO_PLANS,
  state: DEMO_BILLING_STATE,
  invoices: DEMO_BILLING_INVOICES,
  period: DEMO_BILLING_PERIOD,
  unitCostUsd: DEMO_UNIT_COST_USD,
  usageSeeds: DEMO_USAGE_SEEDS,
  history: DEMO_USAGE_HISTORY,
};

/* ───────── Store settings ───────── */

export const DEMO_ARCHIVED_COMPETITORS: Competitor[] = [
  { id: "c-stride", storeId: "runpro-pk", name: "StrideCo", domains: ["strideco.example"], aliases: [], status: "archived", market: "PK" },
  { id: "c-track-ae", storeId: "runpro-ae", name: "TrackHouse", domains: ["trackhouse.example"], aliases: [], status: "archived", market: "AE" },
  { id: "c-fuelnotes-nu", storeId: "nutrition", name: "FuelNotes", domains: ["fuelnotes.example"], aliases: [], status: "archived", market: "SG" },
];

export const DEMO_BRAND_VERSIONS: Record<string, BrandVersion[]> = {
  "runpro-pk": [
    {
      version: 3,
      createdAt: "2026-10-30T10:15:00Z",
      createdBy: "Hira Malik",
      note: "Added description and differentiators",
      brandName: "RunPro",
      aliases: ["Run Pro", "RunPro PK"],
      differentiators: ["Nationwide delivery", "Beginner-friendly cushioning range"],
      description: "Running shoes for beginners and everyday runners in Pakistan, with nationwide delivery.",
    },
    {
      version: 2,
      createdAt: "2026-09-18T08:40:00Z",
      createdBy: "Hira Malik",
      note: "Added spelling variants",
      brandName: "RunPro",
      aliases: ["Run Pro", "RunPro PK"],
      differentiators: [],
      description: "Affordable running shoes designed in Pakistan.",
    },
    {
      version: 1,
      createdAt: "2026-08-04T10:12:00Z",
      createdBy: "Sana Iqbal",
      note: "Created at setup",
      brandName: "RunPro",
      aliases: [],
      differentiators: [],
      description: "Affordable running shoes designed in Pakistan.",
    },
  ],
  "runpro-ae": [
    {
      version: 3,
      createdAt: "2026-11-06T07:45:00Z",
      createdBy: "Hira Malik",
      note: "Added delivery coverage",
      brandName: "RunPro",
      aliases: ["Run Pro", "RunPro UAE"],
      differentiators: ["Delivery across all seven emirates", "Breathable uppers for hot-weather running"],
      description: "Running shoes for everyday and marathon runners in the UAE, with delivery across all seven emirates.",
    },
    {
      version: 2,
      createdAt: "2026-10-24T10:30:00Z",
      createdBy: "Hira Malik",
      note: "Added spelling variant and differentiators",
      brandName: "RunPro",
      aliases: ["Run Pro", "RunPro UAE"],
      differentiators: ["Breathable uppers for hot-weather running"],
      description: "Running shoes for runners in the UAE.",
    },
    {
      version: 1,
      createdAt: "2026-09-12T09:40:00Z",
      createdBy: "Sana Iqbal",
      note: "Created at setup",
      brandName: "RunPro",
      aliases: ["Run Pro"],
      differentiators: [],
      description: "Running footwear for the UAE market.",
    },
  ],
  "homefit-uk": [
    {
      version: 2,
      createdAt: "2026-11-12T11:20:00Z",
      createdBy: "Hira Malik",
      note: "Added description and differentiators",
      brandName: "HomeFit",
      aliases: ["Home Fit"],
      differentiators: ["Folding equipment for small flats", "Free delivery on UK mainland orders"],
      description: "Home gym equipment for small spaces in the UK: folding racks, adjustable weights and compact cardio machines.",
    },
    {
      version: 1,
      createdAt: "2026-11-10T14:12:00Z",
      createdBy: "Hira Malik",
      note: "Created at setup",
      brandName: "HomeFit",
      aliases: [],
      differentiators: [],
      description: "",
    },
  ],
  nutrition: [
    {
      version: 3,
      createdAt: "2026-11-04T09:20:00Z",
      createdBy: "Hira Malik",
      note: "Added description and differentiators",
      brandName: "Nutrition",
      aliases: ["Nutrition Hub"],
      differentiators: ["Free beginner courses", "Dietitian-reviewed guides"],
      description: "A nutrition and wellness information website: practical guides, a free basics course and a weekly newsletter. Information only, not medical advice.",
    },
    {
      version: 2,
      createdAt: "2026-10-20T07:30:00Z",
      createdBy: "Hira Malik",
      note: "Added spelling variant",
      brandName: "Nutrition",
      aliases: ["Nutrition Hub"],
      differentiators: [],
      description: "Nutrition guides and courses for beginners.",
    },
    {
      version: 1,
      createdAt: "2026-10-06T08:10:00Z",
      createdBy: "Sana Iqbal",
      note: "Created at setup",
      brandName: "Nutrition",
      aliases: [],
      differentiators: [],
      description: "Nutrition guides and courses for beginners.",
    },
  ],
};

export const DEMO_DOMAINS: DomainRecord[] = [
  {
    storeId: "runpro-pk",
    canonical: "runpro.pk",
    aliases: [
      { host: "www.runpro.pk", kind: "redirect" },
      { host: "m.runpro.pk", kind: "alias" },
    ],
    former: [{ host: "runpro-shoes.pk", from: "2024-03-01T00:00:00Z", to: "2026-07-28T00:00:00Z", reason: "Rebrand; 301 redirect to runpro.pk" }],
  },
  {
    storeId: "runpro-ae",
    canonical: "runpro.ae",
    aliases: [
      { host: "www.runpro.ae", kind: "redirect" },
      { host: "shop.runpro.ae", kind: "alias" },
    ],
    former: [{ host: "runpro-uae.com", from: "2025-11-01T00:00:00Z", to: "2026-09-10T00:00:00Z", reason: "Moved to runpro.ae before launch; 301 redirect to runpro.ae" }],
  },
  { storeId: "homefit-uk", canonical: "homefit.example", aliases: [{ host: "www.homefit.example", kind: "redirect" }], former: [] },
  {
    storeId: "nutrition",
    canonical: "nutrition.example",
    aliases: [
      { host: "www.nutrition.example", kind: "redirect" },
      { host: "learn.nutrition.example", kind: "alias" },
    ],
    former: [{ host: "nutrition-guide.example", from: "2025-06-01T00:00:00Z", to: "2026-09-30T00:00:00Z", reason: "Renamed; 301 redirect to nutrition.example" }],
  },
];

export const DEMO_INTEGRATIONS: IntegrationDetail[] = [
  {
    storeId: "runpro-pk",
    commerce: {
      platform: "shopify",
      state: "connected",
      account: "runpro-pk.myshopify.com",
      scopes: [
        { scope: "read_products", purpose: "Read the product catalogue", granted: true },
        { scope: "read_content", purpose: "Read pages and articles", granted: true },
        { scope: "write_content", purpose: "Stage and publish approved page changes", granted: true },
        { scope: "read_themes", purpose: "Read theme files for structured data checks", granted: false },
      ],
      lastVerifiedAt: "2026-11-19T06:00:00Z",
      note: null,
    },
    searchConsole: { state: "connected", property: "sc-domain:runpro.pk", lastVerifiedAt: "2026-11-19T06:00:00Z", note: null },
  },
  {
    storeId: "runpro-ae",
    commerce: {
      platform: "woocommerce",
      state: "needs_attention",
      account: "runpro.ae",
      scopes: [
        { scope: "read", purpose: "Read products and pages", granted: true },
        { scope: "write", purpose: "Stage and publish approved changes", granted: false },
      ],
      lastVerifiedAt: "2026-11-18T05:30:00Z",
      note: "The REST API key was rejected for write requests (HTTP 401) on the last check. Read access still works, so audits and monitoring are not affected. Staging and applying fixes stays blocked until a key with read and write permission is added.",
    },
    searchConsole: { state: "not_connected", property: null, lastVerifiedAt: null, note: null },
  },
  {
    storeId: "homefit-uk",
    commerce: { platform: "manual", state: "manual", account: null, scopes: [], lastVerifiedAt: null, note: "Manual site: nothing is written to the website. Fixes are guidance only." },
    searchConsole: { state: "not_connected", property: null, lastVerifiedAt: null, note: null },
  },
  {
    storeId: "nutrition",
    commerce: {
      platform: "wordpress",
      state: "connected",
      account: "nutrition.example",
      scopes: [
        { scope: "read_pages", purpose: "Read pages and posts", granted: true },
        { scope: "edit_pages", purpose: "Stage and publish approved page changes", granted: true },
        { scope: "read_themes", purpose: "Read theme files for structured data checks", granted: false },
      ],
      lastVerifiedAt: "2026-11-17T04:00:00Z",
      note: null,
    },
    searchConsole: { state: "connected", property: "sc-domain:nutrition.example", lastVerifiedAt: "2026-11-19T06:00:00Z", note: null },
  },
];

export const DEMO_ACTIVITY: ActivityEntry[] = [
  { id: "act-pk-11", storeId: "runpro-pk", at: "2026-11-17T04:00:00Z", actor: "System", title: "Shopify connection verified", kind: "integration" },
  { id: "act-pk-10", storeId: "runpro-pk", at: "2026-11-05T09:30:00Z", actor: "System", title: "Competitor suggested: PaceLab", detail: "Seen in answers for tracked prompts.",kind: "competitor" },
  { id: "act-pk-09", storeId: "runpro-pk", at: "2026-10-30T10:15:00Z", actor: "Hira Malik", title: "Brand profile saved as v3", detail: "Added description and differentiators", kind: "brand" },
  { id: "act-pk-08", storeId: "runpro-pk", at: "2026-09-22T11:05:00Z", actor: "Omar Farooq", title: "Competitor confirmed: SwiftStride", kind: "competitor" },
  { id: "act-pk-07", storeId: "runpro-pk", at: "2026-09-18T08:40:00Z", actor: "Hira Malik", title: "Brand profile saved as v2", detail: "Added spelling variants", kind: "brand" },
  { id: "act-pk-06", storeId: "runpro-pk", at: "2026-09-02T07:50:00Z", actor: "Omar Farooq", title: "Search Console connected", detail: "Property sc-domain:runpro.pk", kind: "integration" },
  { id: "act-pk-05", storeId: "runpro-pk", at: "2026-08-20T12:10:00Z", actor: "Sana Iqbal", title: "Domain alias added: www.runpro.pk", detail: "Redirects to runpro.pk", kind: "domain" },
  { id: "act-pk-04", storeId: "runpro-pk", at: "2026-08-10T09:00:00Z", actor: "Sana Iqbal", title: "Status changed: Ready to Active", kind: "store" },
  { id: "act-pk-03", storeId: "runpro-pk", at: "2026-08-04T10:25:00Z", actor: "Sana Iqbal", title: "4 products imported from Shopify", kind: "product" },
  { id: "act-pk-02", storeId: "runpro-pk", at: "2026-08-04T10:20:00Z", actor: "Sana Iqbal", title: "Shopify connected", detail: "Scopes: read_products, read_content, write_content", kind: "integration" },
  { id: "act-pk-01", storeId: "runpro-pk", at: "2026-08-04T10:00:00Z", actor: "Sana Iqbal", title: "Website created", kind: "store" },

  { id: "act-ae-16", storeId: "runpro-ae", at: "2026-11-18T05:30:00Z", actor: "System", title: "Connector needs attention", detail: "Write access was rejected on the last check.", kind: "integration" },
  { id: "act-ae-15", storeId: "runpro-ae", at: "2026-11-06T07:45:00Z", actor: "Hira Malik", title: "Brand profile saved as v3", detail: "Added delivery coverage", kind: "brand" },
  { id: "act-ae-14", storeId: "runpro-ae", at: "2026-11-05T05:40:00Z", actor: "System", title: "Competitor suggested: GulfRun", detail: "Cited in answers for local prompts.", kind: "competitor" },
  { id: "act-ae-13", storeId: "runpro-ae", at: "2026-10-30T12:00:00Z", actor: "Sana Iqbal", title: "Notification overrides saved", detail: "Email on new recommendations and owned citations; webhook on late runs.", kind: "notification" },
  { id: "act-ae-12", storeId: "runpro-ae", at: "2026-10-24T10:30:00Z", actor: "Hira Malik", title: "Brand profile saved as v2", detail: "Added spelling variant and differentiators", kind: "brand" },
  { id: "act-ae-11", storeId: "runpro-ae", at: "2026-10-22T09:15:00Z", actor: "Omar Farooq", title: "Competitor archived: TrackHouse", detail: "No longer sells running shoes in the UAE.", kind: "competitor" },
  { id: "act-ae-10", storeId: "runpro-ae", at: "2026-10-19T11:00:00Z", actor: "Hira Malik", title: "Competitor confirmed: DesertRun", kind: "competitor" },
  { id: "act-ae-09", storeId: "runpro-ae", at: "2026-10-04T08:05:00Z", actor: "Omar Farooq", title: "Competitor confirmed: SwiftStride", kind: "competitor" },
  { id: "act-ae-08", storeId: "runpro-ae", at: "2026-10-04T08:00:00Z", actor: "Omar Farooq", title: "Competitor confirmed: Brand X", kind: "competitor" },
  { id: "act-ae-07", storeId: "runpro-ae", at: "2026-09-14T06:00:00Z", actor: "Sana Iqbal", title: "Status changed: Ready to Active", kind: "store" },
  { id: "act-ae-06", storeId: "runpro-ae", at: "2026-09-13T08:30:00Z", actor: "Sana Iqbal", title: "Former domain recorded: runpro-uae.com", detail: "301 redirect to runpro.ae", kind: "domain" },
  { id: "act-ae-05", storeId: "runpro-ae", at: "2026-09-13T08:20:00Z", actor: "Sana Iqbal", title: "Domain alias added: www.runpro.ae", detail: "Redirects to runpro.ae", kind: "domain" },
  { id: "act-ae-04", storeId: "runpro-ae", at: "2026-09-12T10:05:00Z", actor: "Sana Iqbal", title: "3 products imported from WooCommerce", kind: "product" },
  { id: "act-ae-03", storeId: "runpro-ae", at: "2026-09-12T09:50:00Z", actor: "Sana Iqbal", title: "WooCommerce connected", detail: "REST API key with read and write permission", kind: "integration" },
  { id: "act-ae-02", storeId: "runpro-ae", at: "2026-09-12T09:40:00Z", actor: "Sana Iqbal", title: "Brand profile saved as v1", kind: "brand" },
  { id: "act-ae-01", storeId: "runpro-ae", at: "2026-09-12T09:30:00Z", actor: "Sana Iqbal", title: "Website created", kind: "store" },

  { id: "act-uk-10", storeId: "homefit-uk", at: "2026-11-14T09:00:00Z", actor: "System", title: "Competitor suggested: LiftLoft", detail: "Suggested from the product category.", kind: "competitor" },
  { id: "act-uk-09", storeId: "homefit-uk", at: "2026-11-12T15:02:00Z", actor: "Hira Malik", title: "Competitor confirmed: FlexForm", kind: "competitor" },
  { id: "act-uk-08", storeId: "homefit-uk", at: "2026-11-12T15:00:00Z", actor: "Hira Malik", title: "Competitor confirmed: IronNest", kind: "competitor" },
  { id: "act-uk-07", storeId: "homefit-uk", at: "2026-11-12T11:20:00Z", actor: "Hira Malik", title: "Brand profile saved as v2", detail: "Added description and differentiators", kind: "brand" },
  { id: "act-uk-06", storeId: "homefit-uk", at: "2026-11-11T10:40:00Z", actor: "Hira Malik", title: "3 products added manually", detail: "Folding Squat Rack, Adjustable Dumbbell Set, Compact Rowing Machine", kind: "product" },
  { id: "act-uk-05", storeId: "homefit-uk", at: "2026-11-10T14:25:00Z", actor: "Hira Malik", title: "Domain alias added: www.homefit.example", detail: "Redirects to homefit.example", kind: "domain" },
  { id: "act-uk-04", storeId: "homefit-uk", at: "2026-11-10T14:20:00Z", actor: "Hira Malik", title: "Manual site type selected", detail: "No connector. Fixes are guidance only.", kind: "integration" },
  { id: "act-uk-03", storeId: "homefit-uk", at: "2026-11-10T14:13:00Z", actor: "System", title: "Status set to Needs review", detail: "Setup incomplete: no AI channel selected.", kind: "store" },
  { id: "act-uk-02", storeId: "homefit-uk", at: "2026-11-10T14:12:00Z", actor: "Hira Malik", title: "Brand profile saved as v1", kind: "brand" },
  { id: "act-uk-01", storeId: "homefit-uk", at: "2026-11-10T14:00:00Z", actor: "Hira Malik", title: "Website created", kind: "store" },

  { id: "act-nu-17", storeId: "nutrition", at: "2026-11-18T04:30:00Z", actor: "System", title: "Competitor suggested: GreenFork Guide", detail: "Cited in answers for beginner prompts.", kind: "competitor" },
  { id: "act-nu-16", storeId: "nutrition", at: "2026-11-17T04:00:00Z", actor: "System", title: "WordPress connection verified", kind: "integration" },
  { id: "act-nu-15", storeId: "nutrition", at: "2026-11-04T09:20:00Z", actor: "Hira Malik", title: "Brand profile saved as v3", detail: "Added description and differentiators", kind: "brand" },
  { id: "act-nu-14", storeId: "nutrition", at: "2026-10-30T11:00:00Z", actor: "Sana Iqbal", title: "Notification overrides saved", detail: "Email when a competitor increases.", kind: "notification" },
  { id: "act-nu-13", storeId: "nutrition", at: "2026-10-29T08:15:00Z", actor: "Omar Farooq", title: "Competitor archived: FuelNotes", detail: "Site closed; no longer appears in answers.", kind: "competitor" },
  { id: "act-nu-12", storeId: "nutrition", at: "2026-10-20T07:30:00Z", actor: "Hira Malik", title: "Brand profile saved as v2", detail: "Added spelling variant", kind: "brand" },
  { id: "act-nu-11", storeId: "nutrition", at: "2026-10-07T06:00:00Z", actor: "Sana Iqbal", title: "Status changed: Ready to Active", kind: "store" },
  { id: "act-nu-10", storeId: "nutrition", at: "2026-10-06T09:35:00Z", actor: "Omar Farooq", title: "Search Console connected", detail: "Property sc-domain:nutrition.example", kind: "integration" },
  { id: "act-nu-09", storeId: "nutrition", at: "2026-10-06T09:10:00Z", actor: "Omar Farooq", title: "Competitor confirmed: VitaPlate", kind: "competitor" },
  { id: "act-nu-08", storeId: "nutrition", at: "2026-10-06T09:05:00Z", actor: "Omar Farooq", title: "Competitor confirmed: BalancedBite", kind: "competitor" },
  { id: "act-nu-07", storeId: "nutrition", at: "2026-10-06T09:00:00Z", actor: "Omar Farooq", title: "Competitor confirmed: NourishWell", kind: "competitor" },
  { id: "act-nu-06", storeId: "nutrition", at: "2026-10-06T08:45:00Z", actor: "Sana Iqbal", title: "4 products and services added", detail: "Guide, course, newsletter and consultation pages", kind: "product" },
  { id: "act-nu-05", storeId: "nutrition", at: "2026-10-06T08:30:00Z", actor: "Sana Iqbal", title: "Former domain recorded: nutrition-guide.example", detail: "301 redirect to nutrition.example", kind: "domain" },
  { id: "act-nu-04", storeId: "nutrition", at: "2026-10-06T08:25:00Z", actor: "Sana Iqbal", title: "Domain alias added: www.nutrition.example", detail: "Redirects to nutrition.example", kind: "domain" },
  { id: "act-nu-03", storeId: "nutrition", at: "2026-10-06T08:20:00Z", actor: "Sana Iqbal", title: "WordPress connected", detail: "Application password with read and write permission", kind: "integration" },
  { id: "act-nu-02", storeId: "nutrition", at: "2026-10-06T08:10:00Z", actor: "Sana Iqbal", title: "Brand profile saved as v1", kind: "brand" },
  { id: "act-nu-01", storeId: "nutrition", at: "2026-10-06T08:00:00Z", actor: "Sana Iqbal", title: "Website created", kind: "store" },
];

/* ───────── Add-website sample data ───────── */

/** Labelled "Demo suggestions" in the Add website wizard. Not produced by any model. */
export const DEMO_SETUP_SAMPLE: StoreSetupSample = {
  suggestedCompetitors: [
    { id: "sug-1", name: "SwiftStride", domain: "swiftstride.example", reason: "Often named in category answers" },
    { id: "sug-2", name: "TrailMate", domain: "trailmate.example", reason: "Often named in category answers" },
    { id: "sug-3", name: "PaceLab", domain: "pacelab.example", reason: "Shares product category" },
    { id: "sug-4", name: "GulfRun", domain: "gulfrun.example", reason: "Active in nearby markets" },
  ],
};

/* ───────── Brand knowledge (demonstration content, authored for the seeded websites) ───────── */

type KnowledgeSeed = Pick<BrandKnowledgeBase, "facts" | "faqs" | "contentContext">;

export const DEMO_BRAND_KNOWLEDGE: Record<string, KnowledgeSeed> = {
  "runpro-pk": {
    facts: [
      { id: "fact-pk-1", label: "Delivery", value: "Nationwide delivery across Pakistan", sourceUrl: "https://runpro.pk/pages/delivery" },
      { id: "fact-pk-2", label: "Flagship road shoe", value: "RunPro Glide 2, listed at PKR 12,900", sourceUrl: "https://runpro.pk/products/glide-2" },
      { id: "fact-pk-3", label: "Beginner range", value: "Cushioned shoes for first-time and everyday runners", sourceUrl: "https://runpro.pk/collections/everyday" },
    ],
    faqs: [
      { id: "faq-pk-1", question: "Which RunPro shoe suits a beginner?", answer: "The Daily Trainer and Glide 2 are the cushioned options for new runners." },
      { id: "faq-pk-2", question: "Does RunPro deliver outside the big cities?", answer: "Yes. Orders ship nationwide from the online store." },
    ],
    contentContext: "Running shoe retailer. Key pages: home, road, trail and everyday collections, product pages, a beginner buying guide.",
  },
  "runpro-ae": {
    facts: [
      { id: "fact-ae-1", label: "Delivery", value: "Delivery across all seven emirates", sourceUrl: "https://runpro.ae/pages/delivery" },
      { id: "fact-ae-2", label: "Hot-weather range", value: "Breathable uppers for hot-weather running", sourceUrl: "https://runpro.ae/collections/everyday" },
    ],
    faqs: [{ id: "faq-ae-1", question: "Are RunPro shoes suitable for summer running in the UAE?", answer: "The range uses breathable uppers made for hot-weather running." }],
    contentContext: "Running shoe retailer for the UAE. Key pages: home, collections, product pages with AED pricing, delivery and returns.",
  },
  "homefit-uk": {
    facts: [
      { id: "fact-uk-1", label: "Delivery", value: "Free delivery on UK mainland orders", sourceUrl: "https://homefit.example/pages/delivery" },
      { id: "fact-uk-2", label: "Product focus", value: "Folding equipment for small flats", sourceUrl: "https://homefit.example/products/folding-squat-rack" },
    ],
    faqs: [],
    contentContext: "",
  },
  nutrition: {
    facts: [
      { id: "fact-nu-1", label: "Basics course", value: "Free to join, no payment details needed", sourceUrl: "https://nutrition.example/courses/nutrition-basics" },
      { id: "fact-nu-2", label: "Newsletter", value: "Sent weekly", sourceUrl: "https://nutrition.example/newsletter" },
      { id: "fact-nu-3", label: "Consultations", value: "Information only; not medical advice", sourceUrl: "https://nutrition.example/consultations" },
      { id: "fact-nu-4", label: "Guide reviews", value: "Guides are reviewed by registered dietitians (fictional)", sourceUrl: "https://nutrition.example/guides/meal-planning" },
    ],
    faqs: [
      { id: "faq-nu-1", question: "Is the Nutrition Basics course free?", answer: "Yes. The course is free for everyone." },
      { id: "faq-nu-2", question: "Does Nutrition give medical advice?", answer: "No. Everything on the website is general information only." },
      { id: "faq-nu-3", question: "Who reviews the guides?", answer: "Registered dietitians (fictional) review each guide. Named credentials are being added to every article." },
      { id: "faq-nu-4", question: "How often is the newsletter sent?", answer: "Every week." },
    ],
    contentContext: "Nutrition and wellness information website. Key pages: home, meal-planning and protein guides, recipes, the free Nutrition Basics course, a weekly newsletter, information-only consultations and a calorie calculator.",
  },
};
