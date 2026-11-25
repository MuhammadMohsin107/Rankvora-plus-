/**
 * A website's domains. Rows are never rewritten to a different host or deleted: replacing a domain
 * retires the old row, and the retired rows are the domain history.
 */
import { z } from "zod";

import { MAX_ACTIVE_DOMAINS_PER_WEBSITE } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw } from "../../db/atomic";
import type { ChallengeStatus, DomainKind, DomainStatus, DomainVerificationStatus } from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { stillAuthorized, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, version } from "../../validation";
import { domainInput, domainInUse, domainVerifiedElsewhere, parseHost, websiteActivity } from "./service";

export const addDomainSchema = z.strictObject({ domain: domainInput, kind: z.enum(["alias", "redirect"]) });
export const retireDomainSchema = z.strictObject({ reason: boundedText("Reason", 1, 200).optional() });
export const changeMainDomainSchema = z.strictObject({ domain: domainInput, version, reason: boundedText("Reason", 1, 200).optional() });

export type DomainRow = {
  id: string;
  host: string;
  kind: DomainKind;
  status: DomainStatus;
  verificationStatus: DomainVerificationStatus;
  verifiedAt: number | null;
  createdAt: number;
  retiredAt: number | null;
  retiredReason: string | null;
};

type ChallengeRow = {
  domainId: string;
  recordName: string;
  recordValue: string;
  status: ChallengeStatus;
  attempts: number;
  lastCheckedAt: number | null;
  lastErrorCode: string | null;
  expiresAt: number;
};

const DOMAIN_COLUMNS = `id as id, host as host, kind as kind, status as status, verification_status as verificationStatus,
  verified_at as verifiedAt, created_at as createdAt, retired_at as retiredAt, retired_reason as retiredReason`;

const iso = (value: number | null) => (value === null ? null : new Date(value).toISOString());

const editable = (scope: WebsiteScope) => {
  if (scope.websiteStatus === "archived") throw conflict("website_archived", "Restore the website before changing its domains.");
};

export async function findActiveDomain(context: ApiContext, scope: WebsiteScope, domainId: string): Promise<DomainRow> {
  const row = await prepare(
    context.d1,
    raw(
      `select ${DOMAIN_COLUMNS} from website_domains where id = ? and website_id = ? and organization_id = ? and status = 'active'`,
      domainId,
      scope.websiteId,
      scope.organizationId,
    ),
  ).first<DomainRow>();
  if (!row) throw notFound();
  return row;
}

/** Active domains first (the main one on top), then the retired ones, newest first. */
export async function listDomains(context: ApiContext, scope: WebsiteScope) {
  const [domains, challenges] = await context.d1.batch([
    prepare(
      context.d1,
      raw(
        `select ${DOMAIN_COLUMNS} from website_domains where website_id = ? and organization_id = ?
          order by case status when 'active' then 0 else 1 end, case kind when 'canonical' then 0 else 1 end, coalesce(retired_at, created_at) desc, id
          limit 200`,
        scope.websiteId,
        scope.organizationId,
      ),
    ),
    prepare(
      context.d1,
      raw(
        `select domain_id as domainId, record_name as recordName, record_value as recordValue, status as status, attempts as attempts,
                last_checked_at as lastCheckedAt, last_error_code as lastErrorCode, expires_at as expiresAt
           from domain_verifications where website_id = ? and organization_id = ? and status = 'pending'`,
        scope.websiteId,
        scope.organizationId,
      ),
    ),
  ]);
  const pending = new Map((challenges.results as ChallengeRow[]).map((row) => [row.domainId, row]));
  return (domains.results as DomainRow[]).map((row) => {
    const challenge = pending.get(row.id);
    return {
      ...row,
      verifiedAt: iso(row.verifiedAt),
      createdAt: iso(row.createdAt) as string,
      retiredAt: iso(row.retiredAt),
      challenge: challenge
        ? {
            recordType: "TXT" as const,
            recordName: challenge.recordName,
            recordValue: challenge.recordValue,
            attempts: challenge.attempts,
            lastCheckedAt: iso(challenge.lastCheckedAt),
            lastErrorCode: challenge.lastErrorCode,
            expiresAt: iso(challenge.expiresAt) as string,
            expired: challenge.expiresAt <= context.now.getTime(),
          }
        : null,
    };
  });
}

async function assertHostFree(context: ApiContext, scope: WebsiteScope, host: string, allowOwn: boolean) {
  const row = await prepare(
    context.d1,
    raw(
      `select id as id, website_id as websiteId from website_domains where organization_id = ? and host = ? and status = 'active'`,
      scope.organizationId,
      host,
    ),
  ).first<{ id: string; websiteId: string }>();
  if (!row) return null;
  if (row.websiteId === scope.websiteId) {
    if (allowOwn) return row.id;
    throw invalid({ domain: "This website already has that domain." });
  }
  throw domainInUse();
}

export async function addDomain(context: ApiContext, scope: WebsiteScope, input: z.output<typeof addDomainSchema>) {
  editable(scope);
  const host = parseHost(input.domain);
  await assertHostFree(context, scope, host, false);

  const id = newId("dom");
  const changeId = newChangeId();
  const actor = stillAuthorized(scope);
  let results: number[];
  try {
    results = await atomic(context.d1, [
      raw(
        `insert into website_domains (id, organization_id, website_id, host, kind, status, verification_status, created_by_user_id, change_id, created_at)
         select ?, ?, ?, ?, ?, 'active', 'unverified', ?, ?, ?
          where (select count(*) from website_domains where website_id = ? and status = 'active') < ?
            and exists (select 1 from websites where id = ? and organization_id = ? and status in ('draft', 'active', 'paused'))
            and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        host,
        input.kind,
        scope.userId,
        changeId,
        context.now,
        scope.websiteId,
        MAX_ACTIVE_DOMAINS_PER_WEBSITE,
        scope.websiteId,
        scope.organizationId,
        ...actor.params,
      ),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "domain.added", { domain: host, kind: input.kind }, { type: "domain", id }),
        appliedClause({ table: "website_domains", id, changeId }),
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "website_domains.organization_id", "website_domains.host")) throw domainInUse();
    throw error;
  }
  if (results[0] === 0) {
    throw conflict("domain_not_added", `The domain was not added. A website can have up to ${MAX_ACTIVE_DOMAINS_PER_WEBSITE} domains; reload and try again.`);
  }
  context.commit();
  return listDomains(context, scope);
}

export async function retireDomain(context: ApiContext, scope: WebsiteScope, domainId: string, input: z.output<typeof retireDomainSchema>) {
  editable(scope);
  const domain = await findActiveDomain(context, scope, domainId);
  if (domain.kind === "canonical") throw conflict("main_domain_required", "Change the main domain instead of removing it.");

  const changeId = newChangeId();
  const guard = appliedClause({ table: "website_domains", id: domain.id, changeId });
  const actor = stillAuthorized(scope);
  const [retired] = await atomic(context.d1, [
    raw(
      `update website_domains set status = 'retired', retired_at = ?, retired_reason = ?, change_id = ?
        where id = ? and website_id = ? and status = 'active' and kind <> 'canonical' and ${actor.sql}`,
      context.now,
      input.reason ?? "removed",
      changeId,
      domain.id,
      scope.websiteId,
      ...actor.params,
    ),
    raw(`update domain_verifications set status = 'superseded' where domain_id = ? and status = 'pending' and ${guard.sql}`, domain.id, ...guard.params),
    activityStatement(
      websiteActivity(context, scope, scope.websiteId, "domain.removed", { domain: domain.host }, { type: "domain", id: domain.id }),
      guard,
    ),
  ]);
  if (retired === 0) throw versionConflict();
  return listDomains(context, scope);
}

/**
 * Replaces the main domain. Promoting a domain the website already lists keeps its proof of
 * ownership; a new host starts unverified. The old main domain moves to the history.
 */
export async function changeMainDomain(context: ApiContext, scope: WebsiteScope, input: z.output<typeof changeMainDomainSchema>) {
  editable(scope);
  const host = parseHost(input.domain);
  const current = await prepare(
    context.d1,
    raw(`select host from website_domains where website_id = ? and organization_id = ? and kind = 'canonical' and status = 'active'`, scope.websiteId, scope.organizationId),
  ).first<{ host: string }>();
  if (current?.host === host) throw invalid({ domain: "This is already the main domain." });
  await assertHostFree(context, scope, host, true);

  const changeId = newChangeId();
  const guard = appliedClause({ table: "websites", id: scope.websiteId, changeId });
  const actor = stillAuthorized(scope);
  const newDomainId = newId("dom");
  const { now } = context;
  // The row for this host that this batch retires, if it was verified.
  const promotedProof = `from website_domains where website_id = ? and host = ? and change_id = ? and status = 'retired' and verification_status = 'verified'`;
  let results: number[];
  try {
    results = await atomic(context.d1, [
      raw(
        `update websites set version = version + 1, change_id = ?, updated_at = ?
          where id = ? and organization_id = ? and version = ? and status in ('draft', 'active', 'paused') and ${actor.sql}`,
        changeId,
        now,
        scope.websiteId,
        scope.organizationId,
        input.version,
        ...actor.params,
      ),
      raw(
        `update domain_verifications set status = 'superseded'
          where website_id = ? and status = 'pending'
            and domain_id in (select id from website_domains where website_id = ? and status = 'active' and (kind = 'canonical' or host = ?))
            and ${guard.sql}`,
        scope.websiteId,
        scope.websiteId,
        host,
        ...guard.params,
      ),
      // Retire before inserting: only one active main domain is allowed.
      raw(
        `update website_domains set status = 'retired', retired_at = ?, retired_reason = case when kind = 'canonical' then ? else 'promoted_to_main' end,
            change_id = ?
          where website_id = ? and status = 'active' and (kind = 'canonical' or host = ?) and ${guard.sql}`,
        now,
        input.reason ?? "main_domain_changed",
        changeId,
        scope.websiteId,
        host,
        ...guard.params,
      ),
      // Ownership proof comes only from the row retired just above, inside the same transaction.
      raw(
        `insert into website_domains (id, organization_id, website_id, host, kind, status, verification_status, verified_at, created_by_user_id, created_at)
         select ?, ?, ?, ?, 'canonical', 'active',
           case when exists (select 1 ${promotedProof}) then 'verified' else 'unverified' end,
           (select verified_at ${promotedProof}),
           ?, ?
         where ${guard.sql}`,
        newDomainId,
        scope.organizationId,
        scope.websiteId,
        host,
        scope.websiteId,
        host,
        changeId,
        scope.websiteId,
        host,
        changeId,
        scope.userId,
        now,
        ...guard.params,
      ),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "domain.main_changed", { from: current?.host, to: host, reason: input.reason }, { type: "domain", id: newDomainId }),
        guard,
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "website_domains.organization_id", "website_domains.host")) throw domainInUse();
    // Checked second: the message above also names website_domains.host.
    if (isUniqueViolation(error, "website_domains.host")) throw domainVerifiedElsewhere();
    throw error;
  }
  if (results[0] === 0) throw versionConflict();
  return listDomains(context, scope);
}
