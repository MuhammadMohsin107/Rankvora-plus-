/**
 * Quota accounting. Work reserves quota before it starts; afterwards the reservation is settled into
 * the append-only ledger, or released. The limit check and the reservation are one SQL statement, so
 * two jobs starting at once cannot both take the last unit.
 *
 * Nothing calls reserve/settle yet: provider execution arrives in roadmap Phase 3.
 */
import { USAGE_RESERVATION_TTL_MS } from "../../config/limits";
import { appliedClause, atomic, prepare, raw } from "../../db/atomic";
import type { ActorType, ReservationStatus, UsageMetric } from "../../db/schema";
import { ApiError, conflict, notFound } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import type { OrgScope } from "../../tenancy/guard";

/** Calendar month in UTC. Billing cycles replace this when subscriptions exist. */
export function periodOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

const LIMIT_COLUMN: Record<UsageMetric, string> = {
  ai_request: "monthly_ai_requests",
  search_call: "monthly_search_calls",
};

type OverviewRow = {
  maxWebsites: number;
  maxMembers: number;
  maxActivePrompts: number;
  monthlyAiRequests: number;
  monthlySearchCalls: number;
  websites: number;
  members: number;
  pendingInvitations: number;
  aiUsed: number;
  searchUsed: number;
  aiReserved: number;
  searchReserved: number;
};

export async function getUsageOverview(context: ApiContext, scope: OrgScope) {
  const period = periodOf(context.now);
  const id = scope.organizationId;
  const used = (type: UsageMetric) => `(select coalesce(sum(quantity), 0) from usage_ledger where organization_id = e.organization_id and usage_type = '${type}' and period = ?)`;
  const reserved = (type: UsageMetric) =>
    `(select coalesce(sum(quantity), 0) from usage_reservations where organization_id = e.organization_id and metric = '${type}' and period = ? and status = 'reserved' and expires_at > ?)`;
  const row = await prepare(
    context.d1,
    raw(
      `select e.max_websites as maxWebsites, e.max_members as maxMembers, e.max_active_prompts as maxActivePrompts,
              e.monthly_ai_requests as monthlyAiRequests, e.monthly_search_calls as monthlySearchCalls,
              (select count(*) from websites w where w.organization_id = e.organization_id and w.status <> 'removed') as websites,
              (select count(*) from organization_members m where m.organization_id = e.organization_id and m.status = 'active') as members,
              (select count(*) from invitations i where i.organization_id = e.organization_id and i.status = 'pending' and i.expires_at > ?) as pendingInvitations,
              ${used("ai_request")} as aiUsed, ${used("search_call")} as searchUsed,
              ${reserved("ai_request")} as aiReserved, ${reserved("search_call")} as searchReserved
         from organization_entitlements e where e.organization_id = ?`,
      context.now,
      period,
      period,
      period,
      context.now,
      period,
      context.now,
      id,
    ),
  ).first<OverviewRow>();
  if (!row) throw notFound();
  return {
    period,
    websites: { used: row.websites, limit: row.maxWebsites },
    members: { used: row.members, pendingInvitations: row.pendingInvitations, limit: row.maxMembers },
    activePrompts: { limit: row.maxActivePrompts },
    aiRequests: { used: row.aiUsed, reserved: row.aiReserved, limit: row.monthlyAiRequests },
    searchCalls: { used: row.searchUsed, reserved: row.searchReserved, limit: row.monthlySearchCalls },
  };
}

export const quotaExceeded = () => new ApiError(429, "quota_exceeded", "The monthly usage limit of this organization is reached.");

type Reservation = { id: string; status: ReservationStatus; metric: UsageMetric; quantity: number };
type StoredReservation = Reservation & { websiteId: string | null; expiresAt: number };

export type ReserveInput = {
  organizationId: string;
  websiteId: string | null;
  metric: UsageMetric;
  quantity: number;
  /** The same key returns the same reservation, so a redelivered job does not reserve twice. */
  idempotencyKey: string;
  runRef?: string | null;
  actorUserId?: string | null;
  now: Date;
  ttlMs?: number;
};

const byKey = (d1: D1Database, organizationId: string, key: string) =>
  prepare(
    d1,
    raw(
      `select id, status, metric, quantity, website_id as websiteId, expires_at as expiresAt
         from usage_reservations where organization_id = ? and idempotency_key = ?`,
      organizationId,
      key,
    ),
  ).first<StoredReservation>();

export async function reserveUsage(d1: D1Database, input: ReserveInput): Promise<Reservation> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("quantity must be a positive integer");
  const id = newId("urs");
  const period = periodOf(input.now);
  const column = LIMIT_COLUMN[input.metric];
  const result = await prepare(
    d1,
    raw(
      `insert into usage_reservations (id, organization_id, website_id, metric, quantity, period, status, idempotency_key, run_ref, created_by_user_id, expires_at, created_at)
       select ?, ?, ?, ?, ?, ?, 'reserved', ?, ?, ?, ?, ?
        where exists (select 1 from organizations where id = ? and status = 'active')
          and (select coalesce(sum(quantity), 0) from usage_ledger where organization_id = ? and usage_type = ? and period = ?)
            + (select coalesce(sum(quantity), 0) from usage_reservations where organization_id = ? and metric = ? and period = ? and status = 'reserved' and expires_at > ?)
            + ? <= (select ${column} from organization_entitlements where organization_id = ?)
       on conflict (organization_id, idempotency_key) do nothing`,
      id,
      input.organizationId,
      input.websiteId,
      input.metric,
      input.quantity,
      period,
      input.idempotencyKey,
      input.runRef ?? null,
      input.actorUserId ?? null,
      input.now.getTime() + (input.ttlMs ?? USAGE_RESERVATION_TTL_MS),
      input.now,
      input.organizationId,
      input.organizationId,
      input.metric,
      period,
      input.organizationId,
      input.metric,
      period,
      input.now,
      input.quantity,
      input.organizationId,
    ),
  ).run();
  if (result.meta.changes > 0) return { id, status: "reserved", metric: input.metric, quantity: input.quantity };

  const existing = await byKey(d1, input.organizationId, input.idempotencyKey);
  if (!existing) throw quotaExceeded();
  if (existing.metric !== input.metric || existing.quantity !== input.quantity || existing.websiteId !== input.websiteId) {
    throw conflict("reservation_key_reused", "This usage key was used for a different reservation.");
  }
  // Neither holds quota any more, so handing it back would let work run without any.
  if (existing.status === "released" || (existing.status === "reserved" && existing.expiresAt <= input.now.getTime())) {
    throw conflict("reservation_closed", "This reservation no longer holds quota. Reserve again with a new key.");
  }
  // "settled" is returned so a redelivered job can see its work is already recorded.
  return { id: existing.id, status: existing.status, metric: existing.metric, quantity: existing.quantity };
}

export type LedgerEntry = {
  idempotencyKey: string;
  /** What was really consumed. May be 0, and may differ from the reserved amount. */
  quantity: number;
  actorType: ActorType;
  actorUserId?: string | null;
  provider?: string | null;
  model?: string | null;
  runId?: string | null;
  requestId?: string | null;
  estimatedCostMicros?: number | null;
  /** Leave null when the provider does not report a cost. */
  actualCostMicros?: number | null;
  currency?: string | null;
};

const findReservation = (d1: D1Database, organizationId: string, reservationId: string) =>
  prepare(
    d1,
    raw(`select id, status, metric, quantity from usage_reservations where id = ? and organization_id = ?`, reservationId, organizationId),
  ).first<Reservation>();

/** Idempotent: settling a settled reservation does nothing. */
export async function settleUsage(d1: D1Database, input: { organizationId: string; reservationId: string; entries: LedgerEntry[]; now: Date }): Promise<void> {
  const reservation = await findReservation(d1, input.organizationId, input.reservationId);
  if (!reservation) throw notFound();
  if (reservation.status === "settled") return;
  if (reservation.status === "released") throw conflict("reservation_released", "This reservation was already released.");

  const changeId = newChangeId();
  const guard = appliedClause({ table: "usage_reservations", id: reservation.id, changeId });
  const total = input.entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const [settled] = await atomic(d1, [
    raw(
      `update usage_reservations set status = 'settled', settled_quantity = ?, closed_at = ?, change_id = ? where id = ? and organization_id = ? and status = 'reserved'`,
      total,
      input.now,
      changeId,
      reservation.id,
      input.organizationId,
    ),
    // Tenant, website, metric and period are copied from the reservation, never taken from the caller.
    ...input.entries.map((entry) =>
      raw(
        `insert into usage_ledger (id, organization_id, website_id, reservation_id, actor_type, actor_user_id, provider, model, run_id, request_id,
           usage_type, quantity, estimated_cost_micros, actual_cost_micros, currency, period, idempotency_key, occurred_at)
         select ?, r.organization_id, r.website_id, r.id, ?, ?, ?, ?, ?, ?, r.metric, ?, ?, ?, ?, r.period, ?, ?
           from usage_reservations r where r.id = ? and ${guard.sql}`,
        newId("ule"),
        entry.actorType,
        entry.actorUserId ?? null,
        entry.provider ?? null,
        entry.model ?? null,
        entry.runId ?? null,
        entry.requestId ?? null,
        entry.quantity,
        entry.estimatedCostMicros ?? null,
        entry.actualCostMicros ?? null,
        entry.currency ?? null,
        entry.idempotencyKey,
        input.now,
        reservation.id,
        ...guard.params,
      ),
    ),
  ]);
  if (settled === 0) {
    // Closed between the read and the write, and no usage was recorded. Silently succeeding would lose it.
    const latest = await findReservation(d1, input.organizationId, input.reservationId);
    if (latest?.status !== "settled") throw conflict("reservation_released", "This reservation was released before its usage was recorded.");
  }
}

/** Gives reserved quota back, for work that never reached a provider. */
export async function releaseUsage(d1: D1Database, input: { organizationId: string; reservationId: string; now: Date }): Promise<void> {
  const result = await prepare(
    d1,
    raw(
      `update usage_reservations set status = 'released', closed_at = ? where id = ? and organization_id = ? and status = 'reserved'`,
      input.now,
      input.reservationId,
      input.organizationId,
    ),
  ).run();
  if (result.meta.changes > 0) return;
  const reservation = await findReservation(d1, input.organizationId, input.reservationId);
  if (!reservation) throw notFound();
  if (reservation.status === "settled") throw conflict("reservation_settled", "This reservation was already settled.");
}
