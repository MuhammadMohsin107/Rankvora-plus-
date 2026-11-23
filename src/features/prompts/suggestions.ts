/**
 * Demo prompt suggestions. Built from the website profile with fixed templates: no model runs and
 * nothing leaves the browser. Every screen that shows them labels them "Demo suggestions".
 * Pure functions, safe on the client.
 */
import type { PromptIntent } from "@/types/core";
import type { PromptSuggestion, TemplateProfile } from "@/types/prompts";

export type SuggestionSource = "profile" | "competitors" | "search_console";

export const SUGGESTION_SOURCE_LABEL: Record<SuggestionSource, string> = {
  profile: "Website profile",
  competitors: "Competitor angles",
  search_console: "Search Console ideas",
};

function make(id: string, text: string, intent: PromptIntent, topic: string, brand: string): PromptSuggestion {
  return { id, text, intent, topic, brandSpecific: brand.trim() !== "" && text.toLowerCase().includes(brand.trim().toLowerCase()) };
}

/** Two batches of six profile suggestions (regenerate moves to the next batch). */
export function profileSuggestionBatches(profile: TemplateProfile): PromptSuggestion[][] {
  const { brand, competitor, category, brands, item, city, need, market } = profile;
  const place = market || "your market";
  const name = brand || "the brand";
  return [
    [
      make("s-1", `What are the best ${brands} in ${place}?`, "discovery", "Category", brand),
      make("s-2", `Which ${category} would you recommend for beginners?`, "recommendation", "Beginners", brand),
      make("s-3", `Where can I find ${category} in ${city}?`, "local_market", "Local", brand),
      make("s-4", `How should I choose ${category}?`, "informational", "Selection guide", brand),
      make("s-5", `${name} versus ${competitor}: which is better for everyday use?`, "comparison", "Comparison", brand),
      make("s-6", `Is ${name} a good ${item} brand?`, "product_service", "Brand", brand),
    ],
    [
      make("s-7", `What are good alternatives to ${competitor}?`, "alternative", "Alternatives", brand),
      make("s-8", `Best low-cost ${category} in ${place}?`, "recommendation", "Cost", brand),
      make("s-9", `Which ${brands} operate across ${place}?`, "discovery", "Coverage", brand),
      make("s-10", `What should I look for in ${category} for ${need}?`, "informational", "Fit", brand),
      make("s-11", `Is ${name} reliable for ${category}?`, "product_service", "Reliability", brand),
      make("s-12", `Top-rated ${brands} in ${city}`, "discovery", "Local", brand),
    ],
  ];
}

/** Comparison and alternative angles built from the confirmed competitors. Inspiration only, never copied content. */
export function competitorSuggestions(profile: TemplateProfile, competitors: string[]): PromptSuggestion[] {
  const { brand, category, market } = profile;
  const name = brand || "the brand";
  const place = market || "your market";
  const list = competitors.length > 0 ? competitors : [profile.competitor];
  const out: PromptSuggestion[] = [];
  list.slice(0, 3).forEach((competitor, index) => {
    out.push(make(`c-${index}-versus`, `${name} versus ${competitor} for ${category}: which is better?`, "comparison", "Comparison", brand));
    out.push(make(`c-${index}-alt`, `What are good alternatives to ${competitor} in ${place}?`, "alternative", "Alternatives", brand));
  });
  return out;
}

/** The suggestion list for a source. Search Console ideas need a connection and are never invented. */
export function suggestionsFor(source: SuggestionSource, profile: TemplateProfile, competitors: string[], batch: number): PromptSuggestion[] {
  if (source === "competitors") return competitorSuggestions(profile, competitors);
  if (source === "search_console") return [];
  const batches = profileSuggestionBatches(profile);
  return batches[batch % batches.length] ?? [];
}

export const suggestionBatchCount = 2;
