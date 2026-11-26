/**
 * The brand profile. Every save is a new immutable version, so audits and runs can keep pointing at
 * the one they used. A save names the version it started from.
 */
import { z } from "zod";

import { atomic, insertedClause, isUniqueViolation, prepare, raw } from "../../db/atomic";
import { invalid, versionConflict } from "../../http/errors";
import type { ApiContext } from "../../http/handler";
import { newId } from "../../ids";
import { activityStatement } from "../../logs/activity";
import { assertWritableWebsite, stillAuthorized, websiteWritable, type WebsiteScope } from "../../tenancy/guard";
import { boundedText, nameList } from "../../validation";
import { websiteActivity } from "../websites/service";

const optionalText = (label: string, max: number) => boundedText(label, 1, max, "multiple").nullish();

export const saveBrandProfileSchema = z.strictObject({
  /** The version the editor started from; 0 when there is none yet. */
  baseVersion: z.number({ error: "baseVersion is required." }).int().min(0),
  officialName: boundedText("Official brand name", 2, 80),
  displayNames: nameList("Display names", 10).default([]),
  aliases: nameList("Aliases", 30).default([]),
  abbreviations: nameList("Abbreviations", 10, 20).default([]),
  description: optionalText("Description", 1000),
  targetAudience: optionalText("Target audience", 500),
  differentiators: nameList("Differentiators", 20, 200).default([]),
  voice: optionalText("Brand voice", 500),
  contentSummary: optionalText("Content summary", 600),
  changeNote: boundedText("What changed", 1, 120).nullish(),
});

const CONTENT_FIELDS = [
  "officialName",
  "displayNames",
  "aliases",
  "abbreviations",
  "description",
  "targetAudience",
  "differentiators",
  "voice",
  "contentSummary",
] as const;

type Row = {
  id: string;
  version: number;
  officialName: string;
  displayNames: string;
  aliases: string;
  abbreviations: string;
  description: string | null;
  targetAudience: string | null;
  differentiators: string;
  voice: string | null;
  contentSummary: string | null;
  changeNote: string | null;
  createdByName: string;
  createdAt: number;
};

const SELECT = `select id as id, version as version, official_name as officialName, display_names as displayNames, aliases as aliases,
    abbreviations as abbreviations, description as description, target_audience as targetAudience, differentiators as differentiators,
    voice as voice, content_summary as contentSummary, change_note as changeNote, created_by_name as createdByName, created_at as createdAt
  from brand_profile_versions`;

const list = (value: string) => JSON.parse(value) as string[];

const toDto = (row: Row) => ({
  ...row,
  displayNames: list(row.displayNames),
  aliases: list(row.aliases),
  abbreviations: list(row.abbreviations),
  differentiators: list(row.differentiators),
  createdAt: new Date(row.createdAt).toISOString(),
});

async function versionsOf(context: ApiContext, scope: WebsiteScope, limit: number) {
  const { results } = await prepare(
    context.d1,
    raw(`${SELECT} where website_id = ? and organization_id = ? order by version desc limit ?`, scope.websiteId, scope.organizationId, limit),
  ).all<Row>();
  return results.map(toDto);
}

export async function getBrandProfile(context: ApiContext, scope: WebsiteScope) {
  const versions = await versionsOf(context, scope, 100);
  return { current: versions[0] ?? null, versions };
}

/** Every name the brand goes by, to tell brand-specific prompts from neutral ones. */
export async function brandNames(context: ApiContext, scope: WebsiteScope): Promise<string[]> {
  const [profile] = await versionsOf(context, scope, 1);
  if (profile) return [profile.officialName, ...profile.displayNames, ...profile.aliases, ...profile.abbreviations];
  const website = await prepare(context.d1, raw(`select name as name from websites where id = ?`, scope.websiteId)).first<{ name: string }>();
  return website ? [website.name] : [];
}

export async function saveBrandProfile(context: ApiContext, scope: WebsiteScope, input: z.output<typeof saveBrandProfileSchema>) {
  assertWritableWebsite(scope);
  const [current] = await versionsOf(context, scope, 1);
  if ((current?.version ?? 0) !== input.baseVersion) throw versionConflict();
  const next = {
    officialName: input.officialName,
    displayNames: input.displayNames,
    aliases: input.aliases,
    abbreviations: input.abbreviations,
    description: input.description ?? null,
    targetAudience: input.targetAudience ?? null,
    differentiators: input.differentiators,
    voice: input.voice ?? null,
    contentSummary: input.contentSummary ?? null,
  };
  if (current && CONTENT_FIELDS.every((field) => JSON.stringify(next[field]) === JSON.stringify(current[field]))) {
    throw invalid({ officialName: "Nothing changed since the current version." });
  }

  const id = newId("bpv");
  const version = input.baseVersion + 1;
  const writable = websiteWritable(scope);
  const actor = stillAuthorized(scope);
  let inserted: number;
  try {
    [inserted] = await atomic(context.d1, [
      raw(
        `insert into brand_profile_versions (id, organization_id, website_id, version, official_name, display_names, aliases, abbreviations,
           description, target_audience, differentiators, voice, content_summary, change_note, created_by_user_id, created_by_name, created_at)
         select ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          where (select coalesce(max(version), 0) from brand_profile_versions where website_id = ?) = ? and ${writable.sql} and ${actor.sql}`,
        id,
        scope.organizationId,
        scope.websiteId,
        version,
        next.officialName,
        JSON.stringify(next.displayNames),
        JSON.stringify(next.aliases),
        JSON.stringify(next.abbreviations),
        next.description,
        next.targetAudience,
        JSON.stringify(next.differentiators),
        next.voice,
        next.contentSummary,
        input.changeNote ?? null,
        scope.userId,
        scope.userName,
        context.now,
        scope.websiteId,
        input.baseVersion,
        ...writable.params,
        ...actor.params,
      ),
      activityStatement(
        websiteActivity(context, scope, scope.websiteId, "brand.profile_saved", { version }, { type: "brand_profile", id }),
        insertedClause("brand_profile_versions", id),
      ),
    ]);
  } catch (error) {
    if (isUniqueViolation(error, "brand_profile_versions.website_id")) throw versionConflict();
    throw error;
  }
  if (inserted === 0) throw versionConflict();
  context.commit();
  return getBrandProfile(context, scope);
}
