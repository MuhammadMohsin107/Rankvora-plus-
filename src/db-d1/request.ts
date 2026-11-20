/** Pure request helpers for the demo-state API (cookie id, same-origin check). Unit-tested in request.test.ts. */

export const WORKSPACE_COOKIE = "rv_ws";
export const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year, in seconds

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Returns the cookie value when it is a UUID, otherwise null (the route then issues a new id). */
export function parseWorkspaceCookie(value: string | undefined | null): string | null {
  return value && UUID.test(value) ? value.toLowerCase() : null;
}

/**
 * Same-origin check for state-changing requests: the Origin header must be present and
 * its host must equal the Host header. Missing Origin is rejected (browsers always send it
 * on fetch PUT/DELETE; scripts must set it deliberately).
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function isJsonContentType(value: string | null): boolean {
  return !!value && /^application\/json\s*(;|$)/i.test(value);
}
