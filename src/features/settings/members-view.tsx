"use client";

import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select, Switch } from "@/components/ui/form";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Timeline } from "@/components/ui/misc";
import { ConfirmDialog, Dialog, Drawer } from "@/components/ui/overlay";
import { DataTable, type Column } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { demoNow, simulatedToast, useDemoCollection, useDemoEvents, useDemoSettings } from "@/demo-state";
import { formatDate, formatRelative } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role, Store } from "@/types/core";
import type { BillingPlan, BillingState, MemberStatus, PermissionId, Permission, RolePermissions, TeamMember } from "@/types/settings";

import { meterState } from "./billing-model";
import { validateEmailAddress } from "./options";
import { RoleMatrix } from "./role-matrix";

const ROLE_ORDER: Role[] = ["owner", "admin", "editor", "auditor", "viewer"];
const ASSIGNABLE: Role[] = ["admin", "editor", "auditor", "viewer"];
const FULL_ACCESS: Role[] = ["owner", "admin"];

type Props = {
  members: TeamMember[];
  websites: Store[];
  currentUserId: string;
  permissions: Permission[];
  rolePermissions: RolePermissions;
  plans: BillingPlan[];
  billingState: BillingState;
  activity: { id: string; at: string; actor: string; title: string }[];
};

type RoleChange = { row: TeamMember; to: Role };

const accessLabel = (m: TeamMember, total: number) => (m.websiteIds === null ? "All websites" : `${m.websiteIds.length} of ${total} websites`);

export function MembersView({ members, websites: baseWebsites, currentUserId, permissions, rolePermissions, plans, billingState, activity }: Props) {
  const toast = useToast();
  const { rows, create, update, remove } = useDemoCollection<TeamMember>("members", members);
  const websites = useDemoCollection<Store>("websites", baseWebsites).rows.filter((w) => w.status !== "archived");
  const billing = useDemoSettings<BillingState>("org.billing", billingState).value;
  const plan = plans.find((p) => p.id === billing.planId) ?? plans[0];

  const seatsUsed = rows.filter((r) => r.status !== "deactivated").length;
  const seatState = meterState(seatsUsed, plan.limits.seats);
  const seatsFull = seatsUsed >= plan.limits.seats;
  const me = rows.find((r) => r.id === currentUserId);

  const [roleChange, setRoleChange] = useState<RoleChange | null>(null);
  const [confirm, setConfirm] = useState<{ row: TeamMember; action: "revoke" | "deactivate" | "remove" } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessFor, setAccessFor] = useState<string | null>(null);

  const lost = (from: Role, to: Role): PermissionId[] => rolePermissions[from].filter((p) => !rolePermissions[to].includes(p));
  const lostLabels = roleChange ? lost(roleChange.row.role, roleChange.to).map((id) => permissions.find((p) => p.id === id)?.label ?? id) : [];

  const setRole = (row: TeamMember, role: Role) => {
    update(row.id, { role, websiteIds: FULL_ACCESS.includes(role) ? null : row.websiteIds }, { kind: "member.updated", label: `${row.name} is now ${ROLE_LABEL[role]}` });
    toast.push(simulatedToast(`${row.name} is now ${ROLE_LABEL[role]}`));
  };
  const requestRole = (row: TeamMember, to: Role) => {
    if (to === row.role) return;
    if (lost(row.role, to).length > 0) setRoleChange({ row, to });
    else setRole(row, to);
  };

  const resend = (row: TeamMember) => {
    update(row.id, { invitedAt: demoNow() }, { kind: "member.invited", label: `Invite resent to ${row.email}` });
    toast.push(simulatedToast(`Invite resent to ${row.email}`, "info"));
  };

  const runConfirm = () => {
    if (!confirm) return;
    const { row, action } = confirm;
    if (action === "revoke") {
      remove(row.id, { kind: "member.updated", label: `Invite revoked for ${row.email}` });
      toast.push(simulatedToast(`Invite revoked for ${row.email}`));
    } else if (action === "deactivate") {
      update(row.id, { status: "deactivated" as MemberStatus }, { kind: "member.updated", label: `${row.name} deactivated` });
      toast.push(simulatedToast(`${row.name} deactivated`));
    } else {
      remove(row.id, { kind: "member.updated", label: `${row.name} removed` });
      toast.push(simulatedToast(`${row.name} removed`));
    }
    setConfirm(null);
  };

  const reactivate = (row: TeamMember) => {
    update(row.id, { status: "active" as MemberStatus }, { kind: "member.updated", label: `${row.name} reactivated` });
    toast.push(simulatedToast(`${row.name} reactivated`));
  };

  const columns: Column<TeamMember>[] = [
    {
      id: "member",
      header: "Member",
      sort: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">{r.initials}</span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-fg">
              <span className="truncate">{r.status === "invited" ? r.email : r.name}</span>
              {r.id === currentUserId ? <Badge tone="accent">You</Badge> : null}
              {r.status === "invited" ? <Badge tone="warning" icon="clock" title={r.invitedAt ? `Invited ${formatRelative(r.invitedAt)}` : undefined}>Invited</Badge> : null}
              {r.status === "deactivated" ? <Badge tone="neutral" icon="minus-circle">Deactivated</Badge> : null}
            </p>
            {r.status !== "invited" ? <p className="truncate text-helper text-fg-subtle">{r.email}</p> : null}
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
          <span className="inline-flex items-center gap-1.5 text-fg">
            {ROLE_LABEL.owner}
            <Badge tone="neutral" icon="lock" title="Ownership is transferred, not edited here">Fixed</Badge>
          </span>
        ) : (
          <Select aria-label={`Role for ${r.name}`} value={r.role} disabled={r.status === "deactivated"} onChange={(event) => requestRole(r, event.target.value as Role)}>
            {ASSIGNABLE.map((role) => (
              <option key={role} value={role}>{ROLE_LABEL[role]}</option>
            ))}
          </Select>
        ),
    },
    {
      id: "access",
      header: "Website access",
      hideBelow: "md",
      sort: (r) => (r.websiteIds === null ? 999 : r.websiteIds.length),
      cell: (r) => (
        <button
          type="button"
          onClick={() => setAccessFor(r.id)}
          className="cursor-pointer rounded text-left text-fg underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Website access for ${r.name}: ${accessLabel(r, websites.length)}`}
        >
          {accessLabel(r, websites.length)}
        </button>
      ),
    },
    {
      id: "active",
      header: "Last active",
      hideBelow: "lg",
      sort: (r) => r.lastActive ?? r.invitedAt ?? "",
      cell: (r) => <span className="tnum whitespace-nowrap text-fg-muted">{r.lastActive ? formatRelative(r.lastActive) : "Never"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      srOnlyHeader: true,
      align: "right",
      width: "w-12",
      cell: (r) => {
        const items: MenuItem[] = [{ label: "Website access", icon: "globe", onSelect: () => setAccessFor(r.id) }];
        if (r.status === "invited") {
          items.push({ label: "Resend invite", icon: "mail", onSelect: () => resend(r) }, { type: "separator" }, { label: "Revoke invite", icon: "x-circle", tone: "danger", onSelect: () => setConfirm({ row: r, action: "revoke" }) });
        } else if (r.status === "deactivated") {
          items.push(
            { label: "Reactivate", icon: "refresh", disabled: seatsFull, disabledReason: "All seats are used", onSelect: () => reactivate(r) },
            { type: "separator" },
            { label: "Remove from organization", icon: "trash", tone: "danger", onSelect: () => setConfirm({ row: r, action: "remove" }) },
          );
        } else {
          items.push(
            { type: "separator" },
            {
              label: "Deactivate",
              icon: "minus-circle",
              tone: "danger",
              disabled: r.role === "owner" || r.id === currentUserId,
              disabledReason: r.role === "owner" ? "Owners cannot be deactivated" : "You cannot deactivate yourself",
              onSelect: () => setConfirm({ row: r, action: "deactivate" }),
            },
          );
        }
        return (
          <div className="flex justify-end">
            <Menu label={`Actions for ${r.name}`} trigger={<IconButton icon="more" label={`Actions for ${r.name}`} size="sm" />} width={220} items={items} />
          </div>
        );
      },
    },
  ];

  const accessRow = rows.find((r) => r.id === accessFor) ?? null;

  const membersTab = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-body-sm text-fg-muted">
        <span className="tnum">{seatsUsed} of {plan.limits.seats} seats used</span>
        {seatState === "near" ? <Badge tone="warning" icon="alert-triangle">Near limit</Badge> : null}
        {seatState === "at_limit" ? <Badge tone="danger" icon="alert-circle">Limit reached</Badge> : null}
        {seatState !== "ok" ? <ButtonLink href="/settings/billing" variant="ghost" size="sm">Billing</ButtonLink> : null}
      </div>
      <DataTable<TeamMember>
        label="Members"
        data={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={{ placeholder: "Search members", text: (r) => `${r.name} ${r.email} ${ROLE_LABEL[r.role]}` }}
        filters={[
          { id: "role", label: "Role", options: ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABEL[role] })), value: (r) => r.role },
          { id: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "invited", label: "Invited" }, { value: "deactivated", label: "Deactivated" }], value: (r) => r.status },
        ]}
        defaultSort={{ column: "role", dir: "asc" }}
      />
    </div>
  );

  return (
    <>
      <HeaderAction>
        <Button variant="primary" icon="plus" onClick={() => setInviteOpen(true)}>Invite member</Button>
      </HeaderAction>

      <Tabs
        label="Team sections"
        tabs={[
          { id: "members", label: "Members", count: rows.length, content: membersTab },
          { id: "roles", label: "Roles", content: <RoleMatrix permissions={permissions} rolePermissions={rolePermissions} /> },
          { id: "activity", label: "Activity", content: <TeamActivity seeded={activity} onInvite={() => setInviteOpen(true)} /> },
        ]}
      />

      <ConfirmDialog
        open={roleChange !== null}
        onClose={() => setRoleChange(null)}
        onConfirm={() => {
          if (roleChange) setRole(roleChange.row, roleChange.to);
          setRoleChange(null);
        }}
        title={roleChange ? `Change ${roleChange.row.name} to ${ROLE_LABEL[roleChange.to]}?` : ""}
        confirmLabel="Change role"
        tone="primary"
      >
        <p>Loses: {lostLabels.join(", ")}.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={
          confirm
            ? confirm.action === "revoke"
              ? `Revoke invite for ${confirm.row.email}?`
              : confirm.action === "deactivate"
                ? `Deactivate ${confirm.row.name}?`
                : `Remove ${confirm.row.name}?`
            : ""
        }
        confirmLabel={confirm?.action === "revoke" ? "Revoke invite" : confirm?.action === "deactivate" ? "Deactivate" : "Remove member"}
      >
        {confirm?.action === "revoke"
          ? "The invite link stops working."
          : confirm?.action === "deactivate"
            ? "They lose access now and the seat is freed. History stays. You can reactivate them."
            : "They are removed from the list. Their past activity stays in the logs."}
      </ConfirmDialog>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        websites={websites}
        existing={rows.map((r) => r.email.toLowerCase())}
        seatsFull={seatsFull}
        seatLimit={plan.limits.seats}
        planName={plan.name}
        rolePermissions={rolePermissions}
        total={permissions.length}
        onInvite={(email, role, websiteIds) => {
          create(
            { name: email, email, role, initials: email.slice(0, 2).toUpperCase(), lastActive: null, status: "invited", invitedAt: demoNow(), invitedBy: me?.name ?? "You", websiteIds },
            { kind: "member.invited", label: `Invite created for ${email} as ${ROLE_LABEL[role]}` },
          );
          toast.push(simulatedToast(`Invite created for ${email}`, "info"));
        }}
      />

      <AccessDrawer
        key={accessRow?.id ?? "none"}
        row={accessRow}
        websites={websites}
        onClose={() => setAccessFor(null)}
        onSave={(row, websiteIds) => {
          update(row.id, { websiteIds }, { kind: "member.updated", label: `Website access changed for ${row.name}` });
          toast.push(simulatedToast(`Website access saved for ${row.name}`));
          setAccessFor(null);
        }}
      />
    </>
  );
}

function TeamActivity({ seeded, onInvite }: { seeded: { id: string; at: string; actor: string; title: string }[]; onInvite: () => void }) {
  const events = useDemoEvents({ kinds: ["member.invited", "member.updated"] });
  const items = useMemo(() => {
    const local = events.map((e) => ({ id: e.id, at: e.at, actor: "You", title: e.label, simulated: true }));
    return [...local, ...seeded.map((s) => ({ ...s, simulated: false }))].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [events, seeded]);
  if (items.length === 0) return <EmptyState icon="history" title="No team changes yet" action={<Button onClick={onInvite}>Invite member</Button>} />;
  return (
    <Card>
      <CardHeader title="Team activity" />
      <CardBody>
        <Timeline
          items={items.map((i) => ({
            id: i.id,
            title: i.title,
            time: formatDate(i.at),
            icon: "users",
            tone: i.simulated ? "accent" : "neutral",
            meta: i.simulated ? <Badge tone="info" icon="layers">Simulated</Badge> : i.actor,
          }))}
        />
      </CardBody>
    </Card>
  );
}

function InviteDialog({
  open,
  onClose,
  websites,
  existing,
  seatsFull,
  seatLimit,
  planName,
  rolePermissions,
  total,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  websites: Store[];
  existing: string[];
  seatsFull: boolean;
  seatLimit: number;
  planName: string;
  rolePermissions: RolePermissions;
  total: number;
  onInvite: (email: string, role: Role, websiteIds: string[] | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [scoped, setScoped] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const error = validateEmailAddress(email) ?? (existing.includes(email.trim().toLowerCase()) ? "This person is already a member or invited." : null);
  const accessError = scoped && picked.length === 0 ? "Choose at least one website." : null;

  const close = () => {
    setEmail("");
    setRole("viewer");
    setScoped(false);
    setPicked([]);
    setTouched(false);
    onClose();
  };
  const submit = () => {
    setTouched(true);
    if (error || accessError || seatsFull) return;
    onInvite(email.trim(), role, FULL_ACCESS.includes(role) || !scoped ? null : picked);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Invite member"
      description="Simulated: no email is sent."
      size="sm"
      dirty={email !== ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={seatsFull} onClick={submit}>Create invite</Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {seatsFull ? (
          <Callout tone="warning" title="All seats are used" actions={<ButtonLink href="/settings/billing" size="sm">Billing</ButtonLink>}>
            {planName} includes {seatLimit} seats.
          </Callout>
        ) : null}
        <Field label="Email" required error={touched ? (error ?? undefined) : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="off" aria-describedby={describedBy} invalid={invalid} value={email} placeholder="name@company.com" onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched(true)} />
          )}
        </Field>
        <Field label="Role" hint={`${rolePermissions[role].length} of ${total} permissions`}>
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </Select>
          )}
        </Field>
        {!FULL_ACCESS.includes(role) ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-label font-medium text-fg">Limit to selected websites</span>
              <Switch label="Limit to selected websites" checked={scoped} onChange={setScoped} />
            </div>
            {scoped ? (
              <fieldset className="flex flex-col gap-2 rounded-control border border-line p-3">
                <legend className="sr-only">Websites</legend>
                {websites.map((w) => (
                  <Checkbox
                    key={w.id}
                    label={w.name}
                    checked={picked.includes(w.id)}
                    onChange={(e) => setPicked((list) => (e.target.checked ? [...list, w.id] : list.filter((x) => x !== w.id)))}
                  />
                ))}
                {touched && accessError ? <p role="alert" className="text-helper text-danger-text">{accessError}</p> : null}
              </fieldset>
            ) : null}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

function AccessDrawer({ row, websites, onClose, onSave }: { row: TeamMember | null; websites: Store[]; onClose: () => void; onSave: (row: TeamMember, websiteIds: string[] | null) => void }) {
  const locked = row ? FULL_ACCESS.includes(row.role) : false;
  const [all, setAll] = useState(row?.websiteIds === null || locked);
  const [picked, setPicked] = useState<string[]>(row?.websiteIds ?? []);
  const dirty = row ? (all ? row.websiteIds !== null : JSON.stringify([...picked].sort()) !== JSON.stringify([...(row.websiteIds ?? [])].sort())) : false;
  const invalid = !all && picked.length === 0;
  return (
    <Drawer
      open={row !== null}
      onClose={onClose}
      title={row ? `Website access: ${row.status === "invited" ? row.email : row.name}` : "Website access"}
      size="sm"
      dirty={dirty}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!row || locked || !dirty || invalid} onClick={() => row && onSave(row, all ? null : picked)}>Save access</Button>
        </>
      }
    >
      {row ? (
        <div className="flex flex-col gap-4">
          {locked ? <Callout tone="info" title={`${ROLE_LABEL[row.role]}s always see every website`} /> : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-body font-medium text-fg">All websites</span>
            <Switch label="All websites" checked={all} disabled={locked} onChange={setAll} />
          </div>
          {!all ? (
            <fieldset className="flex flex-col gap-3 rounded-control border border-line p-3.5">
              <legend className="sr-only">Websites</legend>
              {websites.map((w) => (
                <Checkbox
                  key={w.id}
                  label={w.name}
                  description={w.domain}
                  checked={picked.includes(w.id)}
                  onChange={(e) => setPicked((list) => (e.target.checked ? [...list, w.id] : list.filter((x) => x !== w.id)))}
                />
              ))}
              {invalid ? <p role="alert" className="text-helper text-danger-text">Choose at least one website.</p> : null}
            </fieldset>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
