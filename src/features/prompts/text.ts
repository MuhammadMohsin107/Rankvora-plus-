/**
 * Client-safe prompt text helpers: normalisation, near-duplicate detection and
 * validation limits. Written here (not imported from the backend prompt library)
 * so they can run in the browser.
 */
import type { PromptStatus } from "@/types/core";

export const MIN_PROMPT_LENGTH = 8;
export const MAX_PROMPT_LENGTH = 300;
/** Word-overlap score at or above which a prompt is flagged as a near-duplicate. */
export const NEAR_DUPLICATE_THRESHOLD = 0.8;

const STOP_WORDS = new Set(["a", "an", "the", "are", "is", "what", "which", "would", "you", "me", "i", "do", "does", "should", "please", "of", "to"]);

/** Lower-case, strip punctuation and collapse whitespace. */
export function normalisePrompt(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  return new Set(normalisePrompt(text).split(" ").filter((word) => word && !STOP_WORDS.has(word)));
}

/** Jaccard overlap of meaningful words, 0–1. */
export function similarity(a: string, b: string): number {
  const left = wordSet(a);
  const right = wordSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

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

export function validatePromptText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "Enter the prompt text.";
  if (trimmed.length < MIN_PROMPT_LENGTH) return `Use at least ${MIN_PROMPT_LENGTH} characters.`;
  if (trimmed.length > MAX_PROMPT_LENGTH) return `Keep it under ${MAX_PROMPT_LENGTH} characters.`;
  return null;
}

/** Fills {brand} {category} {market} {city} {competitor} placeholders. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
