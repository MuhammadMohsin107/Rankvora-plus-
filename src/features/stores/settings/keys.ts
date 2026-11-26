/** demo-state keys for one website's settings. Every tab saves under its own key. */
export type WebsiteSettingPart = "brand" | "knowledge" | "competitors" | "products" | "integrations" | "domains" | "notifications" | "activity" | "tracking";

export const WEBSITE_SETTING_PARTS: readonly WebsiteSettingPart[] = ["brand", "knowledge", "competitors", "products", "integrations", "domains", "notifications", "activity", "tracking"];

export const settingKey = (websiteId: string, part: WebsiteSettingPart): string => `website.${websiteId}.${part}`;
