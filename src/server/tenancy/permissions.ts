/**
 * The whole permission matrix. Roles are fixed and reviewed in code rather than stored in tables,
 * so nothing can grant itself a permission at run time.
 *
 * Approving a fix (`fix.approve`) and publishing it (`fix.publish`) are separate from editing tasks
 * (`fix.edit`).
 */
import type { Role } from "../db/schema";

const ALL = ["owner", "admin", "manager", "member", "viewer"] as const;
const CONTRIBUTORS = ["owner", "admin", "manager", "member"] as const;
const LEADS = ["owner", "admin", "manager"] as const;
const ADMINS = ["owner", "admin"] as const;
const OWNER = ["owner"] as const;

export const PERMISSIONS = {
  "organization.read": ALL,
  "organization.update": ADMINS,
  "organization.delete": OWNER,

  "member.read": ALL,
  "member.manage": ADMINS,

  "activity.read": LEADS,
  "security_log.read": ADMINS,

  "website.read": ALL,
  "website.create": ADMINS,
  "website.update": LEADS,
  /** Activate, pause, resume, archive, restore. */
  "website.lifecycle": ADMINS,
  "website.remove": OWNER,
  "website.domain.manage": ADMINS,
  "website.verify": ADMINS,

  /** Marking a brand fact verified on the owner's own word, without a linked source. */
  "brand.confirm": ADMINS,

  "prompt.read": ALL,
  "prompt.write": CONTRIBUTORS,
  /** Approve wording. Only approved wording can run. */
  "prompt.approve": LEADS,
  "prompt.delete": LEADS,

  "audit.read": ALL,
  "audit.create": CONTRIBUTORS,

  "fix.read": ALL,
  "fix.recommend": CONTRIBUTORS,
  "fix.edit": CONTRIBUTORS,
  "fix.approve": LEADS,
  "fix.publish": ADMINS,

  "monitoring.read": ALL,
  "monitoring.configure": LEADS,

  "comparison.read": ALL,
  "comparison.create": CONTRIBUTORS,

  "report.read": ALL,
  "report.export": CONTRIBUTORS,

  "integration.read": LEADS,
  "integration.manage": ADMINS,

  "usage.read": LEADS,
  "billing.read": ADMINS,
  "billing.manage": OWNER,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) => can(role, permission));
}

/** Read permissions keep working while an organization is suspended; everything else stops. */
export function isReadPermission(permission: Permission): boolean {
  return permission.endsWith(".read");
}

/** Only an owner may create, change, remove or invite an owner. */
export function canManageRole(actor: Role, target: Role): boolean {
  return can(actor, "member.manage") && (actor === "owner" || target !== "owner");
}
