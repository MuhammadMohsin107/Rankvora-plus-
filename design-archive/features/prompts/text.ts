/**
 * Prompt text helpers for the screens. The wording rules live in `@/lib/prompt-text`, shared with
 * the backend, so both agree on what a duplicate is.
 */
import { MIN_PROMPT_LENGTH, NEAR_DUPLICATE_THRESHOLD, normalisePrompt, similarity } from "@/lib/prompt-text";
import type { PromptStatus } from "@/types/core";

export { MAX_PROMPT_LENGTH, MIN_PROMPT_LENGTH, NEAR_DUPLICATE_THRESHOLD, normalisePrompt, similarity, validatePromptText } from "@/lib/prompt-text";

export type DuplicateMatch = { id: string; text: string; status: PromptStatus | null; kind: "exact" | "near" };

type Comparable = { id: string; text: string; status?: PromptStatus };

/** Best match among existing prompts. Near-duplicates warn but never block variants. */
export function findDuplicate(text: string, existing: Comparable[]): DuplicateMatch | null {
  const normalised = normalisePrompt(text);
  if (normalised.length < MIN_PROMPT_LENGTH) return null;
  let best: DuplicateMatch | null = null;
  let bestScore = 0;
  for (const other of existing) {
    if (normalisePrompt(other.text) === normalised) return { id: other.id, text: other.text, status: other.status ?? null, kind: "exact" };
    const score = similarity(text, other.text);
    if (score >= NEAR_DUPLICATE_THRESHOLD && score > bestScore) {
      best = { id: other.id, text: other.text, status: other.status ?? null, kind: "near" };
      bestScore = score;
    }
  }
  return best;
}

/** True when the wording names the brand (brand-specific rather than neutral). */
export function namesBrand(text: string, brand: string): boolean {
  return brand.trim() !== "" && text.toLowerCase().includes(brand.trim().toLowerCase());
}

/** Fills {brand} {category} {market} {city} {competitor} placeholders. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
