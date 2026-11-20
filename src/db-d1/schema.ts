import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Cloudflare D1 (SQLite) schema. Separate from the frozen PostgreSQL schema in
 * src/db: nothing here imports from it.
 *
 * `workspaces` holds one demo workspace per browser (cookie `rv_ws`). The whole
 * demo state is one JSON document; `revision` is the optimistic-concurrency
 * counter. The backend phase will add real relational tables next to it
 * (organizations, websites, prompts, ...) through new migrations; this table
 * can then be retired or kept for per-workspace UI state.
 */
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  /** JSON document: the DemoStateV1 payload (validated before every write). */
  state: text("state").notNull(),
  /** Version of the JSON document shape (DEMO_STATE_VERSION). */
  schemaVersion: integer("schema_version").notNull(),
  /** Incremented on every successful write. 0 is never stored: the first save is 1. */
  revision: integer("revision").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

export type WorkspaceRow = typeof workspaces.$inferSelect;
