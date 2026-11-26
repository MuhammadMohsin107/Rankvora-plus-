/** Server-side input rules shared by the modules. */
import { z } from "zod";

import { DomainError, normalizeAliases, normalizeHost } from "@/lib/domain";

import { invalid } from "./http/errors";

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "body";
    fields[path] ??= issue.message;
  }
  throw invalid(fields);
}

type Lines = "single" | "multiple";

const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const DELETE = 127;
/** The Unicode line and paragraph separators. Compared as numbers: as literal characters they break source files. */
const UNICODE_BREAKS = new Set([0x2028, 0x2029]);

/**
 * "single" allows no control character or line break, so a value cannot add lines to an email
 * subject or a log. "multiple" also allows tab, line feed and carriage return.
 */
function hasForbiddenCharacter(value: string, lines: Lines): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code === DELETE || UNICODE_BREAKS.has(code)) return true;
    if (code < 32) {
      const layout = code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
      if (lines === "single" || !layout) return true;
    }
  }
  return false;
}

/** Text kept exactly as written apart from the ends, for example a prompt sent to a provider. */
export function exactText(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !hasForbiddenCharacter(value, "multiple"), `${label} contains characters that are not allowed.`),
    );
}

const LINK = /:\/\/|www\./i;

/** Trimmed, single-spaced text within length limits. */
export function boundedText(label: string, min: number, max: number, lines: Lines = "single") {
  return z
    .string({ error: `${label} is required.` })
    .transform((value) => value.trim().replace(/[ \t]+/g, " "))
    .pipe(
      z
        .string()
        .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be ${max} characters or fewer.`)
        .refine((value) => !hasForbiddenCharacter(value, lines), `${label} contains characters that are not allowed.`),
    );
}

/** A person or organization name. These are quoted in invitation emails, so they cannot carry links. */
export function displayName(label: string) {
  return boundedText(label, 2, 80).refine((value) => !LINK.test(value), `${label} cannot contain a link.`);
}

export function isIanaTimezone(value: string): boolean {
  // Offsets such as "+05:00" are accepted by Intl but are not IANA zones and ignore daylight saving.
  if (!/^[A-Za-z]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timezone = z.string({ error: "Time zone is required." }).refine(isIanaTimezone, "Choose a valid time zone.");

const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });

/** ISO 3166-1 alpha-2, stored uppercase. */
export const market = z
  .string({ error: "Market is required." })
  .transform((value) => value.trim().toUpperCase())
  .pipe(z.string().refine((code) => /^[A-Z]{2}$/.test(code) && code !== "ZZ" && regionNames.of(code) !== undefined, "Choose a valid country."));

function canonicalLanguage(value: string): string | null {
  try {
    const [tag] = Intl.getCanonicalLocales(value.trim());
    return tag && languageNames.of(new Intl.Locale(tag).language) !== undefined ? tag : null;
  } catch {
    return null;
  }
}

/** BCP 47 tag, stored canonicalized ("en", "en-GB", "zh-Hant"). */
export const language = z
  .string({ error: "Language is required." })
  .refine((value) => canonicalLanguage(value) !== null, "Choose a valid language.")
  .transform((value) => canonicalLanguage(value) as string);

export const email = z
  .string({ error: "Email is required." })
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address.").max(254, "Email is too long."));

/** A list of short names, trimmed, with case-insensitive duplicates removed. */
export function nameList(label: string, maxItems: number, maxLength = 80) {
  return z
    .array(boundedText(label, 1, maxLength), { error: `${label} must be a list.` })
    .max(maxItems, `Add up to ${maxItems}.`)
    .transform(normalizeAliases);
}

/** Why a page address is refused, or its normalised form. Only public http(s) pages are accepted. */
export function publicPageUrl(value: string): { url: string; host: string } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { error: "Enter a full address, starting with https://." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: "Only http and https pages are accepted." };
  if (parsed.username || parsed.password) return { error: "The address must not contain a user name or password." };
  if (parsed.port) return { error: "The address must not contain a port." };
  let host: string;
  try {
    host = normalizeHost(parsed.hostname);
  } catch (error) {
    return { error: error instanceof DomainError ? error.message : "The address is not a public website." };
  }
  parsed.hostname = host;
  parsed.hash = "";
  return { url: parsed.toString(), host };
}

/** A public page address, stored normalised. */
export const pageUrl = z
  .string({ error: "Enter a page address." })
  .max(500, "The address is too long.")
  .transform((value, context) => {
    const result = publicPageUrl(value);
    if ("error" in result) {
      context.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.url;
  });

/** The version the client read, for optimistic concurrency. */
export const version = z.number({ error: "version is required." }).int().min(1);

export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .regex(/^\d{1,15}_[A-Za-z0-9_]{1,64}$/, "Invalid cursor.")
    .optional(),
});
