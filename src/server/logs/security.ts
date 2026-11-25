/** Security audit trail: sign-ins, password changes, permission denials, membership changes. */
import { prepare, raw } from "../db/atomic";
import type { SecurityOutcome } from "../db/schema";
import { newId } from "../ids";
import { describeError, log } from "../logger";

export type SecurityEvent = {
  organizationId?: string | null;
  userId?: string | null;
  event: string;
  outcome: SecurityOutcome;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  requestId?: string | null;
  at: Date;
};

/**
 * Never throws: a failed audit write must not turn a finished sign-in into an error. The failure is
 * logged at error level so monitoring can alert on it.
 */
export async function recordSecurityEvent(d1: D1Database, event: SecurityEvent): Promise<void> {
  try {
    await prepare(
      d1,
      raw(
        `insert into security_audit_logs (id, organization_id, user_id, event, outcome, ip_address, user_agent, metadata, request_id, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        newId("sec"),
        event.organizationId ?? null,
        event.userId ?? null,
        event.event,
        event.outcome,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.requestId ?? null,
        event.at,
      ),
    ).run();
  } catch (error) {
    log("error", "security_log.write_failed", { securityEvent: event.event, error: describeError(error) });
  }
}
