import type { AuditLane, AuditStatus, AuditType, CheckGroup, CheckKind, PageType } from "@/types/audit";

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
  collection: "Category",
  product: "Product or service",
  guide: "Guide",
  page: "Page",
  policy: "Policy",
};

/** Website settings, integrations tab (where AI platforms and optional connectors are connected). */
export const integrationsHref = () => "/integrations";

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

export const AUDIT_TYPE_HINT: Record<AuditType, string> = {
  initial: "First baseline for this website",
  full: "All active prompts and the whole site",
  focused: "A subset of prompts or sections",
  verification: "Re-check after a fix",
  triggered: "Started by an event",
  scheduled: "Repeats on a schedule",
};

/** Criteria categories the website lane can evaluate, and the check groups each one covers. */
export const CRITERIA_CATEGORIES: { id: string; label: string; groups: CheckGroup[] }[] = [
  { id: "technical", label: "Technical", groups: ["reachability", "indexing", "canonical", "sitemaps", "linking", "rendering", "url_quality"] },
  { id: "content", label: "Content and entity", groups: ["content_entity", "metadata"] },
  { id: "structured_data", label: "Structured data", groups: ["structured_data"] },
  { id: "crawler_access", label: "AI crawler access", groups: [] },
  { id: "performance", label: "Performance and accessibility", groups: ["mobile_a11y"] },
];

export const STATUS_ORDER: AuditStatus[] = ["draft", "validating", "queued", "in_progress", "completed", "completed_with_warnings", "partially_completed", "blocked", "failed", "cancelled"];

export const TRIGGER_LABEL = { fix_applied: "A fix was applied", brand_fact: "A brand fact changed", alert: "A monitoring alert", competitor_suggested: "A competitor was suggested", schedule: "Schedule" } as const;
