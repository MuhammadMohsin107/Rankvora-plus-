import type { IconName } from "@/components/ui/icon";
import type { Tone } from "@/lib/status";
import type { AlertSeverity } from "@/types/core";
import type { DeliveryChannel, EventType, FailureClass, UsageMetricKey } from "@/types/monitoring";

export const EVENT_LABEL: Record<EventType, string> = {
  new_mention: "New mention",
  lost_mention: "Lost mention",
  new_recommendation: "New recommendation",
  lost_recommendation: "Recommendation lost",
  owned_citation_gained: "Owned citation gained",
  owned_citation_lost: "Owned citation lost",
  sentiment_shift: "Sentiment shift",
  competitor_increase: "Competitor increase",
  competitor_decrease: "Competitor decrease",
  rank_movement: "Rank movement",
  provider_error_spike: "Provider error spike",
  run_incomplete: "Run incomplete",
  run_late: "Run late",
  integration_attention: "Site connection",
  brand_fact_error: "Brand fact error",
  competitor_mention_change: "Competitor mentions",
  sentiment_share_change: "Sentiment share",
  coverage_change: "Coverage change",
};

export const EVENT_ICON: Record<EventType, IconName> = {
  new_mention: "plus",
  lost_mention: "minus-circle",
  new_recommendation: "trend-up",
  lost_recommendation: "trend-down",
  owned_citation_gained: "link",
  owned_citation_lost: "link",
  sentiment_shift: "refresh",
  competitor_increase: "arrow-up-right",
  competitor_decrease: "arrow-down",
  rank_movement: "list",
  provider_error_spike: "bolt",
  run_incomplete: "alert-triangle",
  run_late: "clock",
  integration_attention: "plug",
  brand_fact_error: "alert-circle",
  competitor_mention_change: "users",
  sentiment_share_change: "sparkles",
  coverage_change: "layers",
};

export const EVENT_TONE: Record<EventType, Tone> = {
  new_mention: "success",
  lost_mention: "danger",
  new_recommendation: "success",
  lost_recommendation: "danger",
  owned_citation_gained: "success",
  owned_citation_lost: "warning",
  sentiment_shift: "info",
  competitor_increase: "warning",
  competitor_decrease: "info",
  rank_movement: "info",
  provider_error_spike: "danger",
  run_incomplete: "warning",
  run_late: "warning",
  integration_attention: "warning",
  brand_fact_error: "danger",
  competitor_mention_change: "warning",
  sentiment_share_change: "info",
  coverage_change: "warning",
};

export const FAILURE_LABEL: Record<FailureClass, string> = {
  timeout: "Timeout",
  rate_limit: "Rate limit",
  provider_error: "Provider error",
  refusal: "Refusal",
};

export const DELIVERY_LABEL: Record<DeliveryChannel, string> = { in_app: "In-app", email: "Email", webhook: "Webhook" };
export const DELIVERY_ICON: Record<DeliveryChannel, IconName> = { in_app: "bell", email: "mail", webhook: "plug" };

/** Alert severity uses "info"; the status vocabulary calls it "informational". */
export const SEVERITY_STATUS: Record<AlertSeverity, "informational" | "low" | "medium" | "high" | "critical"> = {
  info: "informational",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
};

export const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export const USAGE_LABEL: Record<UsageMetricKey, string> = {
  requests: "Requests",
  samples: "Samples",
  searchCalls: "Search calls",
  tokens: "Tokens",
  costUsd: "Cost (estimate)",
};

export const WEEKDAY_LABEL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const HEALTH_META = {
  healthy: { label: "Healthy", tone: "success", icon: "check-circle" },
  degraded: { label: "Degraded", tone: "warning", icon: "alert-triangle" },
  outage: { label: "Outage", tone: "danger", icon: "x-circle" },
} as const satisfies Record<string, { label: string; tone: Tone; icon: IconName }>;

export function formatUsd(value: number): string {
  return `$${value.toFixed(value < 100 ? 2 : 0)}`;
}

export function formatNumberShort(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

/** True when an event title already starts with its type label ("New mention: ..."). */
export function titleHasType(event: { type: EventType; title: string }): boolean {
  return event.title.toLowerCase().startsWith(EVENT_LABEL[event.type].toLowerCase());
}

/**
 * Meta line for an event. The type and provider are left out when the title
 * already says them, so nothing is repeated under the title.
 */
export function eventMeta(event: { type: EventType; title: string; providerShort?: string | null; runId: string }): string {
  const parts: string[] = [];
  if (!titleHasType(event)) parts.push(EVENT_LABEL[event.type]);
  if (event.providerShort && !event.title.includes(event.providerShort)) parts.push(event.providerShort);
  parts.push(event.runId);
  return parts.join(" · ");
}

/** Alert statuses that still need attention. Unread is a separate, narrower idea: status "new" only. */
export const OPEN_ALERT_STATUSES = ["new", "read", "acknowledged"] as const;
