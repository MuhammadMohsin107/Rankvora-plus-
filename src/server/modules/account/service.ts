/** Account deletion rules. Runs before Better Auth removes the user's sessions, password and row. */
import { atomic, isTriggerAbort, prepare, raw, type Statement } from "../../db/atomic";
import { activityStatement } from "../../logs/activity";

export class SoleOwnerError extends Error {
  constructor(
    readonly organizationNames: string[],
    /** A suspended organization cannot be handed over or deleted by its owner. */
    readonly includesSuspended: boolean,
  ) {
    super(`sole owner of: ${organizationNames.join(", ")}`);
    this.name = "SoleOwnerError";
  }
}

type Membership = { id: string; organizationId: string; role: string; soleOwner: number; organizationName: string; organizationStatus: string };

/**
 * Removes the user's memberships, and the invitations they sent, in one batch; or throws
 * {@link SoleOwnerError} and changes nothing.
 *
 * Doing this first matters: Better Auth deletes sessions and the password before the user row, so
 * the last-owner trigger must not be left to stop the final step. It still could if the same account
 * gained a sole ownership between this call and that step, which needs two of its requests to run
 * at the same moment.
 */
export async function releaseMemberships(d1: D1Database, user: { id: string; name: string }, now: Date): Promise<void> {
  const { results } = await prepare(
    d1,
    raw(
      `select m.id as id, m.organization_id as organizationId, m.role as role, o.name as organizationName, o.status as organizationStatus,
              case when m.role = 'owner' and m.status = 'active' and not exists (
                select 1 from organization_members other
                where other.organization_id = m.organization_id and other.id <> m.id and other.role = 'owner' and other.status = 'active'
              ) then 1 else 0 end as soleOwner
         from organization_members m join organizations o on o.id = m.organization_id
        where m.user_id = ? and o.status <> 'deleted'`,
      user.id,
    ),
  ).all<Membership>();

  const blocking = results.filter((row) => row.soleOwner === 1);
  if (blocking.length) {
    throw new SoleOwnerError(
      blocking.map((row) => row.organizationName),
      blocking.some((row) => row.organizationStatus === "suspended"),
    );
  }

  const statements: Statement[] = [
    raw(`update invitations set status = 'revoked', responded_at = ?, updated_at = ? where invited_by_user_id = ? and status = 'pending'`, now, now, user.id),
  ];
  for (const membership of results) {
    statements.push(
      raw(`delete from organization_members where id = ?`, membership.id),
      activityStatement({
        organizationId: membership.organizationId,
        actorUserId: user.id,
        actorName: user.name,
        action: "member.account_deleted",
        targetType: "member",
        targetId: membership.id,
        metadata: { role: membership.role },
        at: now,
      }),
    );
  }
  try {
    await atomic(d1, statements);
  } catch (error) {
    // Another owner left between the check and the delete: the trigger refused and nothing changed.
    if (isTriggerAbort(error, "last_owner")) {
      throw new SoleOwnerError(
        results.filter((row) => row.role === "owner").map((row) => row.organizationName),
        false,
      );
    }
    throw error;
  }
}
