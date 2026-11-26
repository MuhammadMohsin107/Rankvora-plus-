import type { Competitor, ProductService, Store, StorePlatform, StoreStatus } from "@/types/core";
import type { ActivityEntry, BrandFact, BrandFaq, BrandKnowledgeState, BrandVersion, DomainRecord, IntegrationDetail } from "@/types/settings";

import { simulatedAccount, simulatedScopes, type ConnectorChoice } from "../connectors";
import { COUNTRIES } from "../options";
import { normalizeWebsite, validateRequired } from "../validation";

export type TrackingMode = "model_only" | "web_grounded" | "both";
export type CompetitorState = "confirmed" | "suggested" | "dismissed";

export type WizardProduct = { id: string; title: string; category: string; url: string };
export type WizardCompetitor = { id: string; name: string; domain: string; reason: string; state: CompetitorState };
export type WizardFact = BrandFact;
export type WizardFaq = BrandFaq;

export type WizardForm = {
  // 1. Basics
  name: string;
  website: string;
  brandName: string;
  country: string;
  language: string;
  timezone: string;
  siteType: StorePlatform;
  // 2. Brand profile
  category: string;
  description: string;
  aliases: string[];
  competitors: WizardCompetitor[];
  products: WizardProduct[];
  facts: WizardFact[];
  faqs: WizardFaq[];
  // 3. Connections (all optional)
  connector: ConnectorChoice | "none";
  searchConsole: boolean;
  channelIds: string[];
  trackingMode: TrackingMode;
};

export const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "brand", label: "Brand profile" },
  { id: "connections", label: "Connections" },
  { id: "review", label: "Review" },
] as const;

export const LAST_STEP = STEPS.length - 1;

export type Errors = Record<string, string>;

/** A website that already exists (any status), used to refuse a second website on the same domain. */
export type ExistingWebsite = { name: string; domain: string };

const bareHost = (host: string) => host.trim().toLowerCase().replace(/^www[.]/, "");

/** The existing website that owns this domain (`www.` ignored), or null. */
export function findDomainOwner(host: string | undefined, existing: readonly ExistingWebsite[]): ExistingWebsite | null {
  if (!host) return null;
  return existing.find((w) => bareHost(w.domain) === bareHost(host)) ?? null;
}

/** Required-field errors for one step. Empty object = step complete. Connections are all optional. */
export function stepErrors(step: number, form: WizardForm, existing: readonly ExistingWebsite[] = []): Errors {
  const errors: Errors = {};
  if (step === 0) {
    const name = validateRequired(form.name, "Website name", 2, 80);
    if (name) errors.name = name;
    const site = normalizeWebsite(form.website);
    if (site.error) errors.website = site.error;
    else {
      const owner = findDomainOwner(site.host, existing);
      if (owner) errors.website = `${owner.name} already uses ${owner.domain}. Use a different domain.`;
    }
    const brand = validateRequired(form.brandName, "Brand name", 2, 80);
    if (brand) errors.brandName = brand;
    if (!form.country) errors.country = "Choose a market.";
    if (!form.language) errors.language = "Choose a language.";
    if (!form.siteType) errors.siteType = "Choose a site type.";
  }
  if (step === 1) {
    if (!form.category) errors.category = "Choose a category.";
    if (form.description.length > 400) errors.description = "Keep the description to 400 characters.";
  }
  return errors;
}

/** Errors across the steps that carry required fields (the review step checks them all). */
export function allErrors(form: WizardForm, existing: readonly ExistingWebsite[] = []): { step: number; errors: Errors }[] {
  return [0, 1].map((step) => ({ step, errors: stepErrors(step, form, existing) })).filter((entry) => Object.keys(entry.errors).length > 0);
}

export type ChecklistItem = { id: string; label: string; detail: string; state: "done" | "todo" | "optional"; step: number };

/** Live summary beside the wizard. */
export function buildChecklist(form: WizardForm, existing: readonly ExistingWebsite[] = []): ChecklistItem[] {
  const site = normalizeWebsite(form.website);
  const basicsDone = Object.keys(stepErrors(0, form, existing)).length === 0;
  const brandDone = Object.keys(stepErrors(1, form)).length === 0;
  const confirmed = form.competitors.filter((c) => c.state === "confirmed").length;
  const extras = form.products.length + form.facts.length + form.faqs.length;
  return [
    { id: "basics", label: "Basics", detail: basicsDone && site.host ? site.host : "Name, domain, market", state: basicsDone ? "done" : "todo", step: 0 },
    { id: "brand", label: "Brand profile", detail: brandDone ? form.category : "Category and description", state: brandDone ? "done" : "todo", step: 1 },
    { id: "competitors", label: "Competitors", detail: confirmed ? `${confirmed} confirmed` : "Optional", state: confirmed ? "done" : "optional", step: 1 },
    { id: "extras", label: "Offerings, facts, FAQs", detail: extras ? `${extras} added` : "Optional", state: extras ? "done" : "optional", step: 1 },
    { id: "connections", label: "Connections", detail: form.connector !== "none" || form.searchConsole || form.channelIds.length ? "Chosen" : "Optional", state: "optional", step: 2 },
  ];
}

export function requiredComplete(form: WizardForm, existing: readonly ExistingWebsite[] = []): boolean {
  return allErrors(form, existing).length === 0;
}

export function initialForm(): WizardForm {
  return {
    name: "",
    website: "",
    brandName: "",
    country: "",
    language: "",
    timezone: "",
    siteType: "custom",
    category: "",
    description: "",
    aliases: [],
    competitors: [],
    products: [],
    facts: [],
    faqs: [],
    connector: "none",
    searchConsole: false,
    channelIds: [],
    trackingMode: "web_grounded",
  };
}

/** Status a created website starts in: draft when saved early, ready when an AI channel is chosen, else needs review. */
export function startingStatus(form: Pick<WizardForm, "channelIds">, draft: boolean): StoreStatus {
  if (draft) return "draft";
  return form.channelIds.length > 0 ? "ready" : "needs_review";
}

/** The website row stored in demo-state. `now` comes from the caller (a handler), never from render. */
export function formToWebsite(form: WizardForm, status: StoreStatus, now: string): Omit<Store, "id"> {
  const site = normalizeWebsite(form.website);
  const country = COUNTRIES.find((c) => c.code === form.country);
  const host = site.host ?? form.website.trim().toLowerCase();
  return {
    name: form.name.trim(),
    brandName: form.brandName.trim() || form.name.trim(),
    domain: host,
    platform: form.siteType,
    market: form.country || "ZZ",
    marketName: country?.name ?? form.country,
    language: form.language || "en",
    timezone: form.timezone || country?.timezone || "UTC",
    status,
    industry: form.category || "Other",
    integrations: { commerce: form.connector === "none" ? "manual" : "connected", searchConsole: form.searchConsole ? "connected" : "not_connected" },
    channelIds: form.channelIds,
    createdAt: now,
    summary: null,
  };
}

export type WebsiteSettingsDocs = {
  brand: { versions: BrandVersion[] };
  knowledge: BrandKnowledgeState;
  competitors: { list: Competitor[] };
  products: { list: ProductService[] };
  integrations: IntegrationDetail;
  domains: DomainRecord;
  activity: { entries: ActivityEntry[] };
};

/** Everything the wizard captured, shaped like the website settings tabs read it. */
export function buildSettingsDocs(websiteId: string, form: WizardForm, now: string): WebsiteSettingsDocs {
  const host = normalizeWebsite(form.website).host ?? form.website.trim().toLowerCase();
  const connector = form.connector === "none" ? null : form.connector;
  const competitorMarket = form.country || null;
  return {
    brand: {
      versions: [
        {
          version: 1,
          createdAt: now,
          createdBy: "You",
          note: "Created at setup",
          brandName: form.brandName.trim() || form.name.trim(),
          aliases: form.aliases,
          differentiators: [],
          description: form.description.trim(),
          category: form.category,
        },
      ],
    },
    knowledge: { facts: form.facts, faqs: form.faqs, contentContext: "", sourcePages: [], scannedAt: null },
    competitors: {
      list: form.competitors.map((c) => ({
        id: `${websiteId}-comp-${c.id}`,
        storeId: websiteId,
        name: c.name,
        domains: c.domain ? [c.domain] : [],
        aliases: [],
        status: c.state === "confirmed" ? "confirmed" : c.state === "suggested" ? "suggested" : "archived",
        market: competitorMarket,
      })),
    },
    products: { list: form.products.map((p) => ({ id: `${websiteId}-prod-${p.id}`, storeId: websiteId, title: p.title, category: p.category, url: p.url })) },
    integrations: {
      storeId: websiteId,
      commerce: connector
        ? { platform: connector, state: "connected", account: simulatedAccount(connector, host), scopes: simulatedScopes(connector), lastVerifiedAt: now, note: null }
        : { platform: form.siteType, state: "manual", account: null, scopes: [], lastVerifiedAt: null, note: "No connector. Fixes are guidance only." },
      searchConsole: form.searchConsole
        ? { state: "connected", property: `sc-domain:${host}`, lastVerifiedAt: now, note: null }
        : { state: "not_connected", property: null, lastVerifiedAt: null, note: null },
    },
    domains: { storeId: websiteId, canonical: host, aliases: [], former: [] },
    activity: { entries: [{ id: "local-act-1", storeId: websiteId, at: now, actor: "You", title: "Website created", detail: "Simulated. Stored in this browser.", kind: "store" }] },
  };
}
