import { createHash } from "node:crypto";

/**
 * Lowercases, removes punctuation and collapses whitespace so that trivially
 * different spellings of the same question compare equal. Letters, marks and
 * digits from any script are kept (marks matter for Urdu, Hindi and others).
 */
export function normalizePromptText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

/** Stable hash of the normalized text, used to block exact duplicates. */
export function hashPromptText(text: string): string {
  return createHash("sha256").update(normalizePromptText(text)).digest("hex");
}

function tokens(text: string): Set<string> {
  const normalized = normalizePromptText(text);
  return new Set(normalized ? normalized.split(" ") : []);
}

/**
 * Word-overlap similarity between two prompts, from 0 (nothing shared) to 1
 * (same words). Used to warn about near-duplicates; it never blocks a save,
 * because intentional wording variants are allowed.
 */
export function promptSimilarity(a: string, b: string): number {
  const first = tokens(a);
  const second = tokens(b);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const word of first) if (second.has(word)) shared += 1;
  return shared / (first.size + second.size - shared);
}

export type SimilarPrompt = { id: string; text: string; similarity: number };

/** Existing prompts that are close to `candidate`, most similar first. */
export function findSimilarPrompts(
  candidate: string,
  existing: readonly { id: string; text: string }[],
  options: { threshold?: number; limit?: number } = {},
): SimilarPrompt[] {
  const threshold = options.threshold ?? 0.8;
  const limit = options.limit ?? 5;
  return existing
    .map((item) => ({
      id: item.id,
      text: item.text,
      similarity: promptSimilarity(candidate, item.text),
    }))
    .filter((item) => item.similarity >= threshold)
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, limit);
}

/**
 * True if the prompt names the brand (or one of its aliases) as whole words.
 * Used to check the library is not made up only of brand-name prompts.
 */
export function referencesBrand(
  text: string,
  brandNames: readonly string[],
): boolean {
  const haystack = ` ${normalizePromptText(text)} `;
  return brandNames.some((name) => {
    const needle = normalizePromptText(name);
    return needle !== "" && haystack.includes(` ${needle} `);
  });
}
