import { z } from "zod";

import { competitorStatus, recordSource, storePlatform } from "@/db/schema";
import {
  DomainError,
  normalizeAliases,
  normalizeHost,
  normalizeHostList,
} from "@/lib/domain";

import { TenancyError } from "./errors";

export function parseInput<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new TenancyError(
      "validation",
      z.prettifyError(result.error),
      result.error.issues,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Field building blocks
// ---------------------------------------------------------------------------

export const uuid = z.guid();

export const requiredText = (max: number) => z.string().trim().min(1).max(max);

// "" becomes null so clients can clear an optional field.
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const host = z.string().transform((value, ctx) => {
  try {
    return normalizeHost(value);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof DomainError ? error.message : "Invalid domain.",
    });
    return z.NEVER;
  }
});

const hostList = z
  .array(z.string())
  .max(20)
  .transform((values, ctx) => {
    try {
      return normalizeHostList(values);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message:
          error instanceof DomainError ? error.message : "Invalid domain.",
      });
      return z.NEVER;
    }
  });

const aliasList = z
  .array(z.string().max(120))
  .max(50)
  .transform(normalizeAliases);

export const market = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a two-letter country code, e.g. PK.")
  .refine((code) => {
    try {
      return (
        new Intl.DisplayNames(["en"], { type: "region", fallback: "none" }).of(
          code,
        ) !== undefined
      );
    } catch {
      return false;
    }
  }, "Unknown country code.");

export const language = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/,
    "Use a language code such as en or en-GB.",
  );

const timezone = z
  .string()
  .trim()
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Unknown time zone. Use an IANA name such as Asia/Karachi.");

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const createOrganizationInput = z.object({
  name: requiredText(120),
  timezoneDefault: timezone.optional(),
});

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export const createStoreInput = z.object({
  organizationId: uuid,
  name: requiredText(120),
  platformType: z.enum(storePlatform.enumValues),
  canonicalDomain: host,
  market,
  language,
  timezone: timezone.optional(),
  industry: optionalText(120),
  description: optionalText(2000),
  brandGroupId: uuid.nullable().optional(),
  brandName: requiredText(120),
  brandAliases: aliasList.optional(),
});

export const updateStoreInput = z
  .object({
    name: requiredText(120),
    platformType: z.enum(storePlatform.enumValues),
    canonicalDomain: host,
    confirmDomainChange: z.boolean(),
    market,
    language,
    timezone,
    industry: optionalText(120),
    description: optionalText(2000),
    brandGroupId: uuid.nullable(),
  })
  .partial();

export const storeStatusInput = z.enum([
  "draft",
  "needs_review",
  "ready",
  "active",
  "paused",
  "archived",
]);

export const storeDomainInput = z.object({
  host,
  kind: z.enum(["alias", "redirect"]),
});

// ---------------------------------------------------------------------------
// Brand profile
// ---------------------------------------------------------------------------

export const brandProfileInput = z.object({
  brandName: requiredText(120),
  legalName: optionalText(200),
  aliases: aliasList.default([]),
  description: optionalText(2000),
  differentiators: optionalText(2000),
  targetAudience: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Competitors
// ---------------------------------------------------------------------------

export const createCompetitorInput = z.object({
  name: requiredText(120),
  aliases: aliasList.default([]),
  domains: hostList.default([]),
  market: market.nullable().optional(),
  competitorType: optionalText(60),
  source: z.enum(recordSource.enumValues).default("manual"),
  status: z.enum(competitorStatus.enumValues).optional(),
});

export const updateCompetitorInput = z
  .object({
    name: requiredText(120),
    aliases: aliasList,
    domains: hostList,
    market: market.nullable(),
    competitorType: optionalText(60),
  })
  .partial();

export const competitorStatusInput = z.enum(competitorStatus.enumValues);

// ---------------------------------------------------------------------------
// Products and services
// ---------------------------------------------------------------------------

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a full http(s) URL.");

const facts = z
  .record(z.string(), z.unknown())
  .refine(
    (value) => JSON.stringify(value).length <= 20_000,
    "Facts are too large.",
  );

export const createProductServiceInput = z.object({
  externalId: optionalText(200),
  title: requiredText(300),
  url: httpUrl.nullable().optional(),
  category: optionalText(200),
  facts: facts.default({}),
  source: z.enum(recordSource.enumValues).default("manual"),
  sourceUpdatedAt: z.coerce.date().nullable().optional(),
});

export const updateProductServiceInput = z
  .object({
    externalId: optionalText(200),
    title: requiredText(300),
    url: httpUrl.nullable(),
    category: optionalText(200),
    facts,
    sourceUpdatedAt: z.coerce.date().nullable(),
  })
  .partial();
