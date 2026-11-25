/** Proof of domain ownership with a DNS TXT record. */
import { VERIFICATION_CHECK_COOLDOWN_MS, VERIFICATION_TTL_MS } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import { ApiError, conflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId, randomToken } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { stillAuthorized, type WebsiteScope } from "../../tenancy/guard";
import { lookupTxt } from "./dns";
import { findActiveDomain, listDomains, type DomainRow } from "./domains";
import { domainVerifiedElsewhere, websiteActivity } from "./service";

export const RECORD_PREFIX = "_rankvora-challenge";
export const VALUE_PREFIX = "rankvora-site-verification=";

type Challenge = { id: string; recordName: string; recordValue: string; expiresAt: number; lastCheckedAt: number | null };

function pendingChallenge(context: ApiContext, domainId: string) {
  return prepare(
    context.d1,
    raw(
      `select id as id, record_name as recordName, record_value as recordValue, expires_at as expiresAt, last_checked_at as lastCheckedAt
         from domain_verifications where domain_id = ? and status = 'pending'`,
      domainId,
    ),
  ).first<Challenge>();
}

const instructions = (challenge: { recordName: string; recordValue: string; expiresAt: number }) => ({
  recordType: "TXT" as const,
  recordName: challenge.recordName,
  recordValue: challenge.recordValue,
  expiresAt: new Date(challenge.expiresAt).toISOString(),
});

function assertUnverified(domain: DomainRow) {
  if (domain.verificationStatus === "verified") throw conflict("already_verified", "This domain is already verified.");
}

/** Returns the open challenge, or creates one. Calling it twice gives the same record to publish. */
export async function startVerification(context: ApiContext, scope: WebsiteScope, domainId: string) {
  if (scope.websiteStatus === "archived") throw conflict("website_archived", "Restore the website before verifying its domains.");
  const domain = await findActiveDomain(context, scope, domainId);
  assertUnverified(domain);

  const open = await pendingChallenge(context, domain.id);
  if (open && open.expiresAt > context.now.getTime()) return instructions(open);

  const challenge = {
    id: newId("dvf"),
    recordName: `${RECORD_PREFIX}.${domain.host}`,
    recordValue: `${VALUE_PREFIX}${randomToken(24)}`,
    expiresAt: context.now.getTime() + VERIFICATION_TTL_MS,
  };
  const changeId = newChangeId();
  const guard = appliedClause({ table: "website_domains", id: domain.id, changeId });
  const actor = stillAuthorized(scope);
  try {
    const [updated] = await atomic(context.d1, [
      raw(
        `update website_domains set verification_status = 'pending', change_id = ?
          where id = ? and website_id = ? and status = 'active' and verification_status <> 'verified' and ${actor.sql}`,
        changeId,
        domain.id,
        scope.websiteId,
        ...actor.params,
      ),
      // Only an expired record is closed. If another request just created a live one, the insert below
      // hits the one-open-record index and that record is returned instead of being invalidated.
      raw(
        `update domain_verifications set status = 'expired' where domain_id = ? and status = 'pending' and expires_at <= ? and ${guard.sql}`,
        domain.id,
        context.now,
        ...guard.params,
      ),
      raw(
        `insert into domain_verifications (id, organization_id, website_id, domain_id, method, record_name, record_value, status, attempts, expires_at, created_by_user_id, created_at)
         select ?, ?, ?, ?, 'dns_txt', ?, ?, 'pending', 0, ?, ?, ? where ${guard.sql}`,
        challenge.id,
        scope.organizationId,
        scope.websiteId,
        domain.id,
        challenge.recordName,
        challenge.recordValue,
        challenge.expiresAt,
        scope.userId,
        context.now,
        ...guard.params,
      ),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "domain.verification_started", { domain: domain.host }, { type: "domain", id: domain.id }),
        guard,
      ),
    ]);
    if (updated === 0) throw conflict("domain_changed", "This domain changed. Reload and try again.");
  } catch (error) {
    // Two requests at once: the other one created the challenge.
    if (isUniqueViolation(error, "domain_verifications.domain_id")) {
      const winner = await pendingChallenge(context, domain.id);
      if (winner) return instructions(winner);
    }
    throw error;
  }
  return instructions(challenge);
}

export type CheckFailure = "dns_lookup_failed" | "record_not_found" | "value_mismatch";

/** Looks the record up now. "Not found yet" is a normal result (verified: false), not an error. */
export async function checkVerification(context: ApiContext, scope: WebsiteScope, domainId: string) {
  if (scope.websiteStatus === "archived") throw conflict("website_archived", "Restore the website before verifying its domains.");
  const domain = await findActiveDomain(context, scope, domainId);
  assertUnverified(domain);
  const challenge = await pendingChallenge(context, domain.id);
  if (!challenge) throw conflict("no_open_challenge", "Start verification first.");
  const nowMs = context.now.getTime();
  if (challenge.expiresAt <= nowMs) throw conflict("challenge_expired", "The verification record expired. Start verification again.");
  if (challenge.lastCheckedAt !== null && nowMs - challenge.lastCheckedAt < VERIFICATION_CHECK_COOLDOWN_MS) {
    throw new ApiError(429, "too_soon", "Wait a few seconds before checking again.");
  }

  const lookup = await lookupTxt(challenge.recordName);
  const failure: CheckFailure | null = !lookup.ok
    ? "dns_lookup_failed"
    : lookup.values.includes(challenge.recordValue)
      ? null
      : lookup.values.length === 0
        ? "record_not_found"
        : "value_mismatch";

  if (failure) {
    await prepare(
      context.d1,
      raw(
        `update domain_verifications set attempts = attempts + 1, last_checked_at = ?, last_error_code = ? where id = ? and status = 'pending'`,
        context.now,
        failure,
        challenge.id,
      ),
    ).run();
    return { verified: false as const, reason: failure, challenge: instructions(challenge) };
  }

  const changeId = newChangeId();
  const guard = appliedClause({ table: "domain_verifications", id: challenge.id, changeId });
  const actor = stillAuthorized(scope);
  try {
    const [updated] = await atomic(context.d1, [
      raw(
        `update domain_verifications set status = 'verified', verified_at = ?, attempts = attempts + 1, last_checked_at = ?, last_error_code = null, change_id = ?
          where id = ? and status = 'pending' and expires_at > ? and ${actor.sql}`,
        context.now,
        context.now,
        changeId,
        challenge.id,
        context.now,
        ...actor.params,
      ),
      raw(
        `update website_domains set verification_status = 'verified', verified_at = ? where id = ? and status = 'active' and ${guard.sql}`,
        context.now,
        domain.id,
        ...guard.params,
      ),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "domain.verified", { domain: domain.host, method: "dns_txt" }, { type: "domain", id: domain.id }),
        guard,
      ),
    ]);
    if (updated === 0) throw conflict("domain_changed", "This domain changed. Reload and try again.");
  } catch (error) {
    // The platform-wide unique index on verified hosts.
    if (isUniqueViolation(error, "website_domains.host")) throw domainVerifiedElsewhere();
    throw error;
  }
  return { verified: true as const, domains: await listDomains(context, scope) };
}
