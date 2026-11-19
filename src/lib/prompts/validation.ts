import { z } from "zod";

import {
  promptIntent,
  promptSource,
  promptStatus,
  promptTrackingScope,
} from "@/db/schema";
import {
  language,
  market,
  optionalText,
  requiredText,
  uuid,
} from "@/lib/tenancy/validation";

import { normalizePromptText } from "./text";

export const PROMPT_MAX_LENGTH = 1000;
export const IMPORT_MAX_ROWS = 500;

// The exact question that will be sent to an AI channel. Kept as typed (only
// trimmed) because the wording is what is being measured.
const promptText = z
  .string()
  .trim()
  .max(PROMPT_MAX_LENGTH, `Keep prompts under ${PROMPT_MAX_LENGTH} characters.`)
  .refine(
    (value) => normalizePromptText(value) !== "",
    "A prompt needs some words.",
  );

const intent = z.enum(promptIntent.enumValues);
const status = z.enum(promptStatus.enumValues);
const trackingScope = z.enum(promptTrackingScope.enumValues);

const productIds = z
  .array(uuid)
  .max(50)
  .transform((ids) => [...new Set(ids)]);

export const createPromptInput = z.object({
  text: promptText,
  intent,
  topic: optionalText(120),
  groupId: uuid.nullable().optional(),
  language: language.optional(),
  country: market.optional(),
  isCore: z.boolean().default(false),
  creationSource: z.enum(promptSource.enumValues).default("manual"),
  status: status.default("draft"),
  trackingScope: trackingScope.default("both"),
  productIds: productIds.optional(),
});

export const updatePromptInput = z
  .object({
    text: promptText,
    intent,
    topic: optionalText(120),
    groupId: uuid.nullable(),
    language,
    country: market,
    isCore: z.boolean(),
    trackingScope,
    productIds,
  })
  .partial();

export const promptStatusInput = status;

export const listPromptsInput = z.object({
  status: z.array(status).optional(),
  intent: intent.optional(),
  groupId: uuid.nullable().optional(),
  trackingScope: trackingScope.optional(),
  isCore: z.boolean().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

export const promptGroupInput = z.object({
  name: requiredText(80),
  description: optionalText(500),
});

export const updatePromptGroupInput = promptGroupInput.partial();

export const createTemplateInput = z.object({
  organizationId: uuid,
  text: promptText,
  intent,
  topic: optionalText(120),
  language,
});

export const copyTemplateInput = z.object({
  groupId: uuid.nullable().optional(),
  country: market.optional(),
  status: status.default("draft"),
  trackingScope: trackingScope.default("both"),
});

// --- CSV import -----------------------------------------------------------

const csvBoolean = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value, ctx) => {
    if (value === "" || ["false", "no", "0", "n"].includes(value)) return false;
    if (["true", "yes", "1", "y"].includes(value)) return true;
    ctx.addIssue({ code: "custom", message: "Use true or false." });
    return z.NEVER;
  });

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// One CSV row. Intent is required: guessing it would silently mislabel data.
export const importRowInput = z.object({
  prompt_text: promptText,
  intent: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    intent,
  ),
  topic: z.preprocess(blankToUndefined, optionalText(120)),
  group: z.preprocess(blankToUndefined, requiredText(80).optional()),
  language: z.preprocess(blankToUndefined, language.optional()),
  country: z.preprocess(blankToUndefined, market.optional()),
  status: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== ""
        ? value.trim().toLowerCase()
        : undefined,
    status.default("draft"),
  ),
  tracking_scope: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() !== ""
        ? value.trim().toLowerCase()
        : undefined,
    trackingScope.default("both"),
  ),
  is_core: z.preprocess(blankToUndefined, csvBoolean.optional()),
});

export const importPromptsInput = z.object({
  csv: z.string().max(2_000_000),
  dryRun: z.boolean().default(false),
});
