import type { MembershipRole } from "@/db/schema";

export const PERMISSIONS = [
  "store:read",
  "store:create",
  "store:edit",
  "store:archive",
  "prompt:edit",
  "audit:run",
  "finding:review",
  "fix:edit",
  "fix:approve",
  "org:members",
  "org:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: readonly Permission[] = ["store:read"];

const AUDITOR: readonly Permission[] = [
  ...VIEWER,
  "audit:run",
  "finding:review",
];

const EDITOR: readonly Permission[] = [
  ...VIEWER,
  "store:edit",
  "prompt:edit",
  "audit:run",
  "fix:edit",
];

// Approving or publishing a change is deliberately separate from editing it:
// an assignee must not automatically be able to publish high-risk changes.
const ADMIN: readonly Permission[] = [
  ...EDITOR,
  "store:create",
  "store:archive",
  "finding:review",
  "fix:approve",
  "org:members",
];

const OWNER: readonly Permission[] = [...ADMIN, "org:manage"];

export const ROLE_PERMISSIONS: Record<
  MembershipRole,
  ReadonlySet<Permission>
> = {
  viewer: new Set(VIEWER),
  auditor: new Set(AUDITOR),
  editor: new Set(EDITOR),
  admin: new Set(ADMIN),
  owner: new Set(OWNER),
};

export function roleHasPermission(
  role: MembershipRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
