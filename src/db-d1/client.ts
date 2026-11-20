import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

export type D1Db = DrizzleD1Database<typeof schema>;

/**
 * The Cloudflare D1 binding `DB`, or null when there is none (plain `next build`,
 * `next start`, unit tests, a dev server that could not start the binding).
 * Callers must treat null as "D1 unavailable" and fall back, never crash.
 *
 * `getCloudflareContext` is imported lazily so that merely importing this
 * module never pulls the adapter into builds or tests.
 */
export async function getD1(): Promise<D1Database | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}

/** Drizzle instance bound to a D1 database (cheap; create one per request). */
export function createDb(d1: D1Database): D1Db {
  return drizzle(d1, { schema });
}

/** Drizzle instance for the current request's binding, or null when D1 is unavailable. */
export async function getDb(): Promise<D1Db | null> {
  const d1 = await getD1();
  return d1 ? createDb(d1) : null;
}
