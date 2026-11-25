/** Organization activity history: written in the same batch as the change it describes. */
import { raw, type Statement } from "../db/atomic";
import type { ActorType } from "../db/schema";
import { newId } from "../ids";

export type ActivityEvent = {
  organizationId: string;
  websiteId?: string | null;
  actorType?: ActorType;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  /** Safe values only: never tokens, secrets or message bodies. */
  metadata?: Record<string, string | number | boolean | null | undefined>;
  requestId?: string | null;
  at: Date;
};

/**
 * The insert statement. With `guard` (a SQL condition and its parameters) the row is written only
 * when the condition holds:
 *  - after a write: `appliedClause(...)`, true only if that write in the batch took effect
 *  - before a delete: the same condition the delete uses, because a deleted row cannot be checked later
 */
export function activityStatement(event: ActivityEvent, guard?: Statement): Statement {
  const columns = "(id, organization_id, website_id, actor_type, actor_user_id, actor_name, action, target_type, target_id, metadata, request_id, created_at)";
  const params = [
    newId("act"),
    event.organizationId,
    event.websiteId ?? null,
    event.actorType ?? "user",
    event.actorUserId,
    event.actorName,
    event.action,
    event.targetType,
    event.targetId,
    event.metadata ? JSON.stringify(event.metadata) : null,
    event.requestId ?? null,
    event.at,
  ];
  const placeholders = params.map(() => "?").join(", ");
  if (!guard) return raw(`insert into activity_logs ${columns} values (${placeholders})`, ...params);
  return raw(`insert into activity_logs ${columns} select ${placeholders} where ${guard.sql}`, ...params, ...guard.params);
}
