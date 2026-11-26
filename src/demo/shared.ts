/**
 * DEMONSTRATION DATA — not real. Used only so screens are presentable.
 * Fixed timestamps (no Date.now) so server and client render identically.
 * Read it through src/services/*; never import it from components.
 *
 * Coverage rule: store "runpro-pk" has full data in every module. The other
 * stores have lighter data so empty states appear naturally.
 */
import { DEMO_EXTRA_GROUPS, DEMO_EXTRA_PROMPTS } from "@/demo/prompts";
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
  // Fictional informational website ("Nutrition"). Not a shop; the CMS connection is an optional WordPress example.
  // 7 active prompts × 3 channels × 2 samples = 42 planned jobs per full run. Headline numbers are recomputed from the registry.
  {
    id: "nutrition",
    name: "Nutrition",
    brandName: "Nutrition",
    domain: "nutrition.example",
    platform: "wordpress",
    market: "SG",
    marketName: "Singapore (demo market)",
    language: "en",
    timezone: "Asia/Singapore",
    status: "active",
    industry: "Nutrition & Wellness",
    integrations: { commerce: "connected", searchConsole: "connected" },
    channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"],
    createdAt: "2026-10-06T08:00:00Z",
    summary: {
      mention: { n: 18, d: 42 },
      mentionPrevious: { n: 16, d: 40 },
      recommendation: { n: 8, d: 42 },
      recommendationPrevious: { n: 7, d: 40 },
      ownedCitation: { n: 0, d: 0 },
      ownedCitationPrevious: { n: 0, d: 0 },
      openFindings: 0,
      pendingTasks: 0,
      openAlerts: 0,
      lastRunAt: "2026-11-16T01:00:00Z",
      nextRunAt: "2026-11-23T01:00:00Z",
      activePrompts: 7,
    },
  },
  // Fictional Shopify fashion store ("Threadly", threadly.example, UK). 7 active prompts × 3 channels × 2 samples = 42 planned
  // jobs per full run. Headline numbers are recomputed from the registry.
  {
    id: "threadly",
    name: "Threadly",
    brandName: "Threadly",
    domain: "threadly.example",
    platform: "shopify",
    market: "GB",
    marketName: "United Kingdom",
    language: "en",
    timezone: "Europe/London",
    status: "active",
    industry: "Fashion & Apparel",
    integrations: { commerce: "connected", searchConsole: "connected" },
    channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"],
    createdAt: "2026-10-06T08:00:00Z",
    summary: {
      mention: { n: 18, d: 42 },
      mentionPrevious: { n: 16, d: 40 },
      recommendation: { n: 8, d: 42 },
      recommendationPrevious: { n: 7, d: 40 },
      ownedCitation: { n: 0, d: 0 },
      ownedCitationPrevious: { n: 0, d: 0 },
      openFindings: 0,
      pendingTasks: 0,
      openAlerts: 0,
      lastRunAt: "2026-11-16T09:00:00Z",
      nextRunAt: "2026-11-23T09:00:00Z",
      activePrompts: 7,
    },
  },
];

export const DEMO_COMPETITORS: Competitor[] = [
  { id: "c-brandx", storeId: "runpro-pk", name: "Brand X", domains: ["brandx.example"], aliases: ["BrandX"], status: "confirmed", market: "PK" },
  { id: "c-swift", storeId: "runpro-pk", name: "SwiftStride", domains: ["swiftstride.example"], aliases: ["Swift Stride"], status: "confirmed", market: "PK" },
  { id: "c-trail", storeId: "runpro-pk", name: "TrailMate", domains: ["trailmate.example"], aliases: [], status: "confirmed", market: null },
  { id: "c-pace", storeId: "runpro-pk", name: "PaceLab", domains: ["pacelab.example"], aliases: [], status: "suggested", market: "PK" },
  { id: "c-brandx-ae", storeId: "runpro-ae", name: "Brand X", domains: ["brandx.example"], aliases: [], status: "confirmed", market: "AE" },
  { id: "c-swift-ae", storeId: "runpro-ae", name: "SwiftStride", domains: ["swiftstride.example"], aliases: ["Swift Stride"], status: "confirmed", market: "AE" },
  { id: "c-desert", storeId: "runpro-ae", name: "DesertRun", domains: ["desertrun.example"], aliases: [], status: "confirmed", market: "AE" },
  { id: "c-gulf", storeId: "runpro-ae", name: "GulfRun", domains: ["gulfrun.example"], aliases: [], status: "suggested", market: "AE" },
  { id: "c-ironnest-uk", storeId: "homefit-uk", name: "IronNest", domains: ["ironnest.example"], aliases: ["Iron Nest"], status: "confirmed", market: "GB" },
  { id: "c-flexform-uk", storeId: "homefit-uk", name: "FlexForm", domains: ["flexform.example"], aliases: [], status: "confirmed", market: "GB" },
  { id: "c-liftloft-uk", storeId: "homefit-uk", name: "LiftLoft", domains: ["liftloft.example"], aliases: [], status: "suggested", market: "GB" },
  { id: "c-nourishwell-nu", storeId: "nutrition", name: "NourishWell", domains: ["nourishwell.example"], aliases: ["Nourish Well"], status: "confirmed", market: "SG" },
  { id: "c-balancedbite-nu", storeId: "nutrition", name: "BalancedBite", domains: ["balancedbite.example"], aliases: ["Balanced Bite"], status: "confirmed", market: "SG" },
  { id: "c-vitaplate-nu", storeId: "nutrition", name: "VitaPlate", domains: ["vitaplate.example"], aliases: [], status: "confirmed", market: null },
  { id: "c-greenfork-nu", storeId: "nutrition", name: "GreenFork Guide", domains: ["greenfork.example"], aliases: ["GreenFork"], status: "suggested", market: "SG" },
  { id: "c-alder-th", storeId: "threadly", name: "Maison Alder", domains: ["maisonalder.example"], aliases: ["Alder"], status: "confirmed", market: "GB" },
  { id: "c-ravel-th", storeId: "threadly", name: "Ravel & Co", domains: ["ravelandco.example"], aliases: ["Ravel and Co"], status: "confirmed", market: "GB" },
  { id: "c-fieldstone-th", storeId: "threadly", name: "Fieldstone Apparel", domains: ["fieldstoneapparel.example"], aliases: ["Fieldstone"], status: "confirmed", market: null },
  { id: "c-oakline-th", storeId: "threadly", name: "Oakline", domains: ["oakline.example"], aliases: [], status: "suggested", market: "GB" },
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

/** Prompts and groups of every store (runpro-pk above, the other stores from src/demo/prompts.ts). */
export const ALL_PROMPTS: PromptBase[] = [...DEMO_PROMPTS, ...DEMO_EXTRA_PROMPTS];
export const ALL_GROUPS: PromptGroup[] = [...DEMO_GROUPS, ...DEMO_EXTRA_GROUPS];

export const DEMO_PRODUCTS: ProductService[] = [
  { id: "pr-glide", storeId: "runpro-pk", title: "RunPro Glide 2", category: "Road running", url: "https://runpro.pk/products/glide-2" },
  { id: "pr-trail", storeId: "runpro-pk", title: "RunPro Stride Trail", category: "Trail running", url: "https://runpro.pk/products/stride-trail" },
  { id: "pr-daily", storeId: "runpro-pk", title: "RunPro Daily Trainer", category: "Everyday running", url: "https://runpro.pk/products/daily-trainer" },
  { id: "pr-marathon", storeId: "runpro-pk", title: "RunPro Marathon Elite", category: "Long distance", url: "https://runpro.pk/products/marathon-elite" },
  { id: "pr-ae-glide", storeId: "runpro-ae", title: "RunPro Glide 2", category: "Road running", url: "https://runpro.ae/product/glide-2" },
  { id: "pr-ae-daily", storeId: "runpro-ae", title: "RunPro Daily Trainer", category: "Everyday running", url: "https://runpro.ae/product/daily-trainer" },
  { id: "pr-ae-marathon", storeId: "runpro-ae", title: "RunPro Marathon Elite", category: "Long distance", url: "https://runpro.ae/product/marathon-elite" },
  { id: "pr-uk-rack", storeId: "homefit-uk", title: "HomeFit Folding Squat Rack", category: "Racks and benches", url: "https://homefit.example/products/folding-squat-rack" },
  { id: "pr-uk-dumbbell", storeId: "homefit-uk", title: "HomeFit Adjustable Dumbbell Set 2-24 kg", category: "Free weights", url: "https://homefit.example/products/adjustable-dumbbells" },
  { id: "pr-uk-rower", storeId: "homefit-uk", title: "HomeFit Compact Rowing Machine", category: "Cardio", url: "https://homefit.example/products/compact-rower" },
  { id: "pr-nu-mealplan", storeId: "nutrition", title: "Weekly Meal Planning Guide", category: "Guides", url: "https://nutrition.example/guides/meal-planning" },
  { id: "pr-nu-basics", storeId: "nutrition", title: "Nutrition Basics course", category: "Courses", url: "https://nutrition.example/courses/nutrition-basics" },
  { id: "pr-nu-newsletter", storeId: "nutrition", title: "Weekly Wellness newsletter", category: "Newsletter", url: "https://nutrition.example/newsletter" },
  { id: "pr-nu-consult", storeId: "nutrition", title: "Nutrition information consultation", category: "Services", url: "https://nutrition.example/consultations" },
  { id: "pr-th-linen", storeId: "threadly", title: "Everyday Linen Shirt", category: "Shirts", url: "https://threadly.example/products/everyday-linen-shirt" },
  { id: "pr-th-denim", storeId: "threadly", title: "Straight-Leg Organic Denim", category: "Denim", url: "https://threadly.example/products/straight-leg-organic-denim" },
  { id: "pr-th-knit", storeId: "threadly", title: "Merino Crew Knit", category: "Knitwear", url: "https://threadly.example/products/merino-crew-knit" },
  { id: "pr-th-trench", storeId: "threadly", title: "Waxed Cotton Trench", category: "Outerwear", url: "https://threadly.example/products/waxed-cotton-trench" },
];

export const DEMO_ALERTS: AlertHeadline[] = [
  { id: "al-001", storeId: "runpro-pk", severity: "medium", title: "New mention: “Best running shoe brands for beginners?” on OpenAI", at: "2026-11-17T04:41:00Z", read: false },
  { id: "al-002", storeId: "runpro-pk", severity: "high", title: "Lost mention candidate: “Affordable running shoes” on Gemini", at: "2026-11-17T04:44:00Z", read: false },
  { id: "al-003", storeId: "runpro-pk", severity: "low", title: "Owned citation gained on Perplexity", at: "2026-11-17T04:52:00Z", read: false },
  { id: "al-004", storeId: "runpro-ae", severity: "medium", title: "Site connection needs attention", at: "2026-11-18T05:30:00Z", read: true },
  { id: "al-005", storeId: "runpro-pk", severity: "info", title: "Weekly monitoring run completed with warnings", at: "2026-11-17T05:12:00Z", read: true },
  // runpro-ae: unread = open (al-006…008); read = resolved or auto-closed.
  { id: "al-006", storeId: "runpro-ae", severity: "high", title: "Site connection failed 3 syncs", at: "2026-11-19T06:00:00Z", read: false },
  { id: "al-007", storeId: "runpro-ae", severity: "medium", title: "New mention: “Where can I buy running shoes in Dubai?” on OpenAI", at: "2026-11-18T05:25:00Z", read: false },
  { id: "al-008", storeId: "runpro-ae", severity: "low", title: "Owned citation gained on OpenAI for the Dubai buying prompt", at: "2026-11-18T05:26:00Z", read: false },
  { id: "al-009", storeId: "runpro-ae", severity: "medium", title: "New recommendation: “RunPro vs Brand X running shoes in the UAE” on Gemini", at: "2026-11-11T05:24:00Z", read: true },
  { id: "al-010", storeId: "runpro-ae", severity: "medium", title: "New mention: “RunPro vs Brand X running shoes in the UAE” on Gemini", at: "2026-11-04T05:24:00Z", read: true },
  { id: "al-011", storeId: "runpro-ae", severity: "info", title: "Weekly monitoring run completed with warnings (2 of 30 jobs failed)", at: "2026-11-04T05:26:00Z", read: true },
  // Brand fact errors (unread, open), then older alerts of Monitoring events so every alert has one shared id.
  { id: "al-012", storeId: "runpro-pk", severity: "high", title: "Brand fact error: Perplexity states the Glide 2 price as PKR 13,500", at: "2026-11-17T04:49:00Z", read: false },
  { id: "al-013", storeId: "runpro-ae", severity: "high", title: "Brand fact error: OpenAI quotes the Glide 2 price in USD", at: "2026-11-18T05:28:00Z", read: false },
  { id: "al-014", storeId: "runpro-pk", severity: "high", title: "Gemini error spike: 9 jobs timed out in the 27 Oct run", at: "2026-10-27T04:50:00Z", read: true },
  { id: "al-015", storeId: "runpro-pk", severity: "medium", title: "Lost mention candidate: “Where can I buy beginner running shoes in Lahore?” on Gemini", at: "2026-10-27T04:47:00Z", read: true },
  { id: "al-016", storeId: "runpro-pk", severity: "low", title: "Owned citation lost: “Where can I buy beginner running shoes in Lahore?” on Gemini", at: "2026-10-27T04:47:00Z", read: true },
  { id: "al-017", storeId: "runpro-pk", severity: "low", title: "Rank movement: average list position 1.8 → 2.1", at: "2026-10-27T04:55:00Z", read: true },
  { id: "al-018", storeId: "runpro-pk", severity: "medium", title: "New recommendation: “Which RunPro shoe is suitable for long-distance running?” on Perplexity", at: "2026-10-20T04:46:00Z", read: true },
  { id: "al-019", storeId: "runpro-pk", severity: "low", title: "Competitor increase: competitor-domain citations 56% → 60%", at: "2026-10-13T04:49:00Z", read: true },
  { id: "al-020", storeId: "runpro-ae", severity: "low", title: "Owned citation gained: “RunPro vs Brand X running shoes in the UAE” on Gemini", at: "2026-11-04T05:24:00Z", read: true },
  { id: "al-021", storeId: "runpro-ae", severity: "medium", title: "Gemini errors: 1 job hit a rate limit in the 4 Nov run", at: "2026-11-04T05:25:00Z", read: true },
  { id: "al-022", storeId: "runpro-ae", severity: "medium", title: "New recommendation: “RunPro vs Brand X running shoes in the UAE” on OpenAI", at: "2026-10-21T05:24:00Z", read: true },
  { id: "al-023", storeId: "runpro-ae", severity: "low", title: "Owned citation gained: “RunPro vs Brand X running shoes in the UAE” on OpenAI", at: "2026-10-21T05:24:00Z", read: true },
  { id: "al-024", storeId: "runpro-ae", severity: "low", title: "Gemini errors: 1 job timed out in the 21 Oct run", at: "2026-10-21T05:25:00Z", read: true },
  // nutrition: unread = open (al-025…027); read = resolved or auto-closed. Monitoring events (src/demo/monitoring.ts) reuse these ids.
  // Titles were checked against the generated responses of run-nu-001…006 (slots, failure counts, competitor rates), see EVENT_SPECS.
  { id: "al-025", storeId: "nutrition", severity: "high", title: "Brand fact error: Gemini describes the Nutrition Basics course as paid", at: "2026-11-16T01:49:00Z", read: false },
  { id: "al-026", storeId: "nutrition", severity: "medium", title: "New mention: “How do I build a balanced weekly meal plan?” on OpenAI", at: "2026-11-16T01:31:00Z", read: false },
  { id: "al-027", storeId: "nutrition", severity: "low", title: "Owned citation gained on OpenAI for the meal-plan prompt", at: "2026-11-16T01:36:00Z", read: false },
  { id: "al-028", storeId: "nutrition", severity: "info", title: "Weekly monitoring run completed (42 of 42 jobs succeeded)", at: "2026-11-16T01:44:00Z", read: true },
  { id: "al-029", storeId: "nutrition", severity: "medium", title: "New recommendation: “How do I build a balanced weekly meal plan?” on Gemini", at: "2026-11-09T01:30:00Z", read: true },
  { id: "al-030", storeId: "nutrition", severity: "medium", title: "Sentiment change: positive share of answers 11% → 15%", at: "2026-11-02T01:33:00Z", read: true },
  { id: "al-031", storeId: "nutrition", severity: "low", title: "Competitor increase: BalancedBite named in 78% → 83% of answers", at: "2026-11-02T01:45:00Z", read: true },
  { id: "al-032", storeId: "nutrition", severity: "high", title: "Provider errors up: 5 of 42 jobs failed in the 26 Oct run (OpenAI 2, Perplexity 2, Gemini 1)", at: "2026-10-26T01:46:00Z", read: true },
  { id: "al-033", storeId: "nutrition", severity: "info", title: "Weekly monitoring run completed with warnings (4 of 42 jobs failed)", at: "2026-10-12T01:41:00Z", read: true },
  // threadly: same shape as nutrition (al-034…042 ↔ al-025…033). unread = open (al-034…036). Times follow Europe/London run times
  // (08:00 UTC for runs 001–002, 09:00 UTC afterwards). Monitoring events (src/demo/monitoring.ts) reuse these ids.
  { id: "al-034", storeId: "threadly", severity: "high", title: "Brand fact error: Gemini says returns on the Summer Linen collection are not free", at: "2026-11-16T09:49:00Z", read: false },
  { id: "al-035", storeId: "threadly", severity: "medium", title: "New mention: “Which linen shirts stay cool in hot weather?” on OpenAI", at: "2026-11-16T09:31:00Z", read: false },
  { id: "al-036", storeId: "threadly", severity: "low", title: "Owned citation gained on OpenAI for the linen shirt prompt", at: "2026-11-16T09:36:00Z", read: false },
  { id: "al-037", storeId: "threadly", severity: "info", title: "Weekly monitoring run completed (42 of 42 jobs succeeded)", at: "2026-11-16T09:44:00Z", read: true },
  { id: "al-038", storeId: "threadly", severity: "medium", title: "New recommendation: “Which linen shirts stay cool in hot weather?” on Gemini", at: "2026-11-09T09:30:00Z", read: true },
  { id: "al-039", storeId: "threadly", severity: "medium", title: "Sentiment change: positive share of answers 11% → 15%", at: "2026-11-02T09:33:00Z", read: true },
  { id: "al-040", storeId: "threadly", severity: "low", title: "Competitor increase: Ravel & Co named in 78% → 83% of answers", at: "2026-11-02T09:45:00Z", read: true },
  { id: "al-041", storeId: "threadly", severity: "high", title: "Provider errors up: 5 of 42 jobs failed in the 26 Oct run (OpenAI 2, Perplexity 2, Gemini 1)", at: "2026-10-26T09:46:00Z", read: true },
  { id: "al-042", storeId: "threadly", severity: "info", title: "Weekly monitoring run completed with warnings (4 of 42 jobs failed)", at: "2026-10-12T08:41:00Z", read: true },
];

export const DEMO_USAGE: OrgUsage = {
  periodLabel: "Nov 2026",
  requestCap: 2400,
  requests: 1450,
  perStore: [
    { storeId: "runpro-pk", requests: 912, cap: 1500 },
    // 3 weekly runs (4, 11, 18 Nov) x 30 requests, the 5 Nov full audit (30) and the 14 Nov focused audit (12),
    // plus 10 retry requests for the 5 failed jobs in that period (2 jobs in run-ae-004, 3 in aud-ae-003).
    { storeId: "runpro-ae", requests: 142, cap: 700 },
    { storeId: "homefit-uk", requests: 0, cap: 200 },
    // 3 weekly runs (2, 9, 16 Nov) x 42 requests, the 9 Nov full audit (42), the 16 Nov verification audit (6) and the 18 Nov
    // triggered audit (12), plus 12 retry requests for the 6 failed jobs in that period (1 in run-nu-004, 2 in run-nu-005, 3 in aud-nu-005).
    { storeId: "nutrition", requests: 198, cap: 450 },
    // Same shape as nutrition: 3 weekly runs (2, 9, 16 Nov) x 42, the 9 Nov full audit (42), the 16 Nov verification audit (6) and the
    // 18 Nov triggered audit (12), plus 12 retry requests (1 in run-th-004, 2 in run-th-005, 3 in aud-th-005).
    { storeId: "threadly", requests: 198, cap: 450 },
  ],
};
