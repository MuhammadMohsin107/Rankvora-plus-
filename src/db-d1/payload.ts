import { z } from "zod";

import { migrateState } from "@/demo-state/state";
import type { DemoStateV1 } from "@/demo-state/types";

/**
 * Pure helpers for the workspace payload (no D1, no Next): validation, size
 * limit and the revision rule. Unit-tested in payload.test.ts.
 */

/** Largest serialized state the server accepts (bytes). The real state is a few KB. */
export const MAX_STATE_BYTES = 512 * 1024;

/** Accepts anything migrateState() accepts and returns the normalised v1 state. */
const stateSchema = z.unknown().transform((value, ctx): DemoStateV1 => {
  const state = migrateState(value);
  if (!state) {
    ctx.addIssue({ code: "custom", message: "Not a valid demo state (v1)." });
    return z.NEVER;
  }
  return state;
});

const putBodySchema = z
  .object({
    state: stateSchema,
    /** Revision the client last saw. 0 = the client believes no workspace exists yet. Omit to overwrite. */
    expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .strict();

export type PutBody = { state: DemoStateV1; expectedRevision?: number };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: "too_large" | "invalid_json" | "invalid_body" };

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Validate a raw PUT body string. Never throws. */
export function parsePutBody(text: string, maxBytes: number = MAX_STATE_BYTES): ParseResult<PutBody> {
  if (byteLength(text) > maxBytes) return { ok: false, code: "too_large" };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, code: "invalid_json" };
  }
  const parsed = putBodySchema.safeParse(json);
  if (!parsed.success) return { ok: false, code: "invalid_body" };
  const { state, expectedRevision } = parsed.data;
  // Normalising only adds defaults, so check the stored form too.
  if (byteLength(JSON.stringify(state)) > maxBytes) return { ok: false, code: "too_large" };
  return { ok: true, value: expectedRevision === undefined ? { state } : { state, expectedRevision } };
}

export type SaveDecision = { ok: true; revision: number } | { ok: false };

/**
 * The optimistic-concurrency rule, as pure logic. `current` is the stored
 * revision (null = no row). The SQL in workspaces.ts implements exactly this.
 *  - expected omitted: always saves (last write wins).
 *  - expected 0: saves only when no row exists.
 *  - expected n > 0: saves only when the stored revision is n.
 */
export function decideSave(current: number | null, expected: number | undefined): SaveDecision {
  if (expected !== undefined && (current ?? 0) !== expected) return { ok: false };
  return { ok: true, revision: (current ?? 0) + 1 };
}
