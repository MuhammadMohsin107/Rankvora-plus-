"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Mono } from "@/components/ui/misc";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import type { Role } from "@/types/core";
import type { ApprovalRecord, ApprovalState, ExecutionMode, TaskStatus } from "@/types/fixes";

import { APPROVER_REASON, canApprove, MODE_LABEL } from "./fixes-shared";

const ROLES: Role[] = ["owner", "admin", "editor", "auditor", "viewer"];
const REJECT_REASONS = ["Wording not supported by facts", "Wrong resource", "Too risky for now", "Needs another review", "Other"];

const STATE_BADGE: Record<ApprovalState, { label: string; tone: "neutral" | "warning" | "success" | "danger"; icon: Parameters<typeof Badge>[0]["icon"] }> = {
  not_required: { label: "Not required", tone: "neutral", icon: "minus-circle" },
  not_requested: { label: "Not requested", tone: "neutral", icon: "circle" },
  pending: { label: "Pending approval", tone: "warning", icon: "clock" },
  approved: { label: "Approved", tone: "success", icon: "check-circle" },
  rejected: { label: "Rejected", tone: "danger", icon: "x-circle" },
};

export function shortHash(hash: string | null): string {
  return hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : "None";
}

const PERMISSIONS: { label: string; allowed: (role: Role) => boolean }[] = [
  { label: "View task and diff", allowed: () => true },
  { label: "Edit draft", allowed: (r) => r === "owner" || r === "admin" || r === "editor" },
  { label: "Approve or reject", allowed: canApprove },
  { label: "Run execution", allowed: (r) => r === "owner" || r === "admin" || r === "editor" },
];

type Props = {
  approval: ApprovalRecord;
  state: ApprovalState;
  decidedBy?: string;
  decidedAt?: string;
  mode: ExecutionMode;
  status: TaskStatus;
  actualRole: Role;
  viewRole: Role;
  onViewRole: (role: Role) => void;
  /** The draft was edited after the approved diff. */
  diffChanged: boolean;
  onRequest: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
};

/** Approval is not editing: only owner or admin approves the exact diff hash. */
export function TaskApprovalTab({ approval, state, decidedBy, decidedAt, mode, status, actualRole, viewRole, onViewRole, diffChanged, onRequest, onApprove, onReject }: Props) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState("");

  const allowed = canApprove(viewRole);
  const badge = STATE_BADGE[state];
  const canRequest = state === "not_requested" && (status === "draft_ready" || status === "in_progress");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader title="Approval" actions={<Badge tone={badge.tone} icon={badge.icon}>{badge.label}</Badge>} />
          <CardBody className="flex flex-col gap-4">
            {state === "not_required" ? (
              <Callout tone="neutral" title="No approval needed">{approval.notRequiredReason ?? `${MODE_LABEL[mode]} makes no external write.`}</Callout>
            ) : (
              <>
                <KeyValue
                  columns={2}
                  items={[
                    {
                      label: "Exact diff hash",
                      value: (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span title={approval.diffHash ?? undefined}><Mono>{diffChanged ? "changed (unsaved edit)" : shortHash(approval.diffHash)}</Mono></span>
                          {approval.diffHash && !diffChanged ? (
                            <IconButton
                              icon="copy"
                              label="Copy diff hash"
                              size="sm"
                              onClick={() => {
                                void navigator.clipboard?.writeText(approval.diffHash ?? "");
                                toast.push({ title: "Diff hash copied", description: "Demo digest, not a real SHA-256.", tone: "info" });
                              }}
                            />
                          ) : null}
                        </span>
                      ),
                    },
                    { label: "Required approver", value: "Owner or admin" },
                    { label: "Requested by", value: approval.requestedBy ? `${approval.requestedBy} · ${formatDateTime(approval.requestedAt ?? "")}` : "Not requested" },
                    { label: "Decision", value: decidedBy ? `${decidedBy}${decidedAt ? ` · ${formatDateTime(decidedAt)}` : ""}` : "Open" },
                  ]}
                />

                {approval.writes.length > 0 ? (
                  <div>
                    <h3 className="mb-1.5 text-xs font-medium text-fg-subtle">What approval authorises</h3>
                    <ul className="flex flex-col gap-1.5 rounded-control border border-line bg-surface-2/40 p-3">
                      {approval.writes.map((write) => (
                        <li key={write} className="flex items-start gap-2 text-[13px] text-fg">
                          <Icon name="diff" size={14} className="mt-0.5 shrink-0 text-fg-subtle" />
                          {write}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {state === "approved" && diffChanged ? (
                  <Callout tone="warning" title="Approved diff no longer matches">The draft was edited after approval. Request approval again.</Callout>
                ) : null}
                {state === "approved" && !diffChanged ? (
                  <Callout tone="success" title="Approval matches the current diff">{approval.note ?? "Only this exact diff can be written."}</Callout>
                ) : null}
                {state === "rejected" ? <Callout tone="danger" title="Rejected">{approval.note ?? "Edit the draft and request approval again."}</Callout> : null}

                {state === "pending" ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Button variant="primary" icon="check" disabled={!allowed} onClick={() => setConfirm(true)}>
                      Approve
                    </Button>
                    <Button variant="danger-ghost" icon="x" disabled={!allowed} onClick={() => { setReason(REJECT_REASONS[0]); setNote(""); setRejecting(true); }}>
                      Reject
                    </Button>
                    {!allowed ? (
                      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <Icon name="lock" size={13} />
                        Blocked for {ROLE_LABEL[viewRole]}. {APPROVER_REASON}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {canRequest ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Button variant="primary" icon="clock" onClick={onRequest}>
                      Request approval
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Roles" info="Approval is not editing. Editors can change the draft but cannot approve it." />
          <CardBody className="flex flex-col gap-3">
            <Field label="Preview as role" hint={viewRole === actualRole ? "Your role." : `Preview only. You are ${ROLE_LABEL[actualRole]}.`}>
              {({ id, describedBy }) => (
                <Select id={id} aria-describedby={describedBy} value={viewRole} onChange={(event) => onViewRole(event.target.value as Role)}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <ul className="divide-y divide-line rounded-control border border-line">
              {PERMISSIONS.map((permission) => {
                const ok = permission.allowed(viewRole);
                return (
                  <li key={permission.label} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]">
                    <span className="text-fg">{permission.label}</span>
                    <span className={ok ? "flex items-center gap-1 text-success" : "flex items-center gap-1 text-fg-subtle"}>
                      <Icon name={ok ? "check-circle" : "lock"} size={14} />
                      {ok ? "Allowed" : "Not allowed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="primary"
        title="Approve this exact diff"
        confirmLabel="Approve diff"
        onConfirm={() => {
          setConfirm(false);
          onApprove();
        }}
      >
        <p>
          You approve diff <Mono>{shortHash(approval.diffHash)}</Mono> only. Rankvora Plus may write exactly:
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
          {approval.writes.map((write) => (
            <li key={write}>{write}</li>
          ))}
        </ul>
        <p className="mt-2">Nothing is written until the execution step. If the remote resource changes first, the write is held.</p>
      </ConfirmDialog>

      <Dialog
        open={rejecting}
        onClose={() => setRejecting(false)}
        title="Reject approval"
        description="The task goes back for edits. Nothing is written."
        footer={
          <>
            <Button onClick={() => setRejecting(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                setRejecting(false);
                onReject(`${reason}${note.trim() ? `: ${note.trim()}` : ""}`);
              }}
            >
              Reject
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Reason">
            {({ id }) => (
              <Select id={id} value={reason} onChange={(event) => setReason(event.target.value)}>
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Note" hint="Optional">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
