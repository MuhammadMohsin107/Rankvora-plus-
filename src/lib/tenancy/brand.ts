import { desc, eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { brandProfiles, stores, type BrandProfile } from "@/db/schema";

import type { Actor } from "./actor";
import { recordActivity } from "./activity";
import { assertStoreWritable, requireStoreAccess } from "./access";
import { brandProfileInput, parseInput } from "./validation";

export async function getCurrentBrandProfile(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<BrandProfile | null> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  const [latest] = await dbx
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.storeId, store.id))
    .orderBy(desc(brandProfiles.version))
    .limit(1);
  return latest ?? null;
}

export async function listBrandProfileVersions(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<BrandProfile[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  return dbx
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.storeId, store.id))
    .orderBy(desc(brandProfiles.version));
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Saves the brand profile as a NEW version. Earlier versions are never edited,
 * so any analysis can be traced to the exact name and aliases it used.
 * Saving identical content returns the current version unchanged.
 */
export async function saveBrandProfile(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<{ profile: BrandProfile; created: boolean }> {
  const input = parseInput(brandProfileInput, rawInput);

  return dbx.transaction(async (tx) => {
    await requireStoreAccess(tx, actor, storeId, "store:edit");
    // Lock the store row so two saves cannot both claim the same version number.
    const [store] = await tx
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .for("update");
    assertStoreWritable(store);

    const [latest] = await tx
      .select()
      .from(brandProfiles)
      .where(eq(brandProfiles.storeId, store.id))
      .orderBy(desc(brandProfiles.version))
      .limit(1);

    if (
      latest &&
      latest.brandName === input.brandName &&
      latest.legalName === (input.legalName ?? null) &&
      latest.description === (input.description ?? null) &&
      latest.differentiators === (input.differentiators ?? null) &&
      latest.targetAudience === (input.targetAudience ?? null) &&
      sameList(latest.aliases, input.aliases)
    ) {
      return { profile: latest, created: false };
    }

    const [profile] = await tx
      .insert(brandProfiles)
      .values({
        organizationId: store.organizationId,
        storeId: store.id,
        version: (latest?.version ?? 0) + 1,
        brandName: input.brandName,
        legalName: input.legalName ?? null,
        aliases: input.aliases,
        description: input.description ?? null,
        differentiators: input.differentiators ?? null,
        targetAudience: input.targetAudience ?? null,
        createdByUserId: actor.userId,
      })
      .returning();

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "brand_profile.versioned",
      resourceType: "brand_profile",
      resourceId: profile.id,
      details: {
        version: profile.version,
        previousVersion: latest?.version ?? null,
        brandName: profile.brandName,
      },
    });

    return { profile, created: true };
  });
}
