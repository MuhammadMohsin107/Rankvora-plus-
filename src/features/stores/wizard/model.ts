import type { StorePlatform } from "@/types/core";

import { normalizeWebsite, validateRequired } from "../validation";

export type TrackingMode = "model_only" | "web_grounded" | "both";
export type ConnectionMethod = "manual" | "shopify";
export type ShopifyState = "idle" | "authorizing" | "authorized";
export type CompetitorState = "confirmed" | "suggested" | "dismissed";

export type WizardProduct = { id: string; title: string; category: string; url: string };
export type WizardCompetitor = { id: string; name: string; domain: string; reason: string; state: CompetitorState };

export type WizardForm = {
  name: string;
  website: string;
  platform: StorePlatform;
  connection: ConnectionMethod;
  shopifyState: ShopifyState;
  brandName: string;
  aliases: string[];
  industry: string;
  description: string;
  country: string;
  language: string;
  timezone: string;
  productSource: "manual" | "shopify";
  products: WizardProduct[];
  /** Ids of sample Shopify products ticked for import. */
  shopifySelected: string[];
  competitors: WizardCompetitor[];
  channelIds: string[];
  trackingMode: TrackingMode;
};

export const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "connection", label: "Connection" },
  { id: "brand", label: "Brand and market" },
  { id: "products", label: "Products" },
  { id: "competitors", label: "Competitors" },
  { id: "channels", label: "Channels and review" },
] as const;

export const LAST_STEP = STEPS.length - 1;

export type Errors = Record<string, string>;

/** Required-field errors for one step. Empty object = step complete. */
export function stepErrors(step: number, form: WizardForm): Errors {
  const errors: Errors = {};
  if (step === 0) {
    const name = validateRequired(form.name, "Store name", 2, 80);
    if (name) errors.name = name;
    const site = normalizeWebsite(form.website);
    if (site.error) errors.website = site.error;
  }
  if (step === 1) {
    if (form.connection === "shopify" && form.shopifyState !== "authorized") errors.connection = "Authorize Shopify, or choose Manual.";
  }
  if (step === 2) {
    const brand = validateRequired(form.brandName, "Brand name", 2, 80);
    if (brand) errors.brandName = brand;
    if (!form.industry) errors.industry = "Choose an industry.";
    if (!form.country) errors.country = "Choose a country.";
    if (!form.language) errors.language = "Choose a language.";
    if (!form.timezone) errors.timezone = "Choose a time zone.";
    if (form.description.length > 400) errors.description = "Keep the description to 400 characters.";
  }
  if (step === LAST_STEP) {
    if (form.channelIds.length === 0) errors.channels = "Choose at least one AI channel.";
  }
  return errors;
}

export type ChecklistItem = { id: string; label: string; detail: string; state: "done" | "todo" | "optional"; step: number };

/** Live setup checklist shown beside the wizard and on the review step. */
export function buildChecklist(form: WizardForm): ChecklistItem[] {
  const site = normalizeWebsite(form.website);
  const basicsDone = Object.keys(stepErrors(0, form)).length === 0;
  const connectionDone = Object.keys(stepErrors(1, form)).length === 0;
  const brandDone = Object.keys(stepErrors(2, form)).length === 0;
  const productCount = form.productSource === "shopify" && form.shopifyState === "authorized" ? form.shopifySelected.length : form.products.length;
  const confirmed = form.competitors.filter((c) => c.state === "confirmed").length;

  return [
    { id: "basics", label: "Basics", detail: basicsDone && site.host ? site.host : "Name and website", state: basicsDone ? "done" : "todo", step: 0 },
    { id: "connection", label: "Connection", detail: form.connection === "shopify" ? (connectionDone ? "Shopify authorized" : "Authorize Shopify") : "Manual", state: connectionDone ? "done" : "todo", step: 1 },
    { id: "brand", label: "Brand and market", detail: brandDone ? `${form.brandName.trim()} · ${form.country}` : "Brand, industry, market", state: brandDone ? "done" : "todo", step: 2 },
    { id: "products", label: "Products and services", detail: productCount ? `${productCount} added` : "Optional", state: productCount ? "done" : "optional", step: 3 },
    { id: "competitors", label: "Competitors", detail: confirmed ? `${confirmed} confirmed` : "Optional", state: confirmed ? "done" : "optional", step: 4 },
    { id: "channels", label: "AI channels", detail: form.channelIds.length ? `${form.channelIds.length} selected` : "Choose at least one", state: form.channelIds.length ? "done" : "todo", step: 5 },
  ];
}

export function requiredComplete(form: WizardForm): boolean {
  return buildChecklist(form).every((item) => item.state !== "todo");
}

export function initialForm(sample: { suggestedCompetitors: { id: string; name: string; domain: string; reason: string }[]; shopifyProducts: { id: string }[] }, allChannelIds: string[]): WizardForm {
  return {
    name: "",
    website: "",
    platform: "manual",
    connection: "manual",
    shopifyState: "idle",
    brandName: "",
    aliases: [],
    industry: "",
    description: "",
    country: "",
    language: "",
    timezone: "",
    productSource: "manual",
    products: [],
    shopifySelected: sample.shopifyProducts.map((p) => p.id),
    competitors: sample.suggestedCompetitors.map((c) => ({ ...c, state: "suggested" as const })),
    channelIds: allChannelIds,
    trackingMode: "web_grounded",
  };
}
