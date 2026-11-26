/**
 * Competitors of a website. A suggestion stays a suggestion until a person confirms it. Every change
 * keeps a full snapshot, and removal only hides the competitor, so past results still make sense.
 */
import { z } from "zod";

import { MAX_COMPETITORS_PER_WEBSITE, MAX_DOMAINS_PER_COMPETITOR } from "../../config/limits";
import { appliedClause, atomic, isUniqueViolation, prepare, raw, type Statement } from "../../db/atomic";
import type { CompetitorSource, CompetitorStatus } from "../../db/schema";
import { conflict, invalid, notFound, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newChangeId, newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, market, nameList, pageUrl, version } from "../../validation";
import { domainInput, parseHost, websiteActivity } from "../websites/service";

const name = boundedText("Name", 2, 80);
const domains = z.array(domainInput).max(MAX_DOMAINS_PER_COMPETITOR, `Add up to ${MAX_DOMAINS_PER_COMPETITOR} domains.`);
const category = boundedText("Business category", 1, 80);
const evidence = boundedText("Evidence", 1, 500, "multiple");

export const createCompetitorSchema = z.strictObject({
  name,
  domains: domains.default([]),
  aliases: nameList("Aliases", 30).default([]),
  /** Null or absent means every market. */
  market: market.nullish(),
  businessCategory: category.nullish(),
  evidence: evidence.nullish(),
  evidenceUrl: pageUrl.nullish(),
  /** "suggested" waits for a person to confirm it. */
  status: z.enum(["confirmed", "suggested"]).default("confirmed"),
  /** "suggestion" is written only by AI features (Phase 3). */
  source: z.enum(["owner", "imported"]).default("owner"),
});

export const updateCompetitorSchema = z
  .strictObject({
    version,
    name: name.optional(),
    domains: domains.optional(),
    aliases: nameList("Aliases", 30).optional(),
    market: market.nullable().optional(),
    businessCategory: category.nullable().optional(),
    evidence: evidence.nullable().optional(),
    evidenceUrl: pageUrl.nullable().optional(),
  })
  .refine((input) => Object.keys(input).length > 1, { message: "Nothing to change.", path: ["name"] });

export const COMPETITOR_ACTIONS = ["confirm", "archive", "restore"] as const;
export const competitorStatusSchema = z.strictObject({ version, action: z.enum(COMPETITOR_ACTIONS) });
export const removeCompetitorSchema = z.strictObject({ version });
export const listCompetitorsSchema = z.object({ status: z.enum(["suggested", "confirmed", "archived"]).optional() });

type Row = {
  id: string;
  name: string;
  aliases: string;
  market: string | null;
  businessCategory: string | null;
  status: CompetitorStatus;
  source: CompetitorSource;
  evidence: string | null;
  evidenceUrl: string | null;
  confirmedAt: number | null;
  confirmedByName: string | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

const SELECT = `select id as id, name as name, aliases as aliases, market as market, business_category as businessCategory, status as status,
    source as source, evidence as evidence, evidence_url as evidenceUrl, confirmed_at as confirmedAt, confirmed_by_name as confirmedByName,
    version as version, created_at as createdAt, updated_at as updatedAt
  from competitors`;

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());

const toDto = (row: Row, hosts: string[]) => ({
  ...row,
  aliases: JSON.parse(row.aliases) as string[],
  domains: hosts,
  confirmedAt: iso(row.confirmedAt),
  createdAt: iso(row.createdAt) as string,
  updatedAt: iso(row.updatedAt) as string,
});

export type CompetitorDto = ReturnType<typeof toDto>;

export async function listCompetitors(context: ApiContext, scope: WebsiteScope, status?: CompetitorStatus) {
  const [rows, domainRows] = await context.d1.batch([
    prepare(
      context.d1,
      raw(
        `${SELECT} where website_id = ? and organization_id = ? and removed_at is null${status ? " and status = ?" : ""}
          order by case status when 'confirmed' then 0 when 'suggested' then 1 else 2 end, name_key limit ?`,
        scope.websiteId,
        scope.organizationId,
        ...(status ? [status] : []),
        MAX_COMPETITORS_PER_WEBSITE,
      ),
    ),
    prepare(
      context.d1,
      raw(`select competitor_id as competitorId, host as host from competitor_domains where website_id = ? and organization_id = ? and removed_at is null order by host`, scope.websiteId, scope.organizationId),
    ),
  ]);
  const hosts = domainRows.results as { competitorId: string; host: string }[];
  return (rows.results as Row[]).map((row) => toDto(row, hosts.filter((domain) => domain.competitorId === row.id).map((domain) => domain.host)));
}

async function findCompetitor(context: ApiContext, scope: WebsiteScope, competitorId: string): Promise<CompetitorDto> {
  const [rows, domainRows] = await context.d1.batch([
    prepare(context.d1, raw(`${SELECT} where id = ? and website_id = ? and organization_id = ? and removed_at is null`, competitorId, scope.websiteId, scope.organizationId)),
    prepare(context.d1, raw(`select host as host from competitor_domains where competitor_id = ? and removed_at is null order by host`, competitorId)),
  ]);
  const row = (rows.results as Row[])[0];
  if (!row) throw notFound();
  return toDto(row, (domainRows.results as { host: string }[]).map((domain) => domain.host));
}

/** "www.example.com" and "example.com" are one company's site. A bare "www.pk" is left as it is. */
export const bare = (host: string) => (host.startsWith("www.") && host.split(".").length > 2 ? host.slice(4) : host);

/** Normalised competitor domains without "www.", refusing the website's own domains and their subdomains. */
async function competitorHosts(context: ApiContext, scope: WebsiteScope, values: string[]): Promise<string[]> {
  const hosts = [...new Set(values.map((value, index) => bare(parseHost(value, `domains.${index}`))))];
  if (hosts.length === 0) return hosts;
  const { results } = await prepare(context.d1, raw(`select host as host from website_domains where website_id = ? and status = 'active'`, scope.websiteId)).all<{ host: string }>();
  const own = results.map((row) => bare(row.host));
  const clash = hosts.find((host) => own.some((mine) => host === mine || host.endsWith(`.${mine}`)));
  if (clash) throw invalid({ domains: `${clash} belongs to this website.` });
  return hosts;
}

/** The fields a snapshot and the change comparison cover. */
const content = (competitor: {
  name: string;
  domains: string[];
  aliases: string[];
  market: string | null;
  businessCategory: string | null;
  evidence: string | null;
  evidenceUrl: string | null;
}) => ({
  name: competitor.name,
  domains: [...competitor.domains].sort(),
  aliases: competitor.aliases,
  market: competitor.market,
  businessCategory: competitor.businessCategory,
  evidence: competitor.evidence,
  evidenceUrl: competitor.evidenceUrl,
});

function revisionStatement(context: ApiContext, scope: WebsiteScope, competitorId: string, changeId: string, action: string, snapshot: object): Statement {
  return raw(
    `insert into competitor_revisions (id, organization_id, website_id, competitor_id, version, action, snapshot, changed_by_user_id, changed_by_name, created_at)
     select ?, organization_id, website_id, id, version, ?, ?, ?, ?, ? from competitors where id = ? and change_id = ?`,
    newId("cmr"),
    action,
    JSON.stringify(snapshot),
    scope.userId,
    scope.userName,
    context.now,
    competitorId,
    changeId,
  );
}

const activity = (context: ApiContext, scope: WebsiteScope, action: string, competitorId: string, competitorName: string) =>
  websiteActivity(context, scope, scope.websiteId, action, { name: competitorName }, { type: "competitor", id: competitorId });

/** Adds the hosts that are not yet active for this competitor. One statement, however many there are. */
function addDomainsStatement(context: ApiContext, scope: WebsiteScope, competitorId: string, hosts: string[], guard: Statement): Statement {
  return raw(
    `insert into competitor_domains (id, organization_id, website_id, competitor_id, host, created_at)
     select json_extract(j.value, '$.id'), ?, ?, ?, json_extract(j.value, '$.host'), ?
       from json_each(?) j
      where not exists (select 1 from competitor_domains d where d.competitor_id = ? and d.host = json_extract(j.value, '$.host') and d.removed_at is null)
        and ${guard.sql}`,
    scope.organizationId,
    scope.websiteId,
    competitorId,
    context.now,
    JSON.stringify(hosts.map((host) => ({ id: newId("cmd"), host }))),
    competitorId,
    ...guard.params,
  );
}

function translateDuplicate(error: unknown): never {
  if (isUniqueViolation(error, "competitors.website_id", "competitors.name_key")) throw conflict("competitor_exists", "A competitor with this name is already listed.");
  if (isUniqueViolation(error, "competitor_domains.website_id", "competitor_domains.host")) {
    throw conflict("competitor_domain_taken", "Another competitor of this website already lists one of these domains.");
  }
  throw error;
}

export async function createCompetitor(context: ApiContext, scope: WebsiteScope, input: z.output<typeof createCompetitorSchema>) {
  assertWritableWebsite(scope);
  const hosts = await competitorHosts(context, scope, input.domains);
  const record = {
    name: input.name,
    domains: hosts,
    aliases: input.aliases,
    market: input.market ?? null,
    businessCategory: input.businessCategory ?? null,
    evidence: input.evidence ?? null,
    evidenceUrl: input.evidenceUrl ?? null,
  };
  const confirmed = input.status === "confirmed";
  const id = newId("cmp");
  const changeId = newChangeId();
  const guard = appliedClause({ table: "competitors", id, changeId });
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  const { now } = context;
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into competitors (id, organization_id, website_id, name, name_key, aliases, market, business_category, status, source, evidence,
           evidence_url, confirmed_at, confirmed_by_name, version, created_by_user_id, change_id, created_at, updated_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?
          where (select count(*) from competitors where website_id = ? and removed_at is null) < ? and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        record.name,
        record.name.toLowerCase(),
        JSON.stringify(record.aliases),
        record.market,
        record.businessCategory,
        input.status,
        input.source,
        record.evidence,
        record.evidenceUrl,
        confirmed ? now : null,
        confirmed ? scope.userName : null,
        scope.userId,
        changeId,
        now,
        now,
        scope.websiteId,
        MAX_COMPETITORS_PER_WEBSITE,
        ...writable.params,
        ...actor.params,
      ),
      addDomainsStatement(context, scope, id, hosts, guard),
      revisionStatement(context, scope, id, changeId, "added", { ...content(record), status: input.status, source: input.source }),
      activityStatement(activity(context, scope, "competitor.added", id, record.name), guard),
    ]);
  } catch (error) {
    translateDuplicate(error);
  }
  if (inserted === 0) throw conflict("competitor_limit_reached", `A website can have up to ${MAX_COMPETITORS_PER_WEBSITE} competitors. Reload and try again.`);
  context.commit();
  return findCompetitor(context, scope, id);
}

function competitorGuard(scope: WebsiteScope, competitorId: string, readVersion: number): Statement {
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  return raw(
    `id = ? and website_id = ? and organization_id = ? and version = ? and removed_at is null and ${writable.sql} and ${actor.sql}`,
    competitorId,
    scope.websiteId,
    scope.organizationId,
    readVersion,
    ...writable.params,
    ...actor.params,
  );
}

export async function updateCompetitor(context: ApiContext, scope: WebsiteScope, competitorId: string, input: z.output<typeof updateCompetitorSchema>) {
  assertWritableWebsite(scope);
  const current = await findCompetitor(context, scope, competitorId);
  const hosts = input.domains === undefined ? current.domains : await competitorHosts(context, scope, input.domains);
  const next = {
    name: input.name ?? current.name,
    domains: hosts,
    aliases: input.aliases ?? current.aliases,
    market: input.market === undefined ? current.market : input.market,
    businessCategory: input.businessCategory === undefined ? current.businessCategory : input.businessCategory,
    evidence: input.evidence === undefined ? current.evidence : input.evidence,
    evidenceUrl: input.evidenceUrl === undefined ? current.evidenceUrl : input.evidenceUrl,
  };
  if (JSON.stringify(content(next)) === JSON.stringify(content(current))) throw invalid({ name: "Nothing changed." });

  const changeId = newChangeId();
  const guard = appliedClause({ table: "competitors", id: competitorId, changeId });
  const where = competitorGuard(scope, competitorId, input.version);
  let updated: number;
  try {
    [updated] = await atomic(context.d1, [
      raw(
        `update competitors set name = ?, name_key = ?, aliases = ?, market = ?, business_category = ?, evidence = ?, evidence_url = ?,
            version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`,
        next.name,
        next.name.toLowerCase(),
        JSON.stringify(next.aliases),
        next.market,
        next.businessCategory,
        next.evidence,
        next.evidenceUrl,
        changeId,
        context.now,
        ...where.params,
      ),
      raw(
        `update competitor_domains set removed_at = ? where competitor_id = ? and removed_at is null and host not in (select value from json_each(?)) and ${guard.sql}`,
        context.now,
        competitorId,
        JSON.stringify(hosts),
        ...guard.params,
      ),
      addDomainsStatement(context, scope, competitorId, hosts, guard),
      revisionStatement(context, scope, competitorId, changeId, "updated", { ...content(next), status: current.status, source: current.source }),
      activityStatement(activity(context, scope, "competitor.updated", competitorId, next.name), guard),
    ]);
  } catch (error) {
    translateDuplicate(error);
  }
  if (updated === 0) throw versionConflict();
  return findCompetitor(context, scope, competitorId);
}

/** The status after an action, or null when it is not allowed. A dismissed suggestion comes back as a suggestion. */
export function nextCompetitorStatus(current: CompetitorStatus, action: (typeof COMPETITOR_ACTIONS)[number], wasConfirmed: boolean): CompetitorStatus | null {
  if (action === "confirm") return current === "suggested" ? "confirmed" : null;
  if (action === "archive") return current === "archived" ? null : "archived";
  return current === "archived" ? (wasConfirmed ? "confirmed" : "suggested") : null;
}

export async function changeCompetitorStatus(context: ApiContext, scope: WebsiteScope, competitorId: string, input: z.output<typeof competitorStatusSchema>) {
  assertWritableWebsite(scope);
  const current = await findCompetitor(context, scope, competitorId);
  const status = nextCompetitorStatus(current.status, input.action, current.confirmedAt !== null);
  if (!status) throw conflict("invalid_transition", `You cannot ${input.action} a competitor that is ${current.status}.`);

  const changeId = newChangeId();
  const where = competitorGuard(scope, competitorId, input.version);
  const confirming = input.action === "confirm";
  const [updated] = await atomic(context.d1, [
    raw(
      `update competitors set status = ?, confirmed_at = coalesce(confirmed_at, ?), confirmed_by_name = coalesce(confirmed_by_name, ?),
          version = version + 1, change_id = ?, updated_at = ? where ${where.sql} and status = ?`,
      status,
      confirming ? context.now : null,
      confirming ? scope.userName : null,
      changeId,
      context.now,
      ...where.params,
      current.status,
    ),
    revisionStatement(context, scope, competitorId, changeId, input.action, { ...content(current), status, source: current.source }),
    activityStatement(activity(context, scope, `competitor.${input.action}`, competitorId, current.name), appliedClause({ table: "competitors", id: competitorId, changeId })),
  ]);
  if (updated === 0) throw versionConflict();
  return findCompetitor(context, scope, competitorId);
}

export async function removeCompetitor(context: ApiContext, scope: WebsiteScope, competitorId: string, input: z.output<typeof removeCompetitorSchema>) {
  assertWritableWebsite(scope);
  const current = await findCompetitor(context, scope, competitorId);
  const changeId = newChangeId();
  const guard = appliedClause({ table: "competitors", id: competitorId, changeId });
  const where = competitorGuard(scope, competitorId, input.version);
  const [updated] = await atomic(context.d1, [
    raw(`update competitors set removed_at = ?, version = version + 1, change_id = ?, updated_at = ? where ${where.sql}`, context.now, changeId, context.now, ...where.params),
    raw(`update competitor_domains set removed_at = ? where competitor_id = ? and removed_at is null and ${guard.sql}`, context.now, competitorId, ...guard.params),
    revisionStatement(context, scope, competitorId, changeId, "removed", { ...content(current), status: current.status, source: current.source }),
    activityStatement(activity(context, scope, "competitor.removed", competitorId, current.name), guard),
  ]);
  if (updated === 0) throw versionConflict();
  return { id: competitorId, removed: true as const };
}

/** Every change to a competitor, newest first, including after removal. */
export async function competitorHistory(context: ApiContext, scope: WebsiteScope, competitorId: string) {
  const { results } = await prepare(
    context.d1,
    raw(
      `select version as version, action as action, snapshot as snapshot, changed_by_name as changedByName, created_at as createdAt
         from competitor_revisions where competitor_id = ? and website_id = ? and organization_id = ? order by version desc limit 200`,
      competitorId,
      scope.websiteId,
      scope.organizationId,
    ),
  ).all<{ version: number; action: string; snapshot: string; changedByName: string; createdAt: number }>();
  if (results.length === 0) throw notFound();
  return results.map((row) => ({ ...row, snapshot: JSON.parse(row.snapshot) as Record<string, unknown>, createdAt: new Date(row.createdAt).toISOString() }));
}
