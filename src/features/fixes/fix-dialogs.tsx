"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { formatDate } from "@/lib/format";
import type { ExecutionMode, Recommendation, TaskRow } from "@/types/fixes";

import { MODE_HINT, MODE_LABEL } from "./fixes-shared";

type ReasonProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reasons: string[];
  /** Accepted risk: optional review date. */
  expiry?: boolean;
  onConfirm: (reason: string, expiresAt?: string) => void;
};

/** A short reason (preset plus optional note) recorded in history. Used for reject, cancel, rollback, false positive, accepted risk. */
export function ReasonDialog(props: ReasonProps) {
  // Remount on open so each use starts clean.
  return <ReasonBody key={String(props.open)} {...props} />;
}

function ReasonBody({ open, onClose, title, description, confirmLabel, tone = "danger", reasons, expiry, onConfirm }: ReasonProps) {
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [expires, setExpires] = useState("");
  const full = `${reason}${note.trim() ? `: ${note.trim()}` : ""}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={tone} onClick={() => onConfirm(full, expires || undefined)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Reason">
          {({ id }) => (
            <Select id={id} value={reason} onChange={(event) => setReason(event.target.value)}>
              {reasons.map((r) => (
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
        {expiry ? (
          <Field label="Review again on" hint="Optional">
            {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />}
          </Field>
        ) : null}
      </div>
    </Dialog>
  );
}

export const REASONS = {
  falsePositive: ["Reviewed: intended behaviour", "Not reproducible", "Wrong page or prompt", "Other"],
  acceptRisk: ["Low impact", "Cost outweighs the benefit", "Waiting for a decision", "Other"],
  cancel: ["No longer needed", "Waiting for a decision", "Handled elsewhere", "Other"],
  reject: ["Not relevant", "Too risky for now", "Needs another review", "Other"],
  rollback: ["Layout or content problem", "Wrong change", "Requested by the owner", "Other"],
};

type SupersedeProps = {
  open: boolean;
  onClose: () => void;
  /** Other open tasks of the same finding. */
  candidates: TaskRow[];
  onConfirm: (successorId: string, reason: string) => void;
};

export function SupersedeDialog({ open, onClose, candidates, onConfirm }: SupersedeProps) {
  return <SupersedeBody key={String(open)} open={open} onClose={onClose} candidates={candidates} onConfirm={onConfirm} />;
}

function SupersedeBody({ open, onClose, candidates, onConfirm }: SupersedeProps) {
  const [successor, setSuccessor] = useState(candidates[0]?.id ?? "");
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Replace with another task"
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!successor} onClick={() => onConfirm(successor, reason.trim() || "Replaced by a newer task")}>
            Replace
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <Callout tone="neutral" title="No replacement yet">Create the replacing task from the finding first.</Callout>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Replaced by">
            {({ id }) => (
              <Select id={id} value={successor} onChange={(event) => setSuccessor(event.target.value)}>
                {candidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.title}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reason" hint="Optional">
            {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
        </div>
      )}
    </Dialog>
  );
}

type CreateProps = {
  open: boolean;
  onClose: () => void;
  recommendation: Recommendation | null;
  /** Open tasks that already address this finding. */
  openTasks: { id: string; title: string }[];
  onCreate: (input: { mode: ExecutionMode; dueAt: string | null }) => void;
};

export function CreateTaskDialog(props: CreateProps) {
  return <CreateBody key={`${props.open}-${props.recommendation?.id ?? ""}`} {...props} />;
}

function CreateBody({ open, onClose, recommendation, openTasks, onCreate }: CreateProps) {
  const [mode, setMode] = useState<ExecutionMode>(recommendation?.suggestedMode ?? "guidance");
  const [due, setDue] = useState("");
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create task"
      description={recommendation?.title}
      size="sm"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="plus" onClick={() => onCreate({ mode, dueAt: due ? `${due}T00:00:00Z` : null })}>
            Create task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {openTasks.length > 0 ? (
          <Callout tone="warning" title="A task is already open">
            {openTasks.map((t) => t.id).join(", ")} already covers this finding.
          </Callout>
        ) : null}
        <Field label="Execution mode" hint={MODE_HINT[mode]}>
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={mode} onChange={(event) => setMode(event.target.value as ExecutionMode)}>
              {(Object.keys(MODE_LABEL) as ExecutionMode[]).map((m) => (
                <option key={m} value={m}>
                  {MODE_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date" hint={due ? formatDate(`${due}T00:00:00Z`) : "Optional"}>
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="date" value={due} onChange={(event) => setDue(event.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
