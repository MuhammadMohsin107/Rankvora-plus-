/** Read side of the activity history and the security audit trail. */
import type { z } from "zod";

import { prepare, raw } from "../../db/atomic";
import type { SecurityOutcome } from "../../db/schema";
import type { ApiContext } from "../../http/handler";
import { decodeCursor, toPage } from "../../pagination";
import type { OrgScope } from "../../tenancy/guard";
import type { pageQuery } from "../../validation";

type Page = z.output<typeof pageQuery>;

type ActivityRow = {
  id: string;
  websiteId: string | null;
  actorType: string;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: string | null;
  createdAt: number;
};

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function keyset(page: Page, prefix: string) {
  if (!page.cursor) return { sql: "", params: [] as unknown[] };
  const { at, id } = decodeCursor(page.cursor);
  return { sql: ` and (${prefix}created_at < ? or (${prefix}created_at = ? and ${prefix}id < ?))`, params: [at, at, id] };
}

export async function listActivity(context: ApiContext, scope: OrgScope, page: Page, websiteId?: string) {
  const after = keyset(page, "");
  const { results } = await prepare(
    context.d1,
    raw(
      `select id as id, website_id as websiteId, actor_type as actorType, actor_user_id as actorUserId, actor_name as actorName,
              action as action, target_type as targetType, target_id as targetId, metadata as metadata, created_at as createdAt
         from activity_logs
        where organization_id = ?${websiteId ? " and website_id = ?" : ""}${after.sql}
        order by created_at desc, id desc limit ?`,
      scope.organizationId,
      ...(websiteId ? [websiteId] : []),
      ...after.params,
      page.limit + 1,
    ),
  ).all<ActivityRow>();
  const { items, nextCursor } = toPage(results, page.limit);
  return { items: items.map((row) => ({ ...row, metadata: parseMetadata(row.metadata), createdAt: new Date(row.createdAt).toISOString() })), nextCursor };
}

type SecurityRow = {
  id: string;
  userId: string | null;
  userName: string | null;
  event: string;
  outcome: SecurityOutcome;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: string | null;
  createdAt: number;
};

/** Events tied to this organization. Sign-ins are not: an account can belong to several organizations. */
export async function listSecurityLog(context: ApiContext, scope: OrgScope, page: Page) {
  const after = keyset(page, "s.");
  const { results } = await prepare(
    context.d1,
    raw(
      `select s.id as id, s.user_id as userId, u.name as userName, s.event as event, s.outcome as outcome, s.ip_address as ipAddress,
              s.user_agent as userAgent, s.metadata as metadata, s.created_at as createdAt
         from security_audit_logs s left join users u on u.id = s.user_id
        where s.organization_id = ?${after.sql}
        order by s.created_at desc, s.id desc limit ?`,
      scope.organizationId,
      ...after.params,
      page.limit + 1,
    ),
  ).all<SecurityRow>();
  const { items, nextCursor } = toPage(results, page.limit);
  return { items: items.map((row) => ({ ...row, metadata: parseMetadata(row.metadata), createdAt: new Date(row.createdAt).toISOString() })), nextCursor };
}
