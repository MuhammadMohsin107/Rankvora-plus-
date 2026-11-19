import { and, asc, eq } from "drizzle-orm";

import type { DbOrTx } from "@/db";
import {
  organizationMemberships,
  organizations,
  type MembershipRole,
  type Organization,
} from "@/db/schema";

import type { Actor } from "./actor";
import { recordActivity } from "./activity";
import { createOrganizationInput, parseInput } from "./validation";

/**
 * Creates an organization and makes the actor its owner, atomically.
 * Anyone with a verified account may create their own organization.
 */
export async function createOrganization(
  dbx: DbOrTx,
  actor: Actor,
  rawInput: unknown,
): Promise<Organization> {
  const input = parseInput(createOrganizationInput, rawInput);

  return dbx.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name: input.name,
        ownerUserId: actor.userId,
        ...(input.timezoneDefault
          ? { timezoneDefault: input.timezoneDefault }
          : {}),
      })
      .returning();

    await tx.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId: actor.userId,
      role: "owner",
    });

    await recordActivity(tx, actor, {
      organizationId: organization.id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: organization.id,
      details: { name: organization.name },
    });

    return organization;
  });
}

/** Organizations the actor belongs to, with the actor's role in each. */
export async function listOrganizations(
  dbx: DbOrTx,
  actor: Actor,
): Promise<{ organization: Organization; role: MembershipRole }[]> {
  return dbx
    .select({
      organization: organizations,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId),
    )
    .where(
      and(
        eq(organizationMemberships.userId, actor.userId),
        eq(organizations.status, "active"),
      ),
    )
    .orderBy(asc(organizations.name));
}
