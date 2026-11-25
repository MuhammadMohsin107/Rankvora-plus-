/** Shared column helpers. Relative imports only: drizzle-kit does not resolve the "@/" alias. */
import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

/** Current time in milliseconds. The services set times themselves; this is the database fallback. */
export const NOW_MS = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

/** A UTC instant stored as epoch milliseconds, read as a Date. */
export const instant = (name: string) => integer(name, { mode: "timestamp_ms" });

export const createdAt = () => instant("created_at").notNull().default(NOW_MS);
export const updatedAt = () => instant("updated_at").notNull().default(NOW_MS);

/** `column in ('a','b')` for CHECK constraints. Values are compile-time constants, never user input. */
export function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`${column} in (${values.map((v) => `'${v}'`).join(", ")})`);
}
