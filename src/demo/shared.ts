/**
 * DEMONSTRATION DATA — not real. Used only so screens are presentable.
 * Fixed timestamps (no Date.now) so server and client render identically.
 * Read it through src/services/*; never import it from components.
 *
 * Coverage rule: store "runpro-pk" has full data in every module. The other
 * stores have lighter data so empty states appear naturally.
 */
import type {
  AiChannel,
  AlertHeadline,
  Competitor,
  Member,
  Organization,
  OrgUsage,
  ProductService,
  PromptBase,
  PromptGroup,
  Store,
} from "@/types/core";

export const DEMO_ORG: Organization = {
  id: "org-northstar",
  name: "Northstar Agency",
  timezone: "Asia/Karachi",
};

export const DEMO_MEMBERS: Member[] = [
  { id: "u-sana", name: "Sana Iqbal", email: "sana@northstar.example", role: "owner", initials: "SI", lastActive: "2026-11-19T08:40:00Z" },
  { id: "u-omar", name: "Omar Farooq", email: "omar@northstar.example", role: "admin", initials: "OF", lastActive: "2026-11-19T07:15:00Z" },
  { id: "u-hira", name: "Hira Malik", email: "hira@northstar.example", role: "editor", initials: "HM", lastActive: "2026-11-18T16:05:00Z" },
  { id: "u-bilal", name: "Bilal Ahmed", email: "bilal@northstar.example", role: "auditor", initials: "BA", lastActive: "2026-11-17T11:30:00Z" },
  { id: "u-zoya", name: "Zoya Khan", email: "zoya@client.example", role: "viewer", initials: "ZK", lastActive: "2026-11-12T09:00:00Z" },
];

export const DEMO_CURRENT_USER_ID = "u-sana";

export const DEMO_CHANNELS: AiChannel[] = [
  {
    id: "ch-openai",
    provider: "openai",
    providerLabel: "OpenAI",
    apiLabel: "Responses API",
    model: "demo-model-a",
    searchMode: "web_grounded_required",
    supportsCitations: true,
    tone: 1,
  },
  {
    id: "ch-gemini",
    provider: "gemini",
    providerLabel: "Gemini",
    apiLabel: "Gemini API · Google Search grounding",
    model: "demo-model-b",
    searchMode: "web_grounded_auto",
    supportsCitations: true,
    tone: 2,
  },
  {
    id: "ch-perplexity",
    provider: "perplexity",
    providerLabel: "Perplexity",
    apiLabel: "Agent API",
    model: "demo-model-c",
    searchMode: "web_grounded_required",
    supportsCitations: true,
    tone: 3,
  },
];

export const DEMO_STORES: Store[] = [
  {
    id: "runpro-pk",
    name: "RunPro Pakistan",
    brandName: "RunPro",
    domain: "runpro.pk",
    platform: "shopify",
    market: "PK",
    marketName: "Pakistan",
    language: "en",
    timezone: "Asia/Karachi",
    status: "active",
    industry: "Running footwear",
    brandGroupId: "bg-runpro",
    integrations: { commerce: "connected", searchConsole: "connected" },
    channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"],
    createdAt: "2026-08-04T10:00:00Z",
    summary: {
      mention: { n: 25, d: 48 },
      mentionPrevious: { n: 18, d: 48 },
      recommendation: { n: 11, d: 48 },
      recommendationPrevious: { n: 8, d: 48 },
      ownedCitation: { n: 7, d: 36 },
      ownedCitationPrevious: { n: 5, d: 36 },
      openFindings: 8,
      pendingTasks: 6,
      openAlerts: 3,
      lastRunAt: "2026-11-17T04:00:00Z",
      nextRunAt: "2026-11-24T04:00:00Z",
      activePrompts: 9,
    },
  },
  {
    id: "runpro-ae",
    name: "RunPro UAE",
    brandName: "RunPro",
    domain: "runpro.ae",
    platform: "woocommerce",
    market: "AE",
    marketName: "United Arab Emirates",
    language: "en",
    timezone: "Asia/Dubai",
    status: "active",
    industry: "Running footwear",
    brandGroupId: "bg-runpro",
    integrations: { commerce: "needs_attention", searchConsole: "not_connected" },
    channelIds: ["ch-openai", "ch-gemini"],
    createdAt: "2026-09-12T09:30:00Z",
    summary: {
      mention: { n: 9, d: 30 },
      mentionPrevious: { n: 6, d: 30 },
      recommendation: { n: 3, d: 30 },
      recommendationPrevious: { n: 3, d: 30 },
      ownedCitation: { n: 0, d: 0 },
      ownedCitationPrevious: { n: 0, d: 0 },
      openFindings: 0,
      pendingTasks: 0,
      openAlerts: 1,
      lastRunAt: "2026-11-18T05:00:00Z",
      nextRunAt: "2026-11-25T05:00:00Z",
      activePrompts: 5,
    },
  },
  {
    id: "homefit-uk",
    name: "HomeFit UK",
    brandName: "HomeFit",
    domain: "homefit.example",
    platform: "manual",
    market: "GB",
    marketName: "United Kingdom",
    language: "en",
    timezone: "Europe/London",
    status: "needs_review",
    industry: "Home fitness equipment",
    integrations: { commerce: "manual", searchConsole: "not_connected" },
    channelIds: [],
    createdAt: "2026-11-10T14:00:00Z",
    summary: null,
  },
];

export const DEMO_COMPETITORS: Competitor[] = [
  { id: "c-brandx", storeId: "runpro-pk", name: "Brand X", domains: ["brandx.example"], aliases: ["BrandX"], status: "confirmed", market: "PK" },
  { id: "c-swift", storeId: "runpro-pk", name: "SwiftStride", domains: ["swiftstride.example"], aliases: ["Swift Stride"], status: "confirmed", market: "PK" },
  { id: "c-trail", storeId: "runpro-pk", name: "TrailMate", domains: ["trailmate.example"], aliases: [], status: "confirmed", market: null },
  { id: "c-pace", storeId: "runpro-pk", name: "PaceLab", domains: ["pacelab.example"], aliases: [], status: "suggested", market: "PK" },
  { id: "c-brandx-ae", storeId: "runpro-ae", name: "Brand X", domains: ["brandx.example"], aliases: [], status: "confirmed", market: "AE" },
  { id: "c-gulf", storeId: "runpro-ae", name: "GulfRun", domains: ["gulfrun.example"], aliases: [], status: "suggested", market: "AE" },
];

export const DEMO_GROUPS: PromptGroup[] = [
  { id: "g-discovery", storeId: "runpro-pk", name: "Discovery" },
  { id: "g-recommendation", storeId: "runpro-pk", name: "Recommendation" },
  { id: "g-comparison", storeId: "runpro-pk", name: "Comparison" },
  { id: "g-local", storeId: "runpro-pk", name: "Local" },
  { id: "g-product", storeId: "runpro-pk", name: "Product" },
];

const p = (
  id: string,
  text: string,
  intent: PromptBase["intent"],
  groupId: string | null,
  status: PromptBase["status"],
  extra: Partial<PromptBase> = {},
): PromptBase => ({
  id,
  storeId: "runpro-pk",
  text,
  intent,
  topic: extra.topic ?? "Running shoes",
  groupId,
  status,
  scope: "both",
  source: "manual",
  version: 1,
  isCore: false,
  mentionsBrand: /runpro/i.test(text),
  updatedAt: "2026-10-28T10:00:00Z",
  ...extra,
});

export const DEMO_PROMPTS: PromptBase[] = [
  p("p-001", "What are the best running shoe brands for beginners?", "discovery", "g-discovery", "active", { isCore: true, topic: "Beginners", version: 2, updatedAt: "2026-10-02T09:00:00Z" }),
  p("p-002", "Which affordable running shoes would you recommend for daily jogging?", "recommendation", "g-recommendation", "active", { isCore: true, topic: "Everyday running" }),
  p("p-003", "RunPro versus Brand X: which is more suitable for beginners?", "comparison", "g-comparison", "active", { isCore: true, topic: "Beginners", version: 3 }),
  p("p-004", "What are affordable alternatives to Brand X running shoes?", "alternative", "g-comparison", "active", { topic: "Alternatives" }),
  p("p-005", "Which RunPro shoe is suitable for long-distance running?", "product_service", "g-product", "active", { isCore: true, topic: "Long distance" }),
  p("p-006", "Where can I buy beginner running shoes in Lahore?", "local_market", "g-local", "active", { isCore: true, topic: "Buying locally" }),
  p("p-007", "How should a beginner choose the correct running shoe?", "informational", "g-discovery", "active", { topic: "Beginners", source: "ai_generated" }),
  p("p-008", "Best running shoes for flat feet in Pakistan?", "recommendation", "g-recommendation", "active", { topic: "Fit", source: "ai_generated" }),
  p("p-009", "Which running shoe brands ship across Pakistan?", "discovery", "g-discovery", "active", { topic: "Availability", source: "imported", scope: "monitoring" }),
  p("p-010", "Are RunPro shoes good for marathon training?", "product_service", "g-product", "paused", { topic: "Long distance" }),
  p("p-011", "Best trail running shoes for monsoon season?", "recommendation", "g-recommendation", "draft", { topic: "Trail", source: "ai_generated", scope: "audit" }),
  p("p-012", "Top lightweight running shoes under 15,000 PKR?", "discovery", "g-discovery", "draft", { topic: "Price", source: "research_derived" }),
  p("p-013", "Where to buy running shoes in Karachi?", "local_market", "g-local", "paused", { topic: "Buying locally", source: "template" }),
  p("p-014", "RunPro vs SwiftStride for road running", "comparison", "g-comparison", "archived", { topic: "Road running", version: 2 }),
];

export const DEMO_PRODUCTS: ProductService[] = [
  { id: "pr-glide", storeId: "runpro-pk", title: "RunPro Glide 2", category: "Road running", url: "https://runpro.pk/products/glide-2" },
  { id: "pr-trail", storeId: "runpro-pk", title: "RunPro Stride Trail", category: "Trail running", url: "https://runpro.pk/products/stride-trail" },
  { id: "pr-daily", storeId: "runpro-pk", title: "RunPro Daily Trainer", category: "Everyday running", url: "https://runpro.pk/products/daily-trainer" },
  { id: "pr-marathon", storeId: "runpro-pk", title: "RunPro Marathon Elite", category: "Long distance", url: "https://runpro.pk/products/marathon-elite" },
];

export const DEMO_ALERTS: AlertHeadline[] = [
  { id: "al-001", storeId: "runpro-pk", severity: "medium", title: "New mention: “Best running shoe brands for beginners?” on OpenAI", at: "2026-11-17T04:41:00Z", read: false },
  { id: "al-002", storeId: "runpro-pk", severity: "high", title: "Lost mention candidate: “Affordable running shoes” on Gemini", at: "2026-11-17T04:44:00Z", read: false },
  { id: "al-003", storeId: "runpro-pk", severity: "low", title: "Owned citation gained on Perplexity", at: "2026-11-17T04:52:00Z", read: false },
  { id: "al-004", storeId: "runpro-ae", severity: "medium", title: "Commerce connection needs attention", at: "2026-11-18T05:30:00Z", read: true },
  { id: "al-005", storeId: "runpro-pk", severity: "info", title: "Weekly monitoring run completed with warnings", at: "2026-11-17T05:12:00Z", read: true },
];

export const DEMO_USAGE: OrgUsage = {
  periodLabel: "Nov 2026",
  requestCap: 2400,
  requests: 1306,
  perStore: [
    { storeId: "runpro-pk", requests: 912, cap: 1500 },
    { storeId: "runpro-ae", requests: 394, cap: 700 },
    { storeId: "homefit-uk", requests: 0, cap: 200 },
  ],
};
