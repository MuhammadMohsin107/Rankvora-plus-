/**
 * DEMONSTRATION DATA — not real.
 *
 * Prompt-module detail around src/demo/shared.ts (which owns the 14 runpro-pk
 * prompts, groups and products). Adds: the small runpro-ae library, creation
 * metadata, earlier wording of edited prompts, organization templates and AI
 * suggestions. Fixed timestamps only. Read it through src/services/prompts.ts.
 *
 * Consistency notes
 * - Every runpro-pk prompt that has response samples (p-001…p-009) was created
 *   before the initial audit on 2026-08-12.
 * - Wording versions follow `promptVersionAt` in src/demo/shared-records.ts
 *   (p-001 v2 from 2 Oct; p-003 v2 from 5 Sep and v3 from 15 Oct).
 * - runpro-ae results add up to the store summary: 9 / 30 mentions, 3 recommended.
 */
import type { PromptBase, PromptGroup } from "@/types/core";
import type { PromptSuggestion, PromptTemplate } from "@/types/prompts";

export type PromptMeta = { createdAt: string; createdBy: string; activatedAt?: string; productIds?: string[] };

export const PROMPT_META: Record<string, PromptMeta> = {
  "p-001": { createdAt: "2026-08-06T08:30:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z" },
  "p-002": { createdAt: "2026-08-06T08:35:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z", productIds: ["pr-daily"] },
  "p-003": { createdAt: "2026-08-06T08:40:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z" },
  "p-004": { createdAt: "2026-08-06T08:45:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z" },
  "p-005": { createdAt: "2026-08-06T08:50:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z", productIds: ["pr-marathon", "pr-glide"] },
  "p-006": { createdAt: "2026-08-06T08:55:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-08-06T11:00:00Z" },
  "p-007": { createdAt: "2026-08-09T10:15:00Z", createdBy: "Hira Malik", activatedAt: "2026-08-09T10:20:00Z" },
  "p-008": { createdAt: "2026-08-09T10:16:00Z", createdBy: "Hira Malik", activatedAt: "2026-08-09T10:20:00Z" },
  "p-009": { createdAt: "2026-08-10T09:00:00Z", createdBy: "Omar Farooq", activatedAt: "2026-08-10T09:05:00Z" },
  "p-010": { createdAt: "2026-10-14T12:00:00Z", createdBy: "Hira Malik", productIds: ["pr-marathon"] },
  "p-011": { createdAt: "2026-10-25T09:40:00Z", createdBy: "Hira Malik", productIds: ["pr-trail"] },
  "p-012": { createdAt: "2026-10-26T14:10:00Z", createdBy: "Omar Farooq" },
  "p-013": { createdAt: "2026-10-20T10:00:00Z", createdBy: "Omar Farooq" },
  "p-014": { createdAt: "2026-09-02T09:00:00Z", createdBy: "Sana Iqbal" },
  "p-ae-001": { createdAt: "2026-09-14T08:00:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-14T08:10:00Z" },
  "p-ae-002": { createdAt: "2026-09-14T08:02:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-14T08:10:00Z" },
  "p-ae-003": { createdAt: "2026-09-14T08:04:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-14T08:10:00Z" },
  "p-ae-004": { createdAt: "2026-09-15T07:30:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-09-15T07:35:00Z" },
  "p-ae-005": { createdAt: "2026-09-15T07:32:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-09-15T07:35:00Z" },
};

type EarlierVersion = { version: number; text: string; changedBy: string; changedAt: string; note: string | null };

/** Versions of edited prompts. The current version is the prompt's own text in shared.ts. */
export const PROMPT_EDITS: Record<string, EarlierVersion[]> = {
  "p-001": [
    { version: 1, text: "What are the best running shoe brands?", changedBy: "Sana Iqbal", changedAt: "2026-08-06T08:30:00Z", note: null },
    { version: 2, text: "What are the best running shoe brands for beginners?", changedBy: "Hira Malik", changedAt: "2026-10-02T09:00:00Z", note: "Narrowed to beginners" },
  ],
  "p-003": [
    { version: 1, text: "RunPro or Brand X for running shoes?", changedBy: "Sana Iqbal", changedAt: "2026-08-06T08:40:00Z", note: null },
    { version: 2, text: "RunPro versus Brand X: which is better for beginners?", changedBy: "Omar Farooq", changedAt: "2026-09-05T08:00:00Z", note: "Rephrased as a direct comparison" },
    { version: 3, text: "RunPro versus Brand X: which is more suitable for beginners?", changedBy: "Hira Malik", changedAt: "2026-10-15T10:00:00Z", note: "Clarified the question" },
  ],
  "p-014": [
    { version: 1, text: "RunPro or SwiftStride for road running?", changedBy: "Sana Iqbal", changedAt: "2026-09-02T09:00:00Z", note: null },
    { version: 2, text: "RunPro vs SwiftStride for road running", changedBy: "Omar Farooq", changedAt: "2026-09-20T13:20:00Z", note: "Shortened" },
  ],
};

/** Status changes that are not implied by creation or activation. */
export const PROMPT_STATUS_EVENTS: Record<string, { at: string; actor: string; title: string }> = {
  "p-010": { at: "2026-10-28T10:00:00Z", actor: "Hira Malik", title: "Paused" },
  "p-013": { at: "2026-10-28T10:00:00Z", actor: "Omar Farooq", title: "Paused" },
  "p-014": { at: "2026-10-28T10:00:00Z", actor: "Sana Iqbal", title: "Archived" },
};

// ---------------------------------------------------------------------------
// runpro-ae: a small library and one monitoring run (18 Nov) with no stored responses.
// ---------------------------------------------------------------------------

export const DEMO_EXTRA_GROUPS: PromptGroup[] = [
  { id: "g-ae-discovery", storeId: "runpro-ae", name: "Discovery" },
  { id: "g-ae-local", storeId: "runpro-ae", name: "Local" },
  { id: "g-ae-comparison", storeId: "runpro-ae", name: "Comparison" },
];

const ae = (id: string, text: string, intent: PromptBase["intent"], groupId: string, extra: Partial<PromptBase> = {}): PromptBase => ({
  id,
  storeId: "runpro-ae",
  text,
  intent,
  topic: extra.topic ?? "Running shoes",
  groupId,
  status: "active",
  scope: "both",
  source: "manual",
  version: 1,
  isCore: false,
  mentionsBrand: /runpro/i.test(text),
  updatedAt: extra.updatedAt ?? "2026-09-14T08:10:00Z",
  ...extra,
});

export const DEMO_EXTRA_PROMPTS: PromptBase[] = [
  ae("p-ae-001", "What are the best running shoe brands in the UAE?", "discovery", "g-ae-discovery", { isCore: true, topic: "Category" }),
  ae("p-ae-002", "Where can I buy running shoes in Dubai?", "local_market", "g-ae-local", { isCore: true, topic: "Buying locally" }),
  ae("p-ae-003", "Which running shoes are best for hot weather?", "recommendation", "g-ae-discovery", { topic: "Climate", source: "ai_generated" }),
  ae("p-ae-004", "RunPro vs Brand X running shoes in the UAE", "comparison", "g-ae-comparison", { topic: "Comparison", updatedAt: "2026-09-15T07:35:00Z" }),
  ae("p-ae-005", "Best marathon running shoes available in Abu Dhabi?", "local_market", "g-ae-local", { topic: "Long distance", updatedAt: "2026-09-15T07:35:00Z" }),
];

/**
 * Latest-run outcome of each sample (3 per provider): R recommended, M mentioned
 * only, A not mentioned. 30 successful samples, 9 mention the brand, 3 recommend it.
 */
export const AE_LATEST_RUN = { runId: "ae-run-18-nov", at: "2026-11-18T05:00:00Z" } as const;

export const AE_RESULTS: Record<string, Record<string, string>> = {
  "p-ae-001": { "ch-openai": "MAA", "ch-gemini": "AAA" },
  "p-ae-002": { "ch-openai": "RMA", "ch-gemini": "AAA" },
  "p-ae-003": { "ch-openai": "MAA", "ch-gemini": "AAA" },
  "p-ae-004": { "ch-openai": "RMA", "ch-gemini": "MAA" },
  "p-ae-005": { "ch-openai": "MAA", "ch-gemini": "RAA" },
};

// ---------------------------------------------------------------------------
// Store profiles, templates and AI suggestions
// ---------------------------------------------------------------------------

export type StoreProfile = { category: string; item: string; city: string; need: string };

export const STORE_PROFILES: Record<string, StoreProfile> = {
  "runpro-pk": { category: "running shoes", item: "running shoe", city: "Lahore", need: "flat feet" },
  "runpro-ae": { category: "running shoes", item: "running shoe", city: "Dubai", need: "hot weather" },
  "homefit-uk": { category: "home gym equipment", item: "home gym machine", city: "London", need: "small spaces" },
};

const FALLBACK_PROFILE: StoreProfile = { category: "products", item: "product", city: "your city", need: "everyday use" };

export const profileFor = (storeId: string): StoreProfile => STORE_PROFILES[storeId] ?? FALLBACK_PROFILE;

/** Organization-level templates. Placeholders are filled from the store profile. */
export const DEMO_TEMPLATES: PromptTemplate[] = [
  { id: "t-brands", title: "Best brands in a market", text: "What are the best {category} brands in {market}?", intent: "discovery", topic: "Category" },
  { id: "t-recommend", title: "Affordable recommendation", text: "Which affordable {category} would you recommend?", intent: "recommendation", topic: "Everyday use" },
  { id: "t-versus", title: "Brand versus competitor", text: "{brand} versus {competitor}: which is better for everyday use?", intent: "comparison", topic: "Comparison" },
  { id: "t-alternative", title: "Alternatives to a competitor", text: "What are good alternatives to {competitor}?", intent: "alternative", topic: "Alternatives" },
  { id: "t-local", title: "Where to buy locally", text: "Where can I buy {category} in {city}?", intent: "local_market", topic: "Buying locally" },
  { id: "t-guide", title: "How to choose", text: "How do I choose the right {category}?", intent: "informational", topic: "Buying guide" },
];

/** Two batches of six suggestions generated from the store profile (demonstration, not model output). */
export function buildSuggestionBatches(profile: StoreProfile, brand: string, competitor: string, marketName: string): PromptSuggestion[][] {
  const mk = (id: string, text: string, intent: PromptSuggestion["intent"], topic: string): PromptSuggestion => ({
    id,
    text,
    intent,
    topic,
    brandSpecific: text.toLowerCase().includes(brand.toLowerCase()),
  });
  const { category, item, city, need } = profile;
  return [
    [
      mk("s-1", `What are the best ${category} brands in ${marketName}?`, "discovery", "Category"),
      mk("s-2", `Which ${category} would you recommend for beginners?`, "recommendation", "Beginners"),
      mk("s-3", `Where can I buy ${category} in ${city}?`, "local_market", "Buying locally"),
      mk("s-4", `How should I choose ${category}?`, "informational", "Buying guide"),
      mk("s-5", `${brand} versus ${competitor}: which is better for everyday use?`, "comparison", "Comparison"),
      mk("s-6", `Is ${brand} a good ${item} brand?`, "product_service", "Brand"),
    ],
    [
      mk("s-7", `What are good alternatives to ${competitor}?`, "alternative", "Alternatives"),
      mk("s-8", `Best ${category} on a small budget in ${marketName}?`, "recommendation", "Price"),
      mk("s-9", `Which ${category} brands deliver across ${marketName}?`, "discovery", "Availability"),
      mk("s-10", `What should I look for in ${category} for ${need}?`, "informational", "Fit"),
      mk("s-11", `Does ${brand} sell ${category} that last?`, "product_service", "Durability"),
      mk("s-12", `Top-rated ${category} brands in ${city}`, "discovery", "Local"),
    ],
  ];
}
