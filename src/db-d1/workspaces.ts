import { and, eq, sql } from "drizzle-orm";

import { createEmptyState, parseState } from "@/demo-state/state";
import type { DemoStateV1 } from "@/demo-state/types";

import { getDb, type D1Db } from "./client";
import { workspaces } from "./schema";

/**
 * Workspace store: one JSON document per workspace id with an optimistic
 * revision. Callers must validate `state` first (see payload.ts); ids come
 * from the server, never from a request body.
 */

export type WorkspaceRecord = { state: DemoStateV1; revision: number; updatedAt: string };

export type SaveOutcome =
  | { ok: true; revision: number }
  | { ok: false; conflict: true; current: WorkspaceRecord | null };

/** Thrown by the id-only functions when there is no D1 binding. */
export class D1UnavailableError extends Error {
  constructor() {
    super("D1 binding `DB` is not available");
    this.name = "D1UnavailableError";
  }
}

function toRecord(row: { state: string; revision: number; updatedAt: string }): WorkspaceRecord {
  // A row written by an incompatible build parses to null: serve an empty state at the real revision.
  return { state: parseState(row.state) ?? createEmptyState(), revision: row.revision, updatedAt: row.updatedAt };
}

const NOW = sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/** The repository over a given drizzle instance (used directly by tests). */
export function workspaceStore(db: D1Db) {
  const selectById = (id: string) =>
    db
      .select({ state: workspaces.state, revision: workspaces.revision, updatedAt: workspaces.updatedAt })
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

  return {
    async load(id: string): Promise<WorkspaceRecord | null> {
      const [row] = await selectById(id);
      return row ? toRecord(row) : null;
    },

    /**
     * Atomic upsert with an optimistic check, in one D1 batch (D1 has no interactive transactions):
     *   1. a conditional write that returns the new revision (UPSERT or UPDATE ... WHERE revision = expected)
     *   2. SELECT the row (also in the batch, so a conflict reports the state the check saw).
     * `expectedRevision` semantics are documented on decideSave() in payload.ts.
     */
    async save(id: string, state: DemoStateV1, expectedRevision?: number): Promise<SaveOutcome> {
      const json = JSON.stringify(state);
      const changes = {
        state: json,
        schemaVersion: state.v,
        revision: sql`${workspaces.revision} + 1`,
        updatedAt: NOW,
      };
      // expected > 0 may only update an existing row at that revision (never create one);
      // expected 0 or omitted is an upsert, and expected 0 refuses to overwrite (stored revisions are >= 1).
      const write =
        expectedRevision !== undefined && expectedRevision > 0
          ? db
              .update(workspaces)
              .set(changes)
              .where(and(eq(workspaces.id, id), eq(workspaces.revision, expectedRevision)))
              .returning({ revision: workspaces.revision })
          : db
              .insert(workspaces)
              .values({ id, state: json, schemaVersion: state.v, revision: 1 })
              .onConflictDoUpdate({
                target: workspaces.id,
                set: changes,
                ...(expectedRevision === undefined ? {} : { setWhere: eq(workspaces.revision, 0) }),
              })
              .returning({ revision: workspaces.revision });

      const [written, current] = await db.batch([write, selectById(id)]);
      const saved = written[0];
      if (saved) return { ok: true, revision: saved.revision };
      const row = current[0];
      return { ok: false, conflict: true, current: row ? toRecord(row) : null };
    },

    async remove(id: string): Promise<void> {
      await db.delete(workspaces).where(eq(workspaces.id, id));
    },
  };
}

async function requireStore() {
  const db = await getDb();
  if (!db) throw new D1UnavailableError();
  return workspaceStore(db);
}

export async function loadWorkspace(id: string): Promise<WorkspaceRecord | null> {
  return (await requireStore()).load(id);
}

/** Returns the new revision, or a conflict carrying the server's current record. */
export async function saveWorkspace(id: string, state: DemoStateV1, expectedRevision?: number): Promise<SaveOutcome> {
  return (await requireStore()).save(id, state, expectedRevision);
}

export async function deleteWorkspace(id: string): Promise<void> {
  return (await requireStore()).remove(id);
}
