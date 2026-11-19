import type { AuditLane, AuditType, CheckGroup, CheckKind, PageType } from "@/types/audit";

export const AUDIT_TYPE_LABEL: Record<AuditType, string> = {
  initial: "Initial",
  full: "Full",
  focused: "Focused",
  verification: "Verification",
  triggered: "Triggered",
  scheduled: "Scheduled",
};

export const LANE_LABEL: Record<AuditLane, string> = { ai_visibility: "AI visibility", website_readiness: "Website readiness" };
export const LANE_SHORT: Record<AuditLane, string> = { ai_visibility: "AI", website_readiness: "Web" };

export const CHECK_GROUP_LABEL: Record<CheckGroup, string> = {
  reachability: "Reachability",
  indexing: "Indexing controls",
  canonical: "Canonicalisation",
  sitemaps: "Sitemaps",
  linking: "Internal linking",
  rendering: "Rendering",
  url_quality: "URL quality",
  metadata: "Metadata",
  mobile_a11y: "Mobile and accessibility",
  structured_data: "Structured data",
  content_entity: "Content and entity",
};

export const CHECK_KIND_LABEL: Record<CheckKind, string> = { technical: "Technical", content: "Content quality" };

export const PAGE_TYPE_LABEL: Record<PageType, string> = {
  home: "Home",
  collection: "Collection",
  product: "Product",
  guide: "Guide",
  page: "Page",
  policy: "Policy",
};

/** Store settings, integrations tab (where AI platforms and connectors are connected). */
export const integrationsHref = (storeId: string) => `/stores/${storeId}/settings?tab=integrations`;

export function formatMinutes(totalSeconds: number): string {
  const m = Math.max(1, Math.round(totalSeconds / 60));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const FINDING_CATEGORY_LABEL = {
  technical: "Technical",
  content: "Content",
  entity: "Entity",
  schema: "Schema",
  ai_visibility: "AI visibility",
  product: "Product",
} as const;
