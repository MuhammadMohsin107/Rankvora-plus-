/**
 * Entitlements and usage accounting. A reservation holds quota before work starts; settling it
 * writes the append-only ledger. Costs are integers in millionths of the currency unit.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { createdAt, instant, oneOf, updatedAt } from "./columns";
import { organizations } from "./organizations";
import { websites } from "./websites";

export const USAGE_METRICS = ["ai_request", "search_call"] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export const RESERVATION_STATUSES = ["reserved", "settled", "released"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ACTOR_TYPES = ["user", "system"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ENTITLEMENT_SOURCES = ["default", "manual", "plan"] as const;

export const organizationEntitlements = sqliteTable(
  "organization_entitlements",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id),
    maxWebsites: integer("max_websites").notNull(),
    maxMembers: integer("max_members").notNull(),
    maxActivePrompts: integer("max_active_prompts").notNull(),
    monthlyAiRequests: integer("monthly_ai_requests").notNull(),
    monthlySearchCalls: integer("monthly_search_calls").notNull(),
    source: text("source", { enum: ENTITLEMENT_SOURCES }).notNull().default("default"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [
    check("entitlements_non_negative_check", sql`max_websites >= 0 and max_members >= 1 and max_active_prompts >= 0 and monthly_ai_requests >= 0 and monthly_search_calls >= 0`),
    check("entitlements_source_check", oneOf("source", ENTITLEMENT_SOURCES)),
  ],
);

export const usageReservations = sqliteTable(
  "usage_reservations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    websiteId: text("website_id"),
    metric: text("metric", { enum: USAGE_METRICS }).notNull(),
    quantity: integer("quantity").notNull(),
    /** Calendar month in UTC, "2026-11". */
    period: text("period").notNull(),
    status: text("status", { enum: RESERVATION_STATUSES }).notNull().default("reserved"),
    settledQuantity: integer("settled_quantity"),
    idempotencyKey: text("idempotency_key").notNull(),
    runRef: text("run_ref"),
    createdByUserId: text("created_by_user_id"),
    expiresAt: instant("expires_at").notNull(),
    closedAt: instant("closed_at"),
    changeId: text("change_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "usage_reservations_website_fk" }),
    uniqueIndex("usage_reservations_org_key_uq").on(t.organizationId, t.idempotencyKey),
    index("usage_reservations_quota_idx").on(t.organizationId, t.metric, t.period, t.status),
    check("usage_reservations_quantity_check", sql`quantity > 0`),
    check("usage_reservations_metric_check", oneOf("metric", USAGE_METRICS)),
    check("usage_reservations_status_check", oneOf("status", RESERVATION_STATUSES)),
  ],
);

export const usageLedger = sqliteTable(
  "usage_ledger",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    websiteId: text("website_id"),
    reservationId: text("reservation_id").references(() => usageReservations.id),
    actorType: text("actor_type", { enum: ACTOR_TYPES }).notNull(),
    actorUserId: text("actor_user_id"),
    provider: text("provider"),
    model: text("model"),
    runId: text("run_id"),
    requestId: text("request_id"),
    usageType: text("usage_type", { enum: USAGE_METRICS }).notNull(),
    quantity: integer("quantity").notNull(),
    estimatedCostMicros: integer("estimated_cost_micros"),
    /** null until the provider reports it. Null is "unknown", never zero. */
    actualCostMicros: integer("actual_cost_micros"),
    currency: text("currency"),
    period: text("period").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    occurredAt: instant("occurred_at").notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "usage_ledger_website_fk" }),
    uniqueIndex("usage_ledger_org_key_uq").on(t.organizationId, t.idempotencyKey),
    index("usage_ledger_org_period_idx").on(t.organizationId, t.usageType, t.period),
    check("usage_ledger_quantity_check", sql`quantity >= 0`),
    check("usage_ledger_type_check", oneOf("usage_type", USAGE_METRICS)),
    check("usage_ledger_actor_check", oneOf("actor_type", ACTOR_TYPES)),
  ],
);
