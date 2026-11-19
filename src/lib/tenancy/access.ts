import { and, eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  organizationMemberships,
  organizations,
  stores,
  type MembershipRole,
  type Organization,
  type Store,
} from "@/db/schema";

import type { Actor } from "./actor";
import { conflict, forbidden, notFound } from "./errors";
import { roleHasPermission, type Permission } from "./permissions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type OrgAccess = { organization: Organization; role: MembershipRole };
export type StoreAccess = { store: Store; role: MembershipRole };

/**
 * Resolves the organization only if the actor is a member of it.
 *
 * A missing organization and an organization the actor does not belong to
 * produce the same "not found" error, so IDs cannot be probed across tenants.
 */
export async function requireOrgAccess(
  dbx: DbOrTx,
  actor: Actor,
  organizationId: string,
  permission: Permission,
): Promise<OrgAccess> {
  if (!isUuid(organizationId)) throw notFound("Organization");

  const [row] = await dbx
    .select({
      organization: organizations,
      role: organizationMemberships.role,
    })
    .from(organizations)
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, organizations.id),
        eq(organizationMemberships.userId, actor.userId),
      ),
    )
    .where(
      and(
        eq(organizations.id, organizationId),
        eq(organizations.status, "active"),
      ),
    )
    .limit(1);

  if (!row) throw notFound("Organization");
  if (!roleHasPermission(row.role, permission)) throw forbidden();
  return row;
}

/**
 * Resolves the store only if the actor belongs to the store's organization
 * and holds the requested permission. Every store-scoped read or write must
 * go through here; a store ID taken from a request is never trusted on its own.
 */
export async function requireStoreAccess(
  dbx: DbOrTx,
  actor: Actor,
  storeId: string,
  permission: Permission,
): Promise<StoreAccess> {
  if (!isUuid(storeId)) throw notFound("Store");

  const [row] = await dbx
    .select({ store: stores, role: organizationMemberships.role })
    .from(stores)
    .innerJoin(organizations, eq(organizations.id, stores.organizationId))
    .innerJoin(
      organizationMemberships,
      and(
        eq(organizationMemberships.organizationId, stores.organizationId),
        eq(organizationMemberships.userId, actor.userId),
      ),
    )
    .where(and(eq(stores.id, storeId), eq(organizations.status, "active")))
    .limit(1);

  if (!row) throw notFound("Store");
  if (!roleHasPermission(row.role, permission)) throw forbidden();
  return row;
}

/** Archived stores keep their history readable but cannot be modified. */
export function assertStoreWritable(store: Store): void {
  if (store.status === "archived") {
    throw conflict("This store is archived. Restore it before making changes.");
  }
}
