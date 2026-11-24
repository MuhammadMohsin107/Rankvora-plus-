/**
 * Client-side form validation helpers for store setup and settings.
 * Light, deterministic, no server imports. The real service validates again.
 */

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".test", ".invalid"];

export type HostResult = { host: string; error?: undefined } | { host?: undefined; error: string };

/** "https://Shop.Example.com/path" → "shop.example.com". Keeps "www.". */
export function normalizeWebsite(input: string): HostResult {
  const raw = input.trim();
  if (!raw) return { error: "Domain is required." };

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[^/]*:\d+(\/|$)/.test(raw)) {
    return { error: "Only http and https websites are supported." };
  }

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return { error: "Enter a valid domain, e.g. example.com." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "Only http and https websites are supported." };
  if (url.username || url.password) return { error: "Remove credentials from the address." };

  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!host) return { error: "Domain is required." };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return { error: "An IP address is not a valid website domain." };
  const labels = host.split(".");
  if (labels.length < 2) return { error: "Include a top-level domain, e.g. example.com." };
  if (!labels.every((label) => LABEL_RE.test(label))) return { error: "That is not a valid domain." };
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return { error: "That domain has no valid ending." };
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return { error: "Use a public domain." };
  return { host };
}

/** Optional http(s) URL. Returns an error message or null. */
export function validateOptionalUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "Use an http or https address.";
    return null;
  } catch {
    return "Enter a full address, e.g. https://example.com/page.";
  }
}

export function validateRequired(value: string, label: string, min = 1, max = 120): string | null {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (trimmed.length < min) return `${label} must be at least ${min} characters.`;
  if (trimmed.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

