import type { AiChannel, PromptIntent, PromptScope, PromptSource, Role, SearchMode, StorePlatform } from "@/types/core";

export const INTENT_LABEL: Record<PromptIntent, string> = {
  discovery: "Discovery",
  recommendation: "Recommendation",
  comparison: "Comparison",
  alternative: "Alternative",
  product_service: "Product / service",
  local_market: "Local / market",
  informational: "Informational",
};

export const SCOPE_LABEL: Record<PromptScope, string> = { audit: "Audit only", monitoring: "Monitoring only", both: "Audit + Monitoring" };

export const SOURCE_LABEL: Record<PromptSource, string> = {
  manual: "Manual",
  ai_generated: "AI-generated",
  imported: "Imported",
  research_derived: "Research-derived",
  template: "Template",
};

export const PLATFORM_LABEL: Record<StorePlatform, string> = {
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  wordpress: "WordPress",
  webflow: "Webflow",
  custom: "Custom website",
  manual: "Manual",
};

export const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  model_only: "Model only",
  web_grounded_required: "Web search required",
  web_grounded_auto: "Web search (auto)",
};

export const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", auditor: "Auditor", viewer: "Viewer" };

export const CITATION_SOURCE_LABEL = { owned: "Owned domain", competitor: "Competitor domain", third_party: "Third-party" } as const;

/** Honest channel label: provider API / model / search setting — never "exact ChatGPT result". */
export function channelLabel(channel: Pick<AiChannel, "providerLabel" | "apiLabel" | "model" | "searchMode">): string {
  return `${channel.providerLabel} API · ${channel.model} · ${SEARCH_MODE_LABEL[channel.searchMode]}`;
}

export function shortChannelLabel(channel: Pick<AiChannel, "providerLabel" | "model">): string {
  return `${channel.providerLabel} · ${channel.model}`;
}
