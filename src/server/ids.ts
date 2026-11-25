/** Identifiers, one-time tokens and hashing. Web Crypto only, so it runs on Workers and in Node. */

export type IdPrefix = "org" | "mem" | "inv" | "web" | "dom" | "dvf" | "act" | "sec" | "urs" | "ule" | "req";

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

/** Marks one write, see `server/db/atomic.ts`. */
export function newChangeId(): string {
  return crypto.randomUUID();
}

export function randomToken(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buffer))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
