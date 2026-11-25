/** Activity history, security audit trail and request de-duplication. The two logs are append-only (triggers). */
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { createdAt, instant, oneOf } from "./columns";
import { organizations } from "./organizations";
import { ACTOR_TYPES } from "./usage";
import { websites } from "./websites";

export const SECURITY_OUTCOMES = ["success", "failure", "denied"] as const;
export type SecurityOutcome = (typeof SECURITY_OUTCOMES)[number];

export const IDEMPOTENCY_STATUSES = ["in_progress", "completed"] as const;

/** What happened to the customer's data, shown to members of the organization. */
export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    websiteId: text("website_id"),
    actorType: text("actor_type", { enum: ACTOR_TYPES }).notNull(),
    /** No foreign key: history survives account deletion. */
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    /** JSON object. Never secrets, tokens or message bodies. */
    metadata: text("metadata"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.websiteId, t.organizationId], foreignColumns: [websites.id, websites.organizationId], name: "activity_logs_website_fk" }),
    index("activity_logs_org_idx").on(t.organizationId, t.createdAt, t.id),
    index("activity_logs_website_idx").on(t.websiteId, t.createdAt, t.id),
    check("activity_logs_actor_check", oneOf("actor_type", ACTOR_TYPES)),
  ],
);

/** Sign-ins, permission denials, role changes. */
export const securityAuditLogs = sqliteTable(
  "security_audit_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    event: text("event").notNull(),
    outcome: text("outcome", { enum: SECURITY_OUTCOMES }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    metadata: text("metadata"),
    requestId: text("request_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("security_audit_logs_org_idx").on(t.organizationId, t.createdAt, t.id),
    index("security_audit_logs_user_idx").on(t.userId, t.createdAt),
    check("security_audit_logs_outcome_check", oneOf("outcome", SECURITY_OUTCOMES)),
  ],
);

export const idempotencyRecords = sqliteTable(
  "idempotency_records",
  {
    userId: text("user_id").notNull(),
    /** Method and path, so one key cannot replay a different operation. */
    route: text("route").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: text("status", { enum: IDEMPOTENCY_STATUSES }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    expiresAt: instant("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("idempotency_records_uq").on(t.userId, t.route, t.key), index("idempotency_records_expiry_idx").on(t.expiresAt)],
);
