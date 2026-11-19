import { and, asc, eq, inArray, ne } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  brandProfiles,
  organizationMemberships,
  organizations,
  storeDomains,
  stores,
  type BrandProfile,
  type MembershipRole,
  type Store,
  type StoreDomain,
  type StoreStatus,
} from "@/db/schema";

import type { Actor } from "./actor";
import { changedFields, recordActivity } from "./activity";
import {
  assertStoreWritable,
  requireOrgAccess,
  requireStoreAccess,
} from "./access";
import { conflict, isUniqueViolation } from "./errors";
import {
  createStoreInput,
  parseInput,
  storeDomainInput,
  storeStatusInput,
  updateStoreInput,
} from "./validation";

async function assertDomainAvailable(
  dbx: DbOrTx,
  organizationId: string,
  host: string,
  excludeStoreId?: string,
): Promise<void> {
  const [existing] = await dbx
    .select({ id: stores.id })
    .from(stores)
    .where(
      and(
        eq(stores.organizationId, organizationId),
        eq(stores.canonicalDomain, host),
        ne(stores.status, "archived"),
        ...(excludeStoreId ? [ne(stores.id, excludeStoreId)] : []),
      ),
    )
    .limit(1);
  if (existing) {
    throw conflict(`Another store in this organization already uses ${host}.`);
  }
}

/** Creates a store together with version 1 of its brand profile, atomically. */
export async function createStore(
  dbx: DbOrTx,
  actor: Actor,
  rawInput: unknown,
): Promise<{ store: Store; brandProfile: BrandProfile }> {
  const input = parseInput(createStoreInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const { organization } = await requireOrgAccess(
        tx,
        actor,
        input.organizationId,
        "store:create",
      );
      await assertDomainAvailable(tx, organization.id, input.canonicalDomain);

      const [store] = await tx
        .insert(stores)
        .values({
          organizationId: organization.id,
          brandGroupId: input.brandGroupId ?? null,
          name: input.name,
          platformType: input.platformType,
          canonicalDomain: input.canonicalDomain,
          market: input.market,
          language: input.language,
          timezone: input.timezone ?? organization.timezoneDefault,
          industry: input.industry ?? null,
          description: input.description ?? null,
        })
        .returning();

      const [brandProfile] = await tx
        .insert(brandProfiles)
        .values({
          organizationId: organization.id,
          storeId: store.id,
          version: 1,
          brandName: input.brandName,
          aliases: input.brandAliases ?? [],
          createdByUserId: actor.userId,
        })
        .returning();

      await recordActivity(tx, actor, {
        organizationId: organization.id,
        storeId: store.id,
        action: "store.created",
        resourceType: "store",
        resourceId: store.id,
        details: {
          name: store.name,
          canonicalDomain: store.canonicalDomain,
          market: store.market,
        },
      });

      return { store, brandProfile };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("A store with this domain already exists.");
    }
    throw error;
  }
}

/** Stores the actor can see across all of their organizations. */
export async function listStores(
  dbx: DbOrTx,
  actor: Actor,
  options: { organizationId?: string; includeArchived?: boolean } = {},
): Promise<{ store: Store; role: MembershipRole }[]> {
  const conditions = [
    eq(organizationMemberships.userId, actor.userId),
    eq(organizations.status, "active"),
  ];
  if (options.organizationId) {
    conditions.push(eq(stores.organizationId, options.organizationId));
  }
  if (!options.includeArchived) {
    conditions.push(ne(stores.status, "archived"));
  }

  return dbx
    .select({ store: stores, role: organizationMemberships.role })
    .from(stores)
    .innerJoin(organizations, eq(organizations.id, stores.organizationId))
    .innerJoin(
      organizationMemberships,
      eq(organizationMemberships.organizationId, stores.organizationId),
    )
    .where(and(...conditions))
    .orderBy(asc(stores.name));
}

export async function getStore(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<{ store: Store; role: MembershipRole }> {
  return requireStoreAccess(dbx, actor, storeId, "store:read");
}

/** Locks the store row so concurrent edits to one store are applied in order. */
async function lockStore(tx: DbOrTx, storeId: string): Promise<Store> {
  const [store] = await tx
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .for("update");
  return store;
}

export async function updateStore(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<Store> {
  const input = parseInput(updateStoreInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      await requireStoreAccess(tx, actor, storeId, "store:edit");
      const current = await lockStore(tx, storeId);
      assertStoreWritable(current);

      const { confirmDomainChange, canonicalDomain, ...rest } = input;
      const patch: Partial<Store> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
          (patch as Record<string, unknown>)[key] = value;
        }
      }

      const domainChanges =
        canonicalDomain !== undefined &&
        canonicalDomain !== current.canonicalDomain;

      if (domainChanges) {
        if (!confirmDomainChange) {
          throw conflict(
            "Changing the canonical domain needs confirmation. " +
              "Resend with confirmDomainChange: true after checking the new domain and its aliases.",
          );
        }
        await assertDomainAvailable(
          tx,
          current.organizationId,
          canonicalDomain,
          current.id,
        );
        // Keep the old domain as history; if the new domain was a known
        // alias it is now the canonical one, so it leaves the alias list.
        await tx
          .delete(storeDomains)
          .where(
            and(
              eq(storeDomains.storeId, current.id),
              eq(storeDomains.host, canonicalDomain),
            ),
          );
        await tx
          .insert(storeDomains)
          .values({
            organizationId: current.organizationId,
            storeId: current.id,
            host: current.canonicalDomain,
            kind: "previous_canonical",
          })
          .onConflictDoNothing();
        patch.canonicalDomain = canonicalDomain;
      }

      const changes = changedFields(current, patch);
      if (Object.keys(changes).length === 0) return current;

      const [updated] = await tx
        .update(stores)
        .set(patch)
        .where(eq(stores.id, current.id))
        .returning();

      await recordActivity(tx, actor, {
        organizationId: current.organizationId,
        storeId: current.id,
        action: "store.updated",
        resourceType: "store",
        resourceId: current.id,
        details: { changes },
      });

      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict("A store with this domain already exists.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Status lifecycle
// ---------------------------------------------------------------------------

// "disconnected" is set by connector code when an integration is revoked, never
// requested by a user, so it only appears as a source state here.
const ALLOWED_TRANSITIONS: Record<StoreStatus, readonly StoreStatus[]> = {
  draft: ["needs_review", "ready", "archived"],
  needs_review: ["draft", "ready", "archived"],
  ready: ["needs_review", "active", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  disconnected: ["active", "paused", "archived"],
  archived: ["paused"],
};

export function canTransition(from: StoreStatus, to: StoreStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export async function transitionStoreStatus(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawTo: unknown,
): Promise<Store> {
  const to = parseInput(storeStatusInput, rawTo);

  return dbx.transaction(async (tx) => {
    await requireStoreAccess(
      tx,
      actor,
      storeId,
      to === "archived" ? "store:archive" : "store:edit",
    );
    const current = await lockStore(tx, storeId);

    if (current.status === to) return current;
    if (!canTransition(current.status, to)) {
      throw conflict(`A ${current.status} store cannot become ${to}.`);
    }
    if (current.status === "archived") {
      // Restoring must not collide with a domain taken by another store.
      await assertDomainAvailable(
        tx,
        current.organizationId,
        current.canonicalDomain,
        current.id,
      );
    }

    const [updated] = await tx
      .update(stores)
      .set({ status: to })
      .where(eq(stores.id, current.id))
      .returning();

    await recordActivity(tx, actor, {
      organizationId: current.organizationId,
      storeId: current.id,
      action: "store.status_changed",
      resourceType: "store",
      resourceId: current.id,
      details: { from: current.status, to },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Alias / redirect domains
// ---------------------------------------------------------------------------

export async function listStoreDomains(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<StoreDomain[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  return dbx
    .select()
    .from(storeDomains)
    .where(
      and(
        eq(storeDomains.storeId, store.id),
        eq(storeDomains.organizationId, store.organizationId),
      ),
    )
    .orderBy(asc(storeDomains.host));
}

export async function addStoreDomain(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<StoreDomain> {
  const input = parseInput(storeDomainInput, rawInput);

  return dbx.transaction(async (tx) => {
    await requireStoreAccess(tx, actor, storeId, "store:edit");
    const store = await lockStore(tx, storeId);
    assertStoreWritable(store);

    if (input.host === store.canonicalDomain) {
      throw conflict("That is already this store's canonical domain.");
    }
    const [existing] = await tx
      .select({ id: storeDomains.id })
      .from(storeDomains)
      .where(
        and(
          eq(storeDomains.storeId, store.id),
          eq(storeDomains.host, input.host),
        ),
      )
      .limit(1);
    if (existing)
      throw conflict(`${input.host} is already listed for this store.`);

    const [row] = await tx
      .insert(storeDomains)
      .values({
        organizationId: store.organizationId,
        storeId: store.id,
        host: input.host,
        kind: input.kind,
      })
      .returning();

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "store.domain_added",
      resourceType: "store_domain",
      resourceId: row.id,
      details: { host: row.host, kind: row.kind },
    });
    return row;
  });
}

/** Removes an alias or redirect. Former canonical domains are kept as history. */
export async function removeStoreDomain(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  domainId: string,
): Promise<void> {
  await dbx.transaction(async (tx) => {
    await requireStoreAccess(tx, actor, storeId, "store:edit");
    const store = await lockStore(tx, storeId);
    assertStoreWritable(store);

    const removed = await tx
      .delete(storeDomains)
      .where(
        and(
          eq(storeDomains.id, domainId),
          eq(storeDomains.storeId, store.id),
          inArray(storeDomains.kind, ["alias", "redirect"]),
        ),
      )
      .returning();

    if (removed.length === 0) {
      throw conflict("Only existing alias or redirect domains can be removed.");
    }

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "store.domain_removed",
      resourceType: "store_domain",
      resourceId: domainId,
      details: { host: removed[0].host },
    });
  });
}
