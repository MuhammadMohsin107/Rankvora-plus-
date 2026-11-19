import { Card, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@/types/core";
import type { Permission, RolePermissions } from "@/types/settings";

const ROLES: Role[] = ["owner", "admin", "editor", "auditor", "viewer"];

/** Role × permission matrix. Allowed / not allowed use icon plus hidden text, never colour alone. */
export function RoleMatrix({ permissions, rolePermissions }: { permissions: Permission[]; rolePermissions: RolePermissions }) {
  return (
    <Card>
      <CardHeader title="Role permissions" info="Approval is separate from editing: editors draft changes, only owners and admins approve them." />
      <div className="ui-scroll mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[13px]">
          <caption className="sr-only">Permissions granted to each role</caption>
          <thead>
            <tr className="border-y border-line bg-surface-2/70">
              <th scope="col" className="px-4 py-2.5 text-left text-xs font-medium text-fg-muted">Permission</th>
              {ROLES.map((role) => (
                <th key={role} scope="col" className="px-3 py-2.5 text-center text-xs font-medium text-fg-muted">{ROLE_LABEL[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-fg">
                  <span className="inline-flex items-center gap-1.5">
                    {permission.label}
                    <Tooltip content={permission.info}>
                      <span tabIndex={0} aria-label={permission.info} className="flex cursor-help text-fg-subtle">
                        <Icon name="info" size={13} />
                      </span>
                    </Tooltip>
                  </span>
                </th>
                {ROLES.map((role) => {
                  const allowed = rolePermissions[role].includes(permission.id);
                  return (
                    <td key={role} className="px-3 py-2.5 text-center">
                      <Icon name={allowed ? "check-circle" : "minus"} size={16} className={allowed ? "mx-auto text-success" : "mx-auto text-fg-subtle"} />
                      <span className="sr-only">{allowed ? "Allowed" : "Not allowed"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
