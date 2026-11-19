import { and, asc, eq, ne, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  competitors,
  stores,
  type Competitor,
  type CompetitorStatus,
} from "@/db/schema";

import type { Actor } from "./actor";
import { changedFields, recordActivity } from "./activity";
import { assertStoreWritable, requireStoreAccess } from "./access";
import { conflict, isUniqueViolation, notFound } from "./errors";
import {
  competitorStatusInput,
  createCompetitorInput,
  parseInput,
  updateCompetitorInput,
} from "./validation";

async function assertNameAvailable(
  dbx: DbOrTx,
  storeId: string,
  name: string,
  excludeId?: string,
): Promise<void> {
  const [existing] = await dbx
    .select({ id: competitors.id })
    .from(competitors)
    .where(
      and(
        eq(competitors.storeId, storeId),
        sql`lower(${competitors.name}) = lower(${name})`,
        ne(competitors.status, "archived"),
        ...(excludeId ? [ne(competitors.id, excludeId)] : []),
      ),
    )
    .limit(1);
  if (existing) throw conflict(`A competitor named "${name}" already exists.`);
}

async function loadCompetitor(
  dbx: DbOrTx,
  storeId: string,
  competitorId: string,
): Promise<Competitor> {
  const [row] = await dbx
    .select()
    .from(competitors)
    .where(
      and(eq(competitors.id, competitorId), eq(competitors.storeId, storeId)),
    )
    .for("update");
  // A competitor that belongs to another store is reported as missing.
  if (!row) throw notFound("Competitor");
  return row;
}

export async function listCompetitors(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  options: { status?: CompetitorStatus } = {},
): Promise<Competitor[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  return dbx
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.storeId, store.id),
        eq(competitors.organizationId, store.organizationId),
        ...(options.status ? [eq(competitors.status, options.status)] : []),
      ),
    )
    .orderBy(asc(competitors.name));
}

/**
 * Adds a competitor. A competitor added by hand is confirmed; one suggested by
 * AI or an import stays "suggested" until a person confirms it, and only
 * confirmed competitors should feed official metrics.
 */
export async function createCompetitor(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<Competitor> {
  const input = parseInput(createCompetitorInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      await requireStoreAccess(tx, actor, storeId, "store:edit");
      const [store] = await tx
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .for("update");
      assertStoreWritable(store);
      await assertNameAvailable(tx, store.id, input.name);

      const [competitor] = await tx
        .insert(competitors)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          name: input.name,
          aliases: input.aliases,
          domains: input.domains,
          market: input.market ?? null,
          competitorType: input.competitorType ?? null,
          source: input.source,
          status:
            input.status ??
            (input.source === "manual" ? "confirmed" : "suggested"),
        })
        .returning();

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "competitor.created",
        resourceType: "competitor",
        resourceId: competitor.id,
        details: { name: competitor.name, status: competitor.status },
      });
      return competitor;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A competitor named "${input.name}" already exists.`);
    }
    throw error;
  }
}

export async function updateCompetitor(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  competitorId: string,
  rawInput: unknown,
): Promise<Competitor> {
  const input = parseInput(updateCompetitorInput, rawInput);

  return dbx.transaction(async (tx) => {
    await requireStoreAccess(tx, actor, storeId, "store:edit");
    const [store] = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .for("update");
    assertStoreWritable(store);

    const current = await loadCompetitor(tx, store.id, competitorId);
    if (input.name !== undefined) {
      await assertNameAvailable(tx, store.id, input.name, current.id);
    }

    const patch: Partial<Competitor> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
    }
    const changes = changedFields(current, patch);
    if (Object.keys(changes).length === 0) return current;

    const [updated] = await tx
      .update(competitors)
      .set(patch)
      .where(eq(competitors.id, current.id))
      .returning();

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "competitor.updated",
      resourceType: "competitor",
      resourceId: current.id,
      details: { changes },
    });
    return updated;
  });
}

/** Confirms, re-suggests or archives a competitor. Nothing is ever deleted. */
export async function setCompetitorStatus(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  competitorId: string,
  rawStatus: unknown,
): Promise<Competitor> {
  const status = parseInput(competitorStatusInput, rawStatus);

  return dbx.transaction(async (tx) => {
    await requireStoreAccess(tx, actor, storeId, "store:edit");
    const [store] = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .for("update");
    assertStoreWritable(store);

    const current = await loadCompetitor(tx, store.id, competitorId);
    if (current.status === status) return current;
    if (current.status === "archived") {
      await assertNameAvailable(tx, store.id, current.name, current.id);
    }

    const [updated] = await tx
      .update(competitors)
      .set({ status })
      .where(eq(competitors.id, current.id))
      .returning();

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "competitor.status_changed",
      resourceType: "competitor",
      resourceId: current.id,
      details: { from: current.status, to: status },
    });
    return updated;
  });
}
