import { COUNTRIES, LANGUAGES } from "@/features/stores/options";
import type { PromptIntent, PromptScope, PromptStatus } from "@/types/core";
import type { StoreContext } from "@/types/prompts";

export type ManualForm = {
  text: string;
  intent: PromptIntent;
  topic: string;
  groupId: string;
  market: string;
  language: string;
  scope: PromptScope;
  status: Extract<PromptStatus, "draft" | "active" | "paused">;
  productIds: string[];
  isCore: boolean;
};

export function initialForm(store: StoreContext): ManualForm {
  return { text: "", intent: "discovery", topic: "", groupId: "", market: store.market, language: store.language, scope: "both", status: "draft", productIds: [], isCore: false };
}

/** Same country and language lists as the website forms, so a prompt can never use a market the website cannot. */
export const MARKET_OPTIONS = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

export const LANGUAGE_OPTIONS = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));

/** State of the AI suggestions tab, kept by the parent so switching tabs loses nothing. */
export type AiState = {
  batch: number;
  /** Suggestion ids hidden by the user. */
  dismissed: string[];
  /** Suggestion id -> id of the prompt created from it. */
  accepted: Record<string, string>;
  loading: boolean;
};
