import { and, asc, eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import { productsServices, stores, type ProductService } from "@/db/schema";

import type { Actor } from "./actor";
import { changedFields, recordActivity } from "./activity";
import { assertStoreWritable, requireStoreAccess } from "./access";
import { conflict, isUniqueViolation, notFound } from "./errors";
import {
  createProductServiceInput,
  parseInput,
  updateProductServiceInput,
} from "./validation";

async function lockWritableStore(tx: DbOrTx, actor: Actor, storeId: string) {
  await requireStoreAccess(tx, actor, storeId, "store:edit");
  const [store] = await tx
    .select()
    .from(stores)
    .where(eq(stores.id, storeId))
    .for("update");
  assertStoreWritable(store);
  return store;
}

async function loadProduct(
  tx: DbOrTx,
  storeId: string,
  productId: string,
): Promise<ProductService> {
  const [row] = await tx
    .select()
    .from(productsServices)
    .where(
      and(
        eq(productsServices.id, productId),
        eq(productsServices.storeId, storeId),
      ),
    );
  if (!row) throw notFound("Product or service");
  return row;
}

export async function listProductsServices(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
): Promise<ProductService[]> {
  const { store } = await requireStoreAccess(dbx, actor, storeId, "store:read");
  return dbx
    .select()
    .from(productsServices)
    .where(
      and(
        eq(productsServices.storeId, store.id),
        eq(productsServices.organizationId, store.organizationId),
      ),
    )
    .orderBy(asc(productsServices.title));
}

export async function createProductService(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  rawInput: unknown,
): Promise<ProductService> {
  const input = parseInput(createProductServiceInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockWritableStore(tx, actor, storeId);

      const [row] = await tx
        .insert(productsServices)
        .values({
          organizationId: store.organizationId,
          storeId: store.id,
          externalId: input.externalId ?? null,
          title: input.title,
          url: input.url ?? null,
          category: input.category ?? null,
          facts: input.facts,
          source: input.source,
          sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        })
        .returning();

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "product_service.created",
        resourceType: "product_service",
        resourceId: row.id,
        details: { title: row.title, source: row.source },
      });
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        "A product or service with this external ID already exists.",
      );
    }
    throw error;
  }
}

export async function updateProductService(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  productId: string,
  rawInput: unknown,
): Promise<ProductService> {
  const input = parseInput(updateProductServiceInput, rawInput);

  try {
    return await dbx.transaction(async (tx) => {
      const store = await lockWritableStore(tx, actor, storeId);
      const current = await loadProduct(tx, store.id, productId);

      const patch: Partial<ProductService> = {};
      for (const [key, value] of Object.entries(input)) {
        if (value !== undefined)
          (patch as Record<string, unknown>)[key] = value;
      }
      const changes = changedFields(current, patch);
      if (Object.keys(changes).length === 0) return current;

      const [updated] = await tx
        .update(productsServices)
        .set(patch)
        .where(eq(productsServices.id, current.id))
        .returning();

      await recordActivity(tx, actor, {
        organizationId: store.organizationId,
        storeId: store.id,
        action: "product_service.updated",
        resourceType: "product_service",
        resourceId: current.id,
        details: { fields: Object.keys(changes) },
      });
      return updated;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(
        "A product or service with this external ID already exists.",
      );
    }
    throw error;
  }
}

export async function deleteProductService(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  productId: string,
): Promise<void> {
  await dbx.transaction(async (tx) => {
    const store = await lockWritableStore(tx, actor, storeId);
    const current = await loadProduct(tx, store.id, productId);

    await tx
      .delete(productsServices)
      .where(eq(productsServices.id, current.id));

    await recordActivity(tx, actor, {
      organizationId: store.organizationId,
      storeId: store.id,
      action: "product_service.deleted",
      resourceType: "product_service",
      resourceId: current.id,
      details: { title: current.title },
    });
  });
}
