import type { DbOrTx } from "@/db";
import { activityLogs } from "@/db/schema";

import type { Actor } from "./actor";

type ActivityInput = {
  organizationId: string;
  storeId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
};

/** Appends an audit-trail entry. Always call inside the same transaction as the change. */
export async function recordActivity(
  dbx: DbOrTx,
  actor: Actor,
  input: ActivityInput,
): Promise<void> {
  await dbx.insert(activityLogs).values({
    organizationId: input.organizationId,
    storeId: input.storeId ?? null,
    actorUserId: actor.userId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    details: input.details ?? {},
  });
}

/** Returns {field: {from, to}} for the fields that actually changed. */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as (keyof T & string)[]) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }
  return changes;
}
