/**
 * DEMONSTRATION DATA — not real.
 *
 * Prompt-module detail around src/demo/shared.ts (which owns the 14 runpro-pk
 * prompts, groups and products). Adds: the runpro-ae library (5 active prompts
 * plus paused, draft and archived ones), the homefit-uk setup-in-progress
 * library, creation metadata, earlier wording of edited prompts and organization
 * templates. Fixed timestamps only. Read it through
 * src/services/prompts.ts.
 *
 * Consistency notes
 * - Every runpro-pk prompt that has response samples (p-001…p-009) was created
 *   before the initial audit on 2026-08-12.
 * - Wording versions follow `promptVersionAt` in src/demo/shared-records.ts
 *   (p-001 v2 from 2 Oct; p-003 v2 from 5 Sep and v3 from 15 Oct).
 * - runpro-ae: only the 5 active prompts (p-ae-001…005) have responses. They come
 *   from the generated runs run-ae-001…006 and audits aud-ae-001…003, so every rate
 *   adds up to the registry. The other AE prompts were paused, archived or never
 *   activated before the first run (14 Oct) and the first audit (16 Sep), so they
 *   have no responses and their versions show 0 runs.
 * - homefit-uk has no AI channel: nothing is tracked, no prompt has results.
 */
import type { PromptBase, PromptGroup } from "@/types/core";
import type { PromptTemplate } from "@/types/prompts";

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
  "p-ae-003": { createdAt: "2026-09-14T08:04:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-14T08:10:00Z", productIds: ["pr-ae-daily"] },
  "p-ae-004": { createdAt: "2026-09-15T07:30:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-09-15T07:35:00Z", productIds: ["pr-ae-glide"] },
  "p-ae-005": { createdAt: "2026-09-15T07:32:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-09-15T07:35:00Z", productIds: ["pr-ae-marathon"] },
  "p-ae-006": { createdAt: "2026-09-20T07:00:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-20T07:10:00Z", productIds: ["pr-ae-daily"] },
  "p-ae-007": { createdAt: "2026-11-17T10:20:00Z", createdBy: "Hira Malik" },
  "p-ae-008": { createdAt: "2026-11-18T08:00:00Z", createdBy: "Sana Iqbal" },
  "p-ae-009": { createdAt: "2026-09-14T08:06:00Z", createdBy: "Hira Malik", activatedAt: "2026-09-14T08:12:00Z" },
  "p-ae-010": { createdAt: "2026-11-18T09:10:00Z", createdBy: "Omar Farooq" },
  "p-uk-001": { createdAt: "2026-11-10T14:30:00Z", createdBy: "Hira Malik", activatedAt: "2026-11-10T14:40:00Z" },
  "p-uk-002": { createdAt: "2026-11-11T09:00:00Z", createdBy: "Hira Malik", activatedAt: "2026-11-11T09:05:00Z", productIds: ["pr-uk-rack"] },
  "p-uk-003": { createdAt: "2026-11-11T09:02:00Z", createdBy: "Hira Malik" },
  "p-uk-004": { createdAt: "2026-11-12T10:00:00Z", createdBy: "Sana Iqbal", productIds: ["pr-uk-dumbbell"] },
  "p-uk-005": { createdAt: "2026-11-10T14:35:00Z", createdBy: "Hira Malik", activatedAt: "2026-11-10T14:40:00Z", productIds: ["pr-uk-dumbbell"] },
  "p-uk-006": { createdAt: "2026-11-13T11:20:00Z", createdBy: "Omar Farooq", productIds: ["pr-uk-rower"] },
  "p-uk-007": { createdAt: "2026-11-11T09:10:00Z", createdBy: "Hira Malik", activatedAt: "2026-11-11T09:15:00Z", productIds: ["pr-uk-rack"] },
  "p-uk-008": { createdAt: "2026-11-17T15:00:00Z", createdBy: "Hira Malik" },
  "p-nu-001": { createdAt: "2026-10-06T09:00:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-10-06T09:30:00Z" },
  "p-nu-002": { createdAt: "2026-10-06T09:02:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-10-06T09:30:00Z", productIds: ["pr-nu-mealplan"] },
  "p-nu-003": { createdAt: "2026-10-06T09:04:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-10-06T09:30:00Z" },
  "p-nu-004": { createdAt: "2026-10-06T09:06:00Z", createdBy: "Hira Malik", activatedAt: "2026-10-06T09:30:00Z" },
  "p-nu-005": { createdAt: "2026-10-06T09:08:00Z", createdBy: "Hira Malik", activatedAt: "2026-10-06T09:30:00Z" },
  "p-nu-006": { createdAt: "2026-10-07T07:30:00Z", createdBy: "Omar Farooq", activatedAt: "2026-10-07T07:35:00Z", productIds: ["pr-nu-basics"] },
  "p-nu-007": { createdAt: "2026-10-07T07:32:00Z", createdBy: "Omar Farooq", activatedAt: "2026-10-07T07:35:00Z" },
  "p-nu-008": { createdAt: "2026-10-14T10:00:00Z", createdBy: "Hira Malik", activatedAt: "2026-10-14T10:10:00Z", productIds: ["pr-nu-basics"] },
  "p-nu-009": { createdAt: "2026-11-12T08:30:00Z", createdBy: "Hira Malik", productIds: ["pr-nu-newsletter"] },
  "p-nu-010": { createdAt: "2026-10-08T11:00:00Z", createdBy: "Sana Iqbal", activatedAt: "2026-10-08T11:05:00Z" },
  "p-nu-011": { createdAt: "2026-11-17T14:00:00Z", createdBy: "Omar Farooq", productIds: ["pr-nu-consult"] },
};

type EarlierVersion = { version: number; text: string; changedBy: string; changedAt: string; note: string | null };

/** Versions of edited prompts. The current version is the prompt's own text in shared.ts / this file. */
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
  "p-ae-006": [
    { version: 1, text: "Is the RunPro shoe good for running in Dubai heat?", changedBy: "Hira Malik", changedAt: "2026-09-20T07:00:00Z", note: null },
    { version: 2, text: "Is the RunPro Daily Trainer good for running in Dubai heat?", changedBy: "Omar Farooq", changedAt: "2026-10-01T09:30:00Z", note: "Named the product" },
  ],
  "p-ae-009": [
    { version: 1, text: "RunPro or SwiftStride for running in Dubai?", changedBy: "Hira Malik", changedAt: "2026-09-14T08:06:00Z", note: null },
    { version: 2, text: "RunPro vs SwiftStride for road running in Dubai", changedBy: "Omar Farooq", changedAt: "2026-09-15T10:00:00Z", note: "Limited to road running" },
  ],
  "p-nu-003": [
    { version: 1, text: "Nutrition or NourishWell for learning healthy eating?", changedBy: "Sana Iqbal", changedAt: "2026-10-06T09:04:00Z", note: null },
    { version: 2, text: "Nutrition vs NourishWell: which is better for beginners learning healthy eating?", changedBy: "Hira Malik", changedAt: "2026-10-27T09:00:00Z", note: "Added the beginner audience" },
  ],
  "p-nu-008": [
    { version: 1, text: "Is the Nutrition course good?", changedBy: "Hira Malik", changedAt: "2026-10-14T10:00:00Z", note: null },
    { version: 2, text: "Is the Nutrition Basics course worth it?", changedBy: "Omar Farooq", changedAt: "2026-11-03T08:30:00Z", note: "Named the course" },
  ],
  "p-nu-010": [
    { version: 1, text: "Nutrition or VitaPlate for meal prep ideas?", changedBy: "Sana Iqbal", changedAt: "2026-10-08T11:00:00Z", note: null },
    { version: 2, text: "Nutrition vs VitaPlate for weekly meal prep ideas", changedBy: "Hira Malik", changedAt: "2026-10-20T09:15:00Z", note: "Made the period explicit" },
  ],
  "p-uk-007": [
    { version: 1, text: "Are HomeFit racks sturdy?", changedBy: "Hira Malik", changedAt: "2026-11-11T09:10:00Z", note: null },
    { version: 2, text: "Are HomeFit folding racks sturdy enough for heavy lifting?", changedBy: "Omar Farooq", changedAt: "2026-11-12T13:30:00Z", note: "Made the question specific" },
  ],
};

/** Status changes that are not implied by creation or activation. */
export const PROMPT_STATUS_EVENTS: Record<string, { at: string; actor: string; title: string }> = {
  "p-010": { at: "2026-10-28T10:00:00Z", actor: "Hira Malik", title: "Paused" },
  "p-013": { at: "2026-10-28T10:00:00Z", actor: "Omar Farooq", title: "Paused" },
  "p-014": { at: "2026-10-28T10:00:00Z", actor: "Sana Iqbal", title: "Archived" },
  "p-ae-006": { at: "2026-10-02T09:00:00Z", actor: "Omar Farooq", title: "Paused" },
  "p-ae-009": { at: "2026-09-15T14:00:00Z", actor: "Omar Farooq", title: "Archived" },
  "p-uk-005": { at: "2026-11-12T16:00:00Z", actor: "Hira Malik", title: "Paused" },
  "p-uk-007": { at: "2026-11-13T10:00:00Z", actor: "Omar Farooq", title: "Paused" },
  "p-nu-008": { at: "2026-11-05T09:00:00Z", actor: "Hira Malik", title: "Paused" },
  "p-nu-010": { at: "2026-11-04T10:00:00Z", actor: "Sana Iqbal", title: "Archived" },
};

// ---------------------------------------------------------------------------
// runpro-ae and homefit-uk libraries
// ---------------------------------------------------------------------------

export const DEMO_EXTRA_GROUPS: PromptGroup[] = [
  { id: "g-ae-discovery", storeId: "runpro-ae", name: "Discovery" },
  { id: "g-ae-local", storeId: "runpro-ae", name: "Local" },
  { id: "g-ae-comparison", storeId: "runpro-ae", name: "Comparison" },
  { id: "g-ae-product", storeId: "runpro-ae", name: "Product" },
  { id: "g-uk-discovery", storeId: "homefit-uk", name: "Discovery" },
  { id: "g-uk-buying", storeId: "homefit-uk", name: "Buying guide" },
  { id: "g-uk-comparison", storeId: "homefit-uk", name: "Comparison" },
  { id: "g-nu-discovery", storeId: "nutrition", name: "Discovery" },
  { id: "g-nu-guides", storeId: "nutrition", name: "Guides" },
  { id: "g-nu-comparison", storeId: "nutrition", name: "Comparison" },
  { id: "g-nu-services", storeId: "nutrition", name: "Courses & services" },
];

const make =
  (storeId: string, brand: RegExp, defaultUpdatedAt: string, defaultTopic: string) =>
  (id: string, text: string, intent: PromptBase["intent"], groupId: string | null, extra: Partial<PromptBase> = {}): PromptBase => ({
    id,
    storeId,
    text,
    intent,
    topic: defaultTopic,
    groupId,
    status: "active",
    scope: "both",
    source: "manual",
    version: 1,
    isCore: false,
    mentionsBrand: brand.test(text),
    updatedAt: defaultUpdatedAt,
    ...extra,
  });

const ae = make("runpro-ae", /runpro/i, "2026-09-14T08:10:00Z", "Running shoes");
const uk = make("homefit-uk", /homefit/i, "2026-11-10T14:40:00Z", "Home gym");
// "Nutrition" is also an ordinary word, so a prompt names the brand only when it says "Nutrition vs", "Nutrition Basics" or "Nutrition course".
const nu = make("nutrition", /Nutrition (vs|or|Basics|course)/, "2026-10-06T09:30:00Z", "Nutrition basics");

export const DEMO_EXTRA_PROMPTS: PromptBase[] = [
  // runpro-ae: five active prompts. They are the only prompts in the generated runs and audits.
  ae("p-ae-001", "What are the best running shoe brands in the UAE?", "discovery", "g-ae-discovery", { isCore: true, topic: "Category" }),
  ae("p-ae-002", "Where can I buy running shoes in Dubai?", "local_market", "g-ae-local", { isCore: true, topic: "Buying locally" }),
  ae("p-ae-003", "Which running shoes are best for hot weather?", "recommendation", "g-ae-discovery", { topic: "Climate", source: "ai_generated" }),
  ae("p-ae-004", "RunPro vs Brand X running shoes in the UAE", "comparison", "g-ae-comparison", { topic: "Comparison", updatedAt: "2026-09-15T07:35:00Z" }),
  ae("p-ae-005", "Best marathon running shoes available in Abu Dhabi?", "local_market", "g-ae-local", { topic: "Long distance", updatedAt: "2026-09-15T07:35:00Z" }),
  // runpro-ae: prompts in other states. None of them ran in an audit or monitoring run.
  ae("p-ae-006", "Is the RunPro Daily Trainer good for running in Dubai heat?", "product_service", "g-ae-product", { status: "paused", version: 2, topic: "Hot weather", updatedAt: "2026-10-02T09:00:00Z" }),
  ae("p-ae-007", "Which running shoes handle summer humidity in Abu Dhabi?", "recommendation", "g-ae-discovery", { status: "draft", topic: "Climate", source: "ai_generated", scope: "audit", updatedAt: "2026-11-17T10:20:00Z" }),
  ae("p-ae-008", "Do RunPro shoes ship to Sharjah and Ajman?", "local_market", "g-ae-local", { status: "draft", topic: "Delivery", source: "imported", scope: "monitoring", updatedAt: "2026-11-18T08:00:00Z" }),
  ae("p-ae-009", "RunPro vs SwiftStride for road running in Dubai", "comparison", "g-ae-comparison", { status: "archived", version: 2, topic: "Road running", updatedAt: "2026-09-15T14:00:00Z" }),
  ae("p-ae-010", "What are good alternatives to GulfRun running shoes?", "alternative", null, { status: "draft", topic: "Alternatives", source: "template", updatedAt: "2026-11-18T09:10:00Z" }),

  // homefit-uk: setup in progress. No AI channel is selected, so nothing here is tracked yet.
  uk("p-uk-001", "What are the best home gym equipment brands in the UK?", "discovery", "g-uk-discovery", { isCore: true, topic: "Category" }),
  uk("p-uk-002", "Which foldable squat rack suits a small flat?", "recommendation", "g-uk-buying", { topic: "Small spaces", source: "ai_generated", updatedAt: "2026-11-11T09:05:00Z" }),
  uk("p-uk-003", "What home gym equipment fits in a spare bedroom?", "informational", "g-uk-buying", { status: "draft", topic: "Small spaces", source: "ai_generated", updatedAt: "2026-11-11T09:02:00Z" }),
  uk("p-uk-004", "HomeFit versus IronNest: which adjustable dumbbells are better?", "comparison", "g-uk-comparison", { status: "draft", topic: "Dumbbells", updatedAt: "2026-11-12T10:00:00Z" }),
  uk("p-uk-005", "Where can I buy adjustable dumbbells in London?", "local_market", "g-uk-buying", { status: "paused", topic: "Buying locally", updatedAt: "2026-11-12T16:00:00Z" }),
  uk("p-uk-006", "Best compact rowing machines under £500 in the UK?", "recommendation", "g-uk-buying", { status: "draft", topic: "Price", source: "imported", scope: "monitoring", updatedAt: "2026-11-13T11:20:00Z" }),
  uk("p-uk-007", "Are HomeFit folding racks sturdy enough for heavy lifting?", "product_service", null, { status: "paused", version: 2, topic: "Durability", updatedAt: "2026-11-13T10:00:00Z" }),
  uk("p-uk-008", "What are good alternatives to FlexForm home gym machines?", "alternative", "g-uk-comparison", { status: "draft", topic: "Alternatives", source: "template", scope: "audit", updatedAt: "2026-11-17T15:00:00Z" }),

  // nutrition (demo informational website): seven active prompts. They are the only prompts in the generated runs and audits.
  nu("p-nu-001", "What are the best websites for reliable nutrition advice?", "discovery", "g-nu-discovery", { isCore: true, topic: "Trusted sources" }),
  nu("p-nu-002", "How do I build a balanced weekly meal plan?", "informational", "g-nu-guides", { isCore: true, topic: "Meal planning" }),
  nu("p-nu-003", "Nutrition vs NourishWell: which is better for beginners learning healthy eating?", "comparison", "g-nu-comparison", { isCore: true, version: 2, topic: "Beginners", updatedAt: "2026-10-27T09:00:00Z" }),
  nu("p-nu-004", "Which nutrition websites explain macros clearly for beginners?", "recommendation", "g-nu-guides", { topic: "Macros" }),
  nu("p-nu-005", "What are good alternatives to BalancedBite for meal-planning guidance?", "alternative", "g-nu-comparison", { topic: "Alternatives", source: "ai_generated" }),
  nu("p-nu-006", "Where can I take a free nutrition basics course online?", "product_service", "g-nu-services", { topic: "Courses", source: "ai_generated", updatedAt: "2026-10-07T07:35:00Z" }),
  nu("p-nu-007", "How much protein do I need each day?", "informational", "g-nu-guides", { topic: "Protein", source: "imported", updatedAt: "2026-10-07T07:35:00Z" }),
  // nutrition: prompts in other states. None of them ran in an audit or monitoring run since they were paused, archived or created.
  nu("p-nu-008", "Is the Nutrition Basics course worth it?", "product_service", "g-nu-services", { status: "paused", version: 2, topic: "Courses", updatedAt: "2026-11-05T09:00:00Z" }),
  nu("p-nu-009", "Which nutrition newsletters are worth subscribing to?", "discovery", "g-nu-discovery", { status: "draft", topic: "Newsletters", source: "ai_generated", scope: "audit", updatedAt: "2026-11-12T08:30:00Z" }),
  nu("p-nu-010", "Nutrition vs VitaPlate for weekly meal prep ideas", "comparison", "g-nu-comparison", { status: "archived", version: 2, topic: "Meal prep", updatedAt: "2026-11-04T10:00:00Z" }),
  nu("p-nu-011", "Where can I find a registered dietitian in Singapore?", "local_market", null, { status: "draft", topic: "Buying locally", source: "imported", scope: "monitoring", updatedAt: "2026-11-17T14:00:00Z" }),
];

// ---------------------------------------------------------------------------
// Website profiles and templates (AI suggestions are built from the profile in features/prompts/suggestions.ts)
// ---------------------------------------------------------------------------

export type WebsiteProfile = { category: string; item: string; city: string; need: string; /** Phrase for the brands of the category. Defaults to "<category> brands". */ brands?: string };

export const STORE_PROFILES: Record<string, WebsiteProfile> = {
  "runpro-pk": { category: "running shoes", item: "running shoe", city: "Lahore", need: "flat feet" },
  "runpro-ae": { category: "running shoes", item: "running shoe", city: "Dubai", need: "hot weather" },
  "homefit-uk": { category: "home gym equipment", item: "home gym machine", city: "London", need: "small spaces" },
  nutrition: { category: "nutrition websites", brands: "nutrition websites and brands", item: "nutrition information", city: "Singapore", need: "meal planning" },
};

const FALLBACK_PROFILE: WebsiteProfile = { category: "products", item: "product", city: "your city", need: "everyday use" };

export const profileFor = (storeId: string): WebsiteProfile => STORE_PROFILES[storeId] ?? FALLBACK_PROFILE;

/** Organization-level templates. Placeholders are filled from the website profile. */
export const DEMO_TEMPLATES: PromptTemplate[] = [
  { id: "t-brands", title: "Best brands in a market", text: "What are the best {brands} in {market}?", intent: "discovery", topic: "Category" },
  { id: "t-recommend", title: "Affordable recommendation", text: "Which affordable {category} would you recommend?", intent: "recommendation", topic: "Everyday use" },
  { id: "t-versus", title: "Brand versus competitor", text: "{brand} versus {competitor}: which is better for everyday use?", intent: "comparison", topic: "Comparison" },
  { id: "t-alternative", title: "Alternatives to a competitor", text: "What are good alternatives to {competitor}?", intent: "alternative", topic: "Alternatives" },
  { id: "t-local", title: "Find locally", text: "Where can I find {category} in {city}?", intent: "local_market", topic: "Buying locally" },
  { id: "t-guide", title: "How to choose", text: "How do I choose the right {category}?", intent: "informational", topic: "Buying guide" },
];
