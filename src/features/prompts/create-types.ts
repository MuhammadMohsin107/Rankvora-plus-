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

/** A prompt added during this session (demo only: nothing is persisted). */
export type SessionPrompt = { id: string; text: string };

export const MARKET_OPTIONS = [
  { value: "PK", label: "Pakistan" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "GB", label: "United Kingdom" },
  { value: "US", label: "United States" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "IN", label: "India" },
];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
];

/** State of the AI suggestions tab, kept by the parent so switching tabs loses nothing. */
export type AiState = {
  batch: number;
  dismissed: string[];
  /** Suggestion id → the text that was added. */
  accepted: Record<string, string>;
  loading: boolean;
};
