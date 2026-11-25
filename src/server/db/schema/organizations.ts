import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { users } from "./auth";
import { createdAt, instant, oneOf, updatedAt } from "./columns";

/** Highest authority first. The permission matrix lives in src/server/tenancy/permissions.ts. */
export const ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ORGANIZATION_STATUSES = ["active", "suspended", "deleted"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const MEMBER_STATUSES = ["active", "deactivated"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "rejected", "revoked", "expired"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    /** IANA timezone. Websites keep their own. */
    timezone: text("timezone").notNull(),
    status: text("status", { enum: ORGANIZATION_STATUSES }).notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    suspendedAt: instant("suspended_at"),
    suspendedReason: text("suspended_reason"),
    deletedAt: instant("deleted_at"),
    version: integer("version").notNull().default(1),
    /** Random id of the last write, so statements in the same D1 batch can tell whether it applied. */
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  () => [check("organizations_status_check", oneOf("status", ORGANIZATION_STATUSES))],
);

export const organizationMembers = sqliteTable(
  "organization_members",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    status: text("status", { enum: MEMBER_STATUSES }).notNull().default("active"),
    deactivatedAt: instant("deactivated_at"),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("organization_members_org_user_uq").on(t.organizationId, t.userId),
    index("organization_members_user_idx").on(t.userId, t.status),
    check("organization_members_role_check", oneOf("role", ROLES)),
    check("organization_members_status_check", oneOf("status", MEMBER_STATUSES)),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id),
    /** Lowercased. */
    email: text("email").notNull(),
    role: text("role", { enum: ROLES }).notNull(),
    /** SHA-256 of the emailed token. The token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status", { enum: INVITATION_STATUSES }).notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").notNull(),
    expiresAt: instant("expires_at").notNull(),
    respondedAt: instant("responded_at"),
    respondedByUserId: text("responded_by_user_id"),
    deliveryStatus: text("delivery_status", { enum: DELIVERY_STATUSES }).notNull().default("pending"),
    deliveryError: text("delivery_error"),
    sendCount: integer("send_count").notNull().default(0),
    lastSentAt: instant("last_sent_at"),
    changeId: text("change_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("invitations_one_pending_uq")
      .on(t.organizationId, t.email)
      .where(sql`status = 'pending'`),
    index("invitations_org_idx").on(t.organizationId, t.status),
    index("invitations_recipient_sends_idx").on(t.email, t.lastSentAt),
    index("invitations_sender_sends_idx").on(t.invitedByUserId, t.lastSentAt),
    check("invitations_role_check", oneOf("role", ROLES)),
    check("invitations_status_check", oneOf("status", INVITATION_STATUSES)),
    check("invitations_delivery_check", oneOf("delivery_status", DELIVERY_STATUSES)),
  ],
);
