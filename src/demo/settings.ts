/**
 * DEMONSTRATION DATA — not real. Settings, integrations, billing and activity.
 * Fixed timestamps only ("now" is 2026-11-19T09:00:00Z). Read through src/services/settings.ts.
 * Numbers agree with src/demo/shared.ts (members, store request usage, caps, channels).
 */
import type {
  ActivityEntry,
  BrandVersion,
  DomainRecord,
  IntegrationDetail,
  Invoice,
  NotificationEvent,
  NotificationMatrix,
  NotificationPrefs,
  Permission,
  PendingInvite,
  ProviderConnectionBase,
  RolePermissions,
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

export const DEMO_STORE_NOTIFICATIONS: StoreNotificationOverride[] = [
  { storeId: "runpro-pk", mode: "override", matrix: PK_OVERRIDE },
  { storeId: "runpro-ae", mode: "inherit", matrix: DEMO_ORG_NOTIFICATIONS.matrix },
  { storeId: "homefit-uk", mode: "inherit", matrix: DEMO_ORG_NOTIFICATIONS.matrix },
];

/* ───────── Roles ───────── */

export const PERMISSIONS: Permission[] = [
  { id: "view", label: "View stores and results", info: "Read dashboards, responses and reports." },
  { id: "edit", label: "Edit stores and prompts", info: "Change store profile, prompts and monitoring schedules." },
  { id: "run_audits", label: "Run audits", info: "Start audits and monitoring runs. Uses provider requests." },
  { id: "review", label: "Review findings", info: "Confirm, dismiss or accept risk on findings." },
  { id: "approve", label: "Approve fixes", info: "Approval is separate from editing: editors draft changes, approvers allow them to be applied." },
  { id: "members", label: "Manage members", info: "Invite people, change roles and remove members." },
];

export const ROLE_PERMISSIONS: RolePermissions = {
  owner: ["view", "edit", "run_audits", "review", "approve", "members"],
  admin: ["view", "edit", "run_audits", "review", "approve", "members"],
  editor: ["view", "edit", "run_audits", "review"],
  auditor: ["view", "run_audits", "review"],
  viewer: ["view"],
};

export const DEMO_INVITES: PendingInvite[] = [
  { id: "inv-001", email: "farah@client.example", role: "viewer", invitedAt: "2026-11-17T10:20:00Z", invitedBy: "Omar Farooq" },
];

/* ───────── Billing ───────── */

export const DEMO_PLAN = {
  name: "Agency",
  storeLimit: 5,
  memberLimit: 10,
  activePromptLimit: 150,
};

/** Requests per store × provider. Row totals equal DEMO_USAGE.perStore; column sums are the provider totals. */
export const DEMO_STORE_PROVIDER_REQUESTS: Record<string, Partial<Record<"openai" | "gemini" | "perplexity", number>>> = {
  "runpro-pk": { openai: 320, gemini: 304, perplexity: 288 },
  "runpro-ae": { openai: 211, gemini: 183 },
  "homefit-uk": {},
};

export const DEMO_PROVIDER_CAPS = { openai: 900, gemini: 800, perplexity: 700 } as const;

export const DEMO_PROVIDER_EXTRAS = {
  openai: { searchCalls: 531, estimatedCostUsd: 39.83 },
  gemini: { searchCalls: 487, estimatedCostUsd: 21.92 },
  perplexity: { searchCalls: 288, estimatedCostUsd: 14.4 },
} as const;

export const DEMO_INVOICES: Invoice[] = [
  { id: "inv-2026-11", period: "Nov 2026", issuedOn: "2026-12-01", amountUsd: 149, status: "upcoming" },
  { id: "inv-2026-10", period: "Oct 2026", issuedOn: "2026-11-01", amountUsd: 149, status: "paid" },
  { id: "inv-2026-09", period: "Sep 2026", issuedOn: "2026-10-01", amountUsd: 149, status: "paid" },
  { id: "inv-2026-08", period: "Aug 2026", issuedOn: "2026-09-01", amountUsd: 99, status: "paid" },
];

/* ───────── Store settings ───────── */

export const DEMO_ARCHIVED_COMPETITORS: Competitor[] = [
  { id: "c-stride", storeId: "runpro-pk", name: "StrideCo", domains: ["strideco.example"], aliases: [], status: "archived", market: "PK" },
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
  { storeId: "runpro-ae", canonical: "runpro.ae", aliases: [{ host: "www.runpro.ae", kind: "redirect" }], former: [] },
  { storeId: "homefit-uk", canonical: "homefit.example", aliases: [], former: [] },
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
      lastVerifiedAt: "2026-11-12T05:00:00Z",
      note: "Write access was rejected on the last check. Reconnect to restore it.",
    },
    searchConsole: { state: "not_connected", property: null, lastVerifiedAt: null, note: null },
  },
  {
    storeId: "homefit-uk",
    commerce: { platform: "manual", state: "manual", account: null, scopes: [], lastVerifiedAt: null, note: "Manual store: nothing is written to the site. Fixes are guidance only." },
    searchConsole: { state: "not_connected", property: null, lastVerifiedAt: null, note: null },
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
  { id: "act-pk-01", storeId: "runpro-pk", at: "2026-08-04T10:00:00Z", actor: "Sana Iqbal", title: "Store created", kind: "store" },

  { id: "act-ae-05", storeId: "runpro-ae", at: "2026-11-18T05:30:00Z", actor: "System", title: "Commerce connection needs attention", detail: "Write access was rejected on the last check.", kind: "integration" },
  { id: "act-ae-04", storeId: "runpro-ae", at: "2026-10-04T08:00:00Z", actor: "Omar Farooq", title: "Competitor confirmed: Brand X", kind: "competitor" },
  { id: "act-ae-03", storeId: "runpro-ae", at: "2026-09-14T06:00:00Z", actor: "Sana Iqbal", title: "Status changed: Ready to Active", kind: "store" },
  { id: "act-ae-02", storeId: "runpro-ae", at: "2026-09-12T09:50:00Z", actor: "Sana Iqbal", title: "WooCommerce connected", kind: "integration" },
  { id: "act-ae-01", storeId: "runpro-ae", at: "2026-09-12T09:30:00Z", actor: "Sana Iqbal", title: "Store created", kind: "store" },

  { id: "act-uk-03", storeId: "homefit-uk", at: "2026-11-10T14:13:00Z", actor: "System", title: "Status set to Needs review", detail: "Setup incomplete.", kind: "store" },
  { id: "act-uk-02", storeId: "homefit-uk", at: "2026-11-10T14:12:00Z", actor: "Hira Malik", title: "Brand profile saved as v1", kind: "brand" },
  { id: "act-uk-01", storeId: "homefit-uk", at: "2026-11-10T14:00:00Z", actor: "Hira Malik", title: "Store created", kind: "store" },
];

/* ───────── Add-store sample data ───────── */

export const DEMO_SETUP_SAMPLE: StoreSetupSample = {
  suggestedCompetitors: [
    { id: "sug-1", name: "SwiftStride", domain: "swiftstride.example", reason: "Often named in category answers" },
    { id: "sug-2", name: "TrailMate", domain: "trailmate.example", reason: "Often named in category answers" },
    { id: "sug-3", name: "PaceLab", domain: "pacelab.example", reason: "Shares product category" },
    { id: "sug-4", name: "GulfRun", domain: "gulfrun.example", reason: "Active in nearby markets" },
  ],
  shopifyProducts: [
    { id: "shp-1", title: "Daily Trainer", category: "Everyday running", url: "https://store.example/products/daily-trainer" },
    { id: "shp-2", title: "Trail Runner", category: "Trail running", url: "https://store.example/products/trail-runner" },
    { id: "shp-3", title: "Road Racer", category: "Road running", url: "https://store.example/products/road-racer" },
    { id: "shp-4", title: "Recovery Slide", category: "Recovery", url: "https://store.example/products/recovery-slide" },
  ],
};
