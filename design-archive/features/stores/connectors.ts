import type { StorePlatform } from "@/types/core";
import type { IntegrationScope } from "@/types/settings";

/**
 * Optional connectors a website can use to publish approved fixes. None is required and none is assumed:
 * a website without one gets guidance-only fixes. Authorization in this demo is always simulated.
 */
export const CONNECTOR_OPTIONS = ["wordpress", "webflow", "wix", "woocommerce", "shopify"] as const satisfies readonly StorePlatform[];
export type ConnectorChoice = (typeof CONNECTOR_OPTIONS)[number];

export const CONNECTOR_NOTE: Record<ConnectorChoice, string> = {
  wordpress: "Stage and publish approved page changes.",
  webflow: "Update pages and collections after approval.",
  wix: "Update pages after approval.",
  woocommerce: "Read products and publish approved changes.",
  shopify: "Read products and publish approved changes.",
};

const READ_ONLY: IntegrationScope = { scope: "read", purpose: "Read pages and content", granted: true };
const WRITE: IntegrationScope = { scope: "write", purpose: "Stage and publish approved changes", granted: true };

/** Simulated result of authorizing a connector. Real scopes would come from the connector at run time. */
export function simulatedScopes(platform: StorePlatform): IntegrationScope[] {
  if (platform === "shopify") {
    return [
      { scope: "read_products", purpose: "Read the product catalogue", granted: true },
      { scope: "read_content", purpose: "Read pages and articles", granted: true },
      { scope: "write_content", purpose: "Stage and publish approved page changes", granted: false },
    ];
  }
  if (platform === "manual" || platform === "custom") return [];
  return [READ_ONLY, WRITE];
}

/** Account label shown after a simulated connection. */
export function simulatedAccount(platform: StorePlatform, host: string): string {
  return platform === "shopify" ? `${host.split(".")[0]}.myshopify.com` : host;
}
