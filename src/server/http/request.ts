import { isJsonContentType, isSameOrigin } from "@/db-d1/request";

import { ApiError, forbidden } from "./errors";

export const MAX_BODY_BYTES = 64 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated writes: the browser's Origin header must match the host
 * being called. Session cookies are also SameSite=Lax.
 */
export function assertSameOrigin(request: Request): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!isSameOrigin(origin, host)) throw forbidden("forbidden_origin", "Cross-origin requests are not allowed.");
}

const tooLarge = () => new ApiError(413, "too_large", "The request is too large.");

/** The body as text, size-limited and required to be JSON. */
export async function readBodyText(request: Request, maxBytes: number = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  const body = await request.text();
  if (!body) return "";
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new ApiError(415, "unsupported_media_type", "Send the body as application/json.");
  }
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw tooLarge();
  return body;
}

export function parseJson(body: string): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, "invalid_json", "The request body is not valid JSON.");
  }
}

/** Cloudflare sets `cf-connecting-ip`; it cannot be spoofed by the client on Workers. */
export function clientIp(request: Request): string | null {
  return request.headers.get("cf-connecting-ip");
}

export function userAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 300) ?? null;
}
