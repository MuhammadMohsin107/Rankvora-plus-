/** Prompt wording rules shared by the screens and the backend. Pure: no I/O. */

export const MIN_PROMPT_LENGTH = 8;
export const MAX_PROMPT_LENGTH = 300;
/** Word-overlap score at or above which a prompt is flagged as a near-duplicate. */
export const NEAR_DUPLICATE_THRESHOLD = 0.8;

const STOP_WORDS = new Set(["a", "an", "the", "are", "is", "what", "which", "would", "you", "me", "i", "do", "does", "should", "please", "of", "to"]);

/**
 * Lower-case, punctuation removed, whitespace collapsed. Combining marks are kept: in many scripts
 * (Hindi, Thai) they are letters in all but name, and dropping them would make different prompts equal.
 */
export function normalisePrompt(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordSet(text: string): Set<string> {
  return new Set(normalisePrompt(text).split(" ").filter((word) => word && !STOP_WORDS.has(word)));
}

/** Jaccard overlap of two word sets, 0–1. */
export function overlap(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Jaccard overlap of meaningful words, 0–1. */
export function similarity(a: string, b: string): number {
  return overlap(wordSet(a), wordSet(b));
}

/** True when the wording names any of the names as whole words ("Tetra" does not match "tetralogy"). */
export function mentionsAnyName(text: string, names: readonly string[]): boolean {
  const haystack = ` ${normalisePrompt(text)} `;
  return names.some((name) => {
    const needle = normalisePrompt(name);
    return needle !== "" && haystack.includes(` ${needle} `);
  });
}

export function validatePromptText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "Enter the prompt text.";
  if (trimmed.length < MIN_PROMPT_LENGTH) return `Use at least ${MIN_PROMPT_LENGTH} characters.`;
  if (trimmed.length > MAX_PROMPT_LENGTH) return `Keep it under ${MAX_PROMPT_LENGTH} characters.`;
  return null;
}
