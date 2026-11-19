import { isIP } from "node:net";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

const RESERVED_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".intranet",
  ".lan",
  ".home",
  ".corp",
  ".test",
  ".invalid",
  ".example",
];

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * Turns a user-supplied website ("https://Shop.Example.com/path", "shop.example.com:443")
 * into a normalized public host name ("shop.example.com").
 *
 * - Lowercases and converts internationalized names to punycode.
 * - Drops scheme, path, query, port and a trailing dot.
 * - Keeps "www." (www.example.com and example.com are different hosts).
 * - Rejects IP addresses, single-label names and reserved/private suffixes.
 */
export function normalizeHost(input: string): string {
  const raw = input.trim();
  if (!raw) throw new DomainError("Domain is required.");

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (
    !hasScheme &&
    /^[a-z][a-z0-9+.-]*:/i.test(raw) &&
    !/^[^/]*:\d+(\/|$)/.test(raw)
  ) {
    throw new DomainError("Only http and https websites are supported.");
  }

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    throw new DomainError(`"${raw}" is not a valid domain.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DomainError("Only http and https websites are supported.");
  }
  if (url.username || url.password) {
    throw new DomainError("Domain must not contain credentials.");
  }

  const host = url.hostname.replace(/\.$/, "").toLowerCase();

  if (!host) throw new DomainError("Domain is required.");
  if (isIP(host) !== 0 || host.startsWith("[")) {
    throw new DomainError("An IP address is not a valid store domain.");
  }
  if (host.length > 253) throw new DomainError("Domain is too long.");

  const labels = host.split(".");
  if (labels.length < 2) {
    throw new DomainError(
      "Domain must include a top-level domain, e.g. example.com.",
    );
  }
  if (!labels.every((label) => LABEL_RE.test(label))) {
    throw new DomainError(`"${host}" is not a valid domain.`);
  }
  const tld = labels[labels.length - 1];
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(tld)) {
    throw new DomainError(`"${host}" does not have a valid top-level domain.`);
  }
  if (RESERVED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new DomainError(`"${host}" is not a public domain.`);
  }

  return host;
}

/** Normalizes a list of domains, removing duplicates while keeping order. */
export function normalizeHostList(inputs: readonly string[]): string[] {
  return [...new Set(inputs.map(normalizeHost))];
}

/**
 * Cleans a list of names/aliases: trims, drops empty entries and removes
 * case-insensitive duplicates (first spelling wins).
 */
export function normalizeAliases(inputs: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of inputs) {
    const value = item.trim().replace(/\s+/g, " ");
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}
