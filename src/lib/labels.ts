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

/**
 * User-facing wording. Internal ids and routes keep their old names (`store`, `/stores/...`);
 * only what a person reads says "Website".
 */
export const TERM = {
  website: "Website",
  websites: "Websites & Brands",
  websiteProfile: "Website profile",
  websiteSettings: "Website settings",
  selectWebsite: "Select website",
  addWebsite: "Add website",
  siteType: "Site type",
} as const;

/**
 * Site type labels (display only; enum ids are unchanged). Shopify is one option among many.
 * Keyed by the StorePlatform enum.
 */
export const PLATFORM_LABEL: Record<StorePlatform, string> = {
  wordpress: "WordPress",
  woocommerce: "WooCommerce",
  webflow: "Webflow",
  wix: "Wix",
  squarespace: "Squarespace",
  shopify: "Shopify",
  custom: "Custom / other",
  manual: "Manual",
};

export const EXTRA_SITE_TYPE_LABEL = { wix: "Wix", squarespace: "Squarespace" } as const;

/** Neutral picker order: content and site builders first, commerce connectors after, then custom and manual. */
export const SITE_TYPE_ORDER = ["wordpress", "webflow", "wix", "squarespace", "woocommerce", "shopify", "custom", "manual"] as const;

export function siteTypeLabel(id: string): string {
  return (PLATFORM_LABEL as Record<string, string>)[id] ?? (EXTRA_SITE_TYPE_LABEL as Record<string, string>)[id] ?? id;
}

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
