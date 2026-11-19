import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Pool } from "pg";

import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool?: Pool };

// Pool connects lazily, so importing this file (e.g. during `next build`)
// never opens a database connection.
function createPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

// Reuse one Pool across hot reloads in development so connections don't pile up.
export const pool = globalForDb.pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });

/** Either the shared `db` or a transaction handle; services accept both. */
export type DbOrTx = PgDatabase<NodePgQueryResultHKT, typeof schema>;
