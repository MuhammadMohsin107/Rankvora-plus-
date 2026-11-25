/**
 * Hand-typed Cloudflare bindings for the app.
 *
 * `wrangler types` (script `cf-typegen`) bundles the whole Workers runtime
 * typings (about 16,000 lines, version-stamped) and they clash with the DOM
 * lib this Next.js project compiles against, so that file is not committed.
 * This declaration keeps only what the app uses: the D1 binding `DB` declared
 * in wrangler.jsonc, and the subset of the D1 API that drizzle-orm/d1 needs.
 * Keep it in sync with the `d1_databases` entry in wrangler.jsonc.
 */

interface D1Meta {
  duration: number;
  size_after: number;
  rows_read: number;
  rows_written: number;
  last_row_id: number;
  changed_db: boolean;
  changes: number;
}

interface D1Result<T = unknown> {
  success: true;
  results: T[];
  meta: D1Meta & Record<string, unknown>;
  error?: never;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

interface CloudflareEnv {
  DB: D1Database;
  // Backend configuration (secrets and vars). All optional: the API answers "not configured" without them.
  // Names are documented in .dev.vars.example; src/server/env.ts reads and validates them.
  BETTER_AUTH_SECRET?: string;
  APP_URL?: string;
  MAIL_TRANSPORT?: string;
  MAIL_FROM?: string;
  RESEND_API_KEY?: string;
  /** `send_email` binding, only when Cloudflare Email Service is set up. */
  EMAIL?: unknown;
}
