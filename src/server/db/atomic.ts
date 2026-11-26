/**
 * Atomic multi-statement writes on D1.
 *
 * D1 has no interactive transactions (drizzle's `db.transaction()` sends BEGIN, which D1 rejects).
 * `d1.batch()` is the transaction: either every statement applies or none does. Because nothing can
 * be read between statements, conditions live in the SQL. The pattern used across the services:
 *
 *   1. a guarded write that also stores a fresh `change_id`
 *   2. follow-up writes with `where exists (select 1 ... where id = ? and change_id = ?)`
 *   3. afterwards, `changes[0] === 0` means the guard refused and nothing else happened
 *
 * Drizzle's own `db.batch()` is not used for raw SQL: its D1 session binds parameters on a
 * `.stmt` property that `db.run(sql...)` queries do not have.
 */

export type Statement = { sql: string; params: unknown[] };

/** Anything drizzle can turn into SQL, e.g. `db.update(t).set(...).where(...)`. */
type Buildable = { toSQL(): { sql: string; params: unknown[] } };

export function raw(sql: string, ...params: unknown[]): Statement {
  return { sql, params };
}

export function built(query: Buildable): Statement {
  const { sql, params } = query.toSQL();
  return { sql, params };
}

/** D1 accepts null, numbers, strings, booleans and blobs. `undefined` and `Date` are converted. */
export function toBindValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

export function prepare(d1: D1Database, statement: Statement): D1PreparedStatement {
  const prepared = d1.prepare(statement.sql);
  return statement.params.length ? prepared.bind(...statement.params.map(toBindValue)) : prepared;
}

/** Runs the statements in one transaction and returns the number of rows each one changed. */
export async function atomic(d1: D1Database, statements: Statement[]): Promise<number[]> {
  const results = await d1.batch(statements.map((statement) => prepare(d1, statement)));
  return results.map((result) => result.meta.changes);
}

/** Tables that carry a `change_id` column. A fixed list: the name is placed into SQL text. */
export type GuardedTable =
  | "organizations"
  | "organization_members"
  | "invitations"
  | "websites"
  | "website_domains"
  | "domain_verifications"
  | "usage_reservations"
  | "brand_facts"
  | "brand_fact_sources"
  | "website_source_pages"
  | "competitors"
  | "products_services"
  | "prompt_groups"
  | "prompts"
  | "prompt_versions"
  | "prompt_assignments";

export type Applied = { table: GuardedTable; id: string; changeId: string };

/** SQL fragment that is true only when the guarded write in this batch applied. */
export function appliedClause(applied: Applied): Statement {
  return raw(`exists (select 1 from ${applied.table} where id = ? and change_id = ?)`, applied.id, applied.changeId);
}

/** Tables that are only inserted into: a row with the new id exists only if the insert applied. */
export type InsertOnlyTable = "brand_profile_versions" | "domain_checks";

export function insertedClause(table: InsertOnlyTable, id: string): Statement {
  return raw(`exists (select 1 from ${table} where id = ?)`, id);
}

function errorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(" | ");
}

/** True for a unique-index violation naming every one of `columns` (for example "website_domains.host"). */
export function isUniqueViolation(error: unknown, ...columns: string[]): boolean {
  const message = errorText(error);
  return message.includes("UNIQUE constraint failed") && columns.every((column) => message.includes(column));
}

/** True when a trigger refused the write with `RAISE(ABORT, code)`. */
export function isTriggerAbort(
  error: unknown,
  code: "last_owner" | "append_only" | "immutable_tenant" | "immutable_domain" | "immutable_reservation" | "immutable_version",
): boolean {
  return errorText(error).includes(code);
}
