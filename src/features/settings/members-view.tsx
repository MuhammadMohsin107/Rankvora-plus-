"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { validateEmail } from "@/features/stores/validation";
import { formatRelative } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import type { Member, Role } from "@/types/core";
import type { PendingInvite, Permission, PermissionId, RolePermissions } from "@/types/settings";

import { RoleMatrix } from "./role-matrix";

type Row = { id: string; name: string; email: string; role: Role; initials: string; lastActive: string | null; invitedAt: string | null };

const ROLE_ORDER: Role[] = ["owner", "admin", "editor", "auditor", "viewer"];
const ASSIGNABLE: Role[] = ["admin", "editor", "auditor", "viewer"];

type RoleChange = { row: Row; to: Role };

export function MembersView({
  members,
  invites,
  currentUserId,
  permissions,
  rolePermissions,
}: {
  members: Member[];
  invites: PendingInvite[];
  currentUserId: string;
  permissions: Permission[];
  rolePermissions: RolePermissions;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() => [
    ...members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, initials: m.initials, lastActive: m.lastActive, invitedAt: null })),
    ...invites.map((i) => ({ id: i.id, name: i.email, email: i.email, role: i.role, initials: i.email.slice(0, 2).toUpperCase(), lastActive: null, invitedAt: i.invitedAt })),
  ]);
  const [roleChange, setRoleChange] = useState<RoleChange | null>(null);
  const [removal, setRemoval] = useState<Row | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [emailTouched, setEmailTouched] = useState(false);

  const setRole = (row: Row, role: Role) => {
    setRows((current) => current.map((r) => (r.id === row.id ? { ...r, role } : r)));
    toast.push({ title: `${row.name} is now ${ROLE_LABEL[role]}`, description: "Demo action: nothing was changed on a server." });
  };

  const requestRole = (row: Row, to: Role) => {
    if (to === row.role) return;
    if (ROLE_ORDER.indexOf(to) > ROLE_ORDER.indexOf(row.role)) setRoleChange({ row, to });
    else setRole(row, to);
  };

  const lost = (from: Role, to: Role): PermissionId[] => rolePermissions[from].filter((p) => !rolePermissions[to].includes(p));
  const lostLabels = roleChange ? lost(roleChange.row.role, roleChange.to).map((id) => permissions.find((p) => p.id === id)?.label ?? id) : [];

  const emailError = validateEmail(email) ?? (rows.some((r) => r.email.toLowerCase() === email.trim().toLowerCase()) ? "This person is already a member or invited." : null);

  const closeInvite = () => {
    setInviteOpen(false);
    setEmail("");
    setInviteRole("viewer");
    setEmailTouched(false);
  };

  const sendInvite = () => {
    setEmailTouched(true);
    if (emailError) return;
    const address = email.trim();
    setRows((current) => [
      ...current,
      { id: `invite-${current.length + 1}`, name: address, email: address, role: inviteRole, initials: address.slice(0, 2).toUpperCase(), lastActive: null, invitedAt: "2026-11-19T09:00:00Z" },
    ]);
    toast.push({ title: `Invite sent to ${address}`, description: `Role: ${ROLE_LABEL[inviteRole]}. Demo: no email was sent.` });
    closeInvite();
  };

  const columns: Column<Row>[] = [
    {
      id: "member",
      header: "Member",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text">{r.initials}</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-fg">
              {r.invitedAt ? r.email : r.name}
              {r.id === currentUserId ? <Badge tone="accent">You</Badge> : null}
              {r.invitedAt ? <Badge tone="warning" icon="clock">Invited</Badge> : null}
            </p>
            {!r.invitedAt ? <p className="truncate text-xs text-fg-subtle">{r.email}</p> : null}
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      sort: (r) => ROLE_ORDER.indexOf(r.role),
      width: "w-44",
      cell: (r) =>
        r.role === "owner" ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-fg">
            {ROLE_LABEL.owner}
            <Badge tone="neutral" icon="lock" title="Ownership is transferred, not edited here">Fixed</Badge>
          </span>
        ) : (
          <Select aria-label={`Role for ${r.name}`} value={r.role} onChange={(event) => requestRole(r, event.target.value as Role)}>
            {ASSIGNABLE.map((role) => (
              <option key={role} value={role}>{ROLE_LABEL[role]}</option>
            ))}
          </Select>
        ),
    },
    {
      id: "active",
      header: "Last active",
      hideBelow: "md",
      sort: (r) => r.lastActive ?? r.invitedAt ?? "",
      cell: (r) => <span className="tnum whitespace-nowrap text-fg-muted">{r.lastActive ? formatRelative(r.lastActive) : r.invitedAt ? `Invited ${formatRelative(r.invitedAt)}` : "Never"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => (
        <div className="flex justify-end">
          <Menu
            trigger={<IconButton icon="more" label={`Actions for ${r.name}`} size="sm" />}
            width={200}
            items={
              r.invitedAt
                ? [
                    { label: "Resend invite", icon: "mail", onSelect: () => toast.push({ title: `Invite resent to ${r.email}`, description: "Demo: no email was sent." }) },
                    { label: "Revoke invite", icon: "x-circle", tone: "danger", onSelect: () => setRemoval(r) },
                  ]
                : [
                    {
                      label: "Remove from organization",
                      icon: "trash",
                      tone: "danger",
                      disabled: r.role === "owner" || r.id === currentUserId,
                      disabledReason: r.role === "owner" ? "Owners cannot be removed" : "You cannot remove yourself",
                      onSelect: () => setRemoval(r),
                    },
                  ]
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DataTable<Row>
        label="Members"
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={{ placeholder: "Search members", text: (r) => `${r.name} ${r.email} ${ROLE_LABEL[r.role]}` }}
        filters={[{ id: "role", label: "Role", options: ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABEL[role] })), value: (r) => r.role }]}
        defaultSort={{ column: "role", dir: "asc" }}
        toolbarExtra={<Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Invite member</Button>}
      />

      <RoleMatrix permissions={permissions} rolePermissions={rolePermissions} />

      <ConfirmDialog
        open={roleChange !== null}
        onClose={() => setRoleChange(null)}
        onConfirm={() => {
          if (roleChange) setRole(roleChange.row, roleChange.to);
          setRoleChange(null);
        }}
        title={roleChange ? `Change ${roleChange.row.name} to ${ROLE_LABEL[roleChange.to]}?` : ""}
        confirmLabel="Change role"
      >
        {roleChange ? (
          <>
            <p>{ROLE_LABEL[roleChange.row.role]} becomes {ROLE_LABEL[roleChange.to]}.</p>
            {lostLabels.length > 0 ? <p className="mt-2">Loses: {lostLabels.join(", ")}.</p> : <p className="mt-2">No permissions are lost.</p>}
          </>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={removal !== null}
        onClose={() => setRemoval(null)}
        onConfirm={() => {
          if (removal) {
            setRows((current) => current.filter((r) => r.id !== removal.id));
            toast.push({ title: removal.invitedAt ? `Invite revoked for ${removal.email}` : `${removal.name} removed`, description: "Demo action: nothing was changed on a server." });
          }
          setRemoval(null);
        }}
        title={removal ? (removal.invitedAt ? `Revoke invite for ${removal.email}?` : `Remove ${removal.name}?`) : ""}
        confirmLabel={removal?.invitedAt ? "Revoke invite" : "Remove member"}
      >
        {removal?.invitedAt ? "The invite link stops working." : "They lose access to every store immediately. Their past activity stays in the logs."}
      </ConfirmDialog>

      <Dialog
        open={inviteOpen}
        onClose={closeInvite}
        title="Invite member"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeInvite}>Cancel</Button>
            <Button variant="primary" onClick={sendInvite}>Send invite</Button>
          </>
        }
      >
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            sendInvite();
          }}
        >
          <Field label="Email" required error={emailTouched ? (emailError ?? undefined) : undefined}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="email" autoComplete="off" aria-describedby={describedBy} invalid={invalid} value={email} placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmailTouched(true)} />
            )}
          </Field>
          <Field label="Role" hint={`${ROLE_LABEL[inviteRole]}: ${rolePermissions[inviteRole].length} of ${permissions.length} permissions`}>
            {({ id, describedBy }) => (
              <Select id={id} aria-describedby={describedBy} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>{ROLE_LABEL[role]}</option>
                ))}
              </Select>
            )}
          </Field>
        </form>
      </Dialog>
    </div>
  );
}
