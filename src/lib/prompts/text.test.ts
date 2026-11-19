import { describe, expect, it } from "vitest";

import {
  findSimilarPrompts,
  hashPromptText,
  normalizePromptText,
  promptSimilarity,
  referencesBrand,
} from "./text";

describe("normalizePromptText", () => {
  it("ignores case, punctuation and extra whitespace", () => {
    expect(
      normalizePromptText(
        "  What are the BEST running shoes, for beginners?? ",
      ),
    ).toBe("what are the best running shoes for beginners");
  });

  it("keeps letters and digits from other scripts", () => {
    expect(normalizePromptText("بہترین جوتے کون سے ہیں؟")).toBe(
      "بہترین جوتے کون سے ہیں",
    );
    expect(normalizePromptText("Top 10 shoes")).toBe("top 10 shoes");
  });

  it("returns an empty string when only punctuation is given", () => {
    expect(normalizePromptText("?!...")).toBe("");
  });
});

describe("hashPromptText", () => {
  it("is equal for prompts that differ only in case or punctuation", () => {
    expect(hashPromptText("Best shoes?")).toBe(
      hashPromptText("  best   SHOES "),
    );
  });

  it("differs when the wording differs", () => {
    expect(hashPromptText("best shoes")).not.toBe(
      hashPromptText("best sandals"),
    );
  });
});

describe("promptSimilarity", () => {
  it("is 1 for the same words in any case", () => {
    expect(promptSimilarity("Best running shoes", "best RUNNING shoes?")).toBe(
      1,
    );
  });

  it("is 0 when nothing is shared or a side is empty", () => {
    expect(promptSimilarity("alpha beta", "gamma delta")).toBe(0);
    expect(promptSimilarity("", "something")).toBe(0);
    expect(promptSimilarity("?!", "?!")).toBe(0);
  });

  it("is high for a one-word variation and low for a different question", () => {
    expect(
      promptSimilarity(
        "which running shoes are best for beginners in lahore",
        "which running shoes are best for beginners in karachi",
      ),
    ).toBeGreaterThan(0.7);
    expect(
      promptSimilarity("best running shoes", "how do i clean white sneakers"),
    ).toBeLessThan(0.2);
  });
});

describe("findSimilarPrompts", () => {
  const existing = [
    { id: "1", text: "What are the best running shoes for beginners?" },
    { id: "2", text: "How do I wash a yoga mat?" },
    { id: "3", text: "What are the best running shoes for beginners today" },
  ];

  it("returns close matches, most similar first, and ignores unrelated ones", () => {
    const result = findSimilarPrompts(
      "what are the best running shoes for beginners",
      existing,
    );
    expect(result.map((r) => r.id)).toEqual(["1", "3"]);
    expect(result[0].similarity).toBe(1);
  });

  it("respects the threshold and limit", () => {
    expect(
      findSimilarPrompts(
        "what are the best running shoes for beginners",
        existing,
        {
          threshold: 1,
        },
      ).map((r) => r.id),
    ).toEqual(["1"]);
    expect(
      findSimilarPrompts(
        "what are the best running shoes for beginners",
        existing,
        {
          limit: 1,
        },
      ),
    ).toHaveLength(1);
  });
});

describe("referencesBrand", () => {
  it("matches whole words and aliases only", () => {
    expect(referencesBrand("Is RunPro good for beginners?", ["RunPro"])).toBe(
      true,
    );
    expect(referencesBrand("RunPro vs Brand X", ["Run Pro", "runpro"])).toBe(
      true,
    );
    expect(referencesBrand("Best shoes for beginners", ["RunPro"])).toBe(false);
  });

  it("does not match inside a longer word", () => {
    expect(referencesBrand("Is runproof gear worth it?", ["RunPro"])).toBe(
      false,
    );
  });

  it("ignores blank names", () => {
    expect(referencesBrand("anything", ["", "  "])).toBe(false);
  });
});
