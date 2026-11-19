import { randomUUID } from "node:crypto";

import { db, type DbOrTx } from "@/db";
import {
  organizationMemberships,
  users,
  type MembershipRole,
  type User,
} from "@/db/schema";
import type { Actor } from "@/lib/tenancy/actor";

class Rollback extends Error {}

/**
 * Runs `fn` inside a transaction that is ALWAYS rolled back, so tests can
 * create whatever rows they need without leaving anything in the database.
 */
export async function withRollback<T>(
  fn: (tx: DbOrTx) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  return result as T;
}

export async function createTestUser(
  tx: DbOrTx,
): Promise<{ user: User; actor: Actor }> {
  const [user] = await tx
    .insert(users)
    .values({ email: `test-${randomUUID()}@example.test` })
    .returning();
  return { user, actor: { userId: user.id } };
}

export async function addTestMember(
  tx: DbOrTx,
  organizationId: string,
  userId: string,
  role: MembershipRole,
): Promise<void> {
  await tx
    .insert(organizationMemberships)
    .values({ organizationId, userId, role });
}

export const validStoreInput = (
  organizationId: string,
  overrides: Record<string, unknown> = {},
) => ({
  organizationId,
  name: "Test store",
  platformType: "manual",
  canonicalDomain: `${randomUUID().slice(0, 8)}.example.com`,
  market: "PK",
  language: "en",
  brandName: "Test brand",
  ...overrides,
});
