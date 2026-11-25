/**
 * `Idempotency-Key` support for requests that create things. A retry with the same key and body gets
 * the first response again instead of creating a second record.
 */
import { prepare, raw } from "../db/atomic";
import { ApiError } from "./errors";

const TTL_MS = 24 * 60 * 60 * 1000;
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export type Claim = { userId: string; route: string; key: string };

export function readIdempotencyKey(request: Request): string | null {
  const key = request.headers.get("idempotency-key");
  if (key === null) return null;
  if (!KEY_PATTERN.test(key)) {
    throw new ApiError(400, "invalid_idempotency_key", "Idempotency-Key must be 8 to 128 letters, digits, hyphens or underscores.");
  }
  return key;
}

type Stored = { requestHash: string; status: string; responseStatus: number | null; responseBody: string | null };

/** Returns the earlier response when this key already completed, otherwise null after reserving the key. */
export async function claimKey(d1: D1Database, claim: Claim, requestHash: string, now: Date): Promise<{ status: number; body: string } | null> {
  const claimed = await prepare(
    d1,
    raw(
      `insert into idempotency_records (user_id, route, key, request_hash, status, expires_at, created_at)
       values (?, ?, ?, ?, 'in_progress', ?, ?)
       on conflict (user_id, route, key) do update set
         request_hash = excluded.request_hash, status = 'in_progress', response_status = null,
         response_body = null, expires_at = excluded.expires_at, created_at = excluded.created_at
       where idempotency_records.expires_at <= excluded.created_at`,
      claim.userId,
      claim.route,
      claim.key,
      requestHash,
      now.getTime() + TTL_MS,
      now,
    ),
  ).run();
  if (claimed.meta.changes > 0) return null;

  const stored = await prepare(
    d1,
    raw(
      `select request_hash as requestHash, status, response_status as responseStatus, response_body as responseBody
         from idempotency_records where user_id = ? and route = ? and key = ?`,
      claim.userId,
      claim.route,
      claim.key,
    ),
  ).first<Stored>();
  if (stored && stored.requestHash !== requestHash) {
    throw new ApiError(422, "idempotency_key_reused", "This Idempotency-Key was used for a different request.");
  }
  if (stored?.status === "completed" && stored.responseStatus !== null && stored.responseBody !== null) {
    return { status: stored.responseStatus, body: stored.responseBody };
  }
  throw new ApiError(409, "request_in_progress", "The first request with this key is still running.");
}

export async function completeKey(d1: D1Database, claim: Claim, status: number, body: string): Promise<void> {
  await prepare(
    d1,
    raw(
      `update idempotency_records set status = 'completed', response_status = ?, response_body = ? where user_id = ? and route = ? and key = ?`,
      status,
      body,
      claim.userId,
      claim.route,
      claim.key,
    ),
  ).run();
}

/** A failed request frees the key so the client can retry it. */
export async function releaseKey(d1: D1Database, claim: Claim): Promise<void> {
  await prepare(
    d1,
    raw(`delete from idempotency_records where user_id = ? and route = ? and key = ? and status = 'in_progress'`, claim.userId, claim.route, claim.key),
  ).run();
}
