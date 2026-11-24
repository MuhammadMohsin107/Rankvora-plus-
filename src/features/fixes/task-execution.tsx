"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge, Status } from "@/components/ui/badge";
import { DemoBadge } from "@/components/ui/demo";
import { Button } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { Stepper } from "@/components/ui/feedback";
import { Checkbox, Field, Textarea } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { DiffView, Mono } from "@/components/ui/misc";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { formatDateTime } from "@/lib/format";
import type { Role } from "@/types/core";
import type { ApprovalState, BatchItem, CmsState, ExecutionMode, ExecutionRecord, FieldOutcome, RemoteCheck, TaskDraft, TaskStatus } from "@/types/fixes";

import { CodeDiff } from "./code-diff";
import { CMS_STATE_LABEL } from "./fixes-shared";
import { shortHash } from "./task-approval";
import { BATCH_BADGE } from "./task-draft";

const CMS_STEPS: CmsState[] = ["draft", "staged", "applied", "published"];
const WRITTEN: ReadonlySet<TaskStatus> = new Set(["applied", "published", "verification_pending", "verified_success", "partially_verified"]);
const ROLLBACK_STATUSES: ReadonlySet<TaskStatus> = new Set(["applied", "published", "verification_pending", "partially_verified", "failed"]);

const OUTCOME: Record<FieldOutcome["outcome"], { label: string; tone: "neutral" | "success" | "warning" | "danger"; icon: Parameters<typeof Badge>[0]["icon"] }> = {
  pending: { label: "Pending", tone: "neutral", icon: "clock" },
  written: { label: "Written", tone: "success", icon: "check-circle" },
  skipped: { label: "Held", tone: "warning", icon: "alert-triangle" },
  failed: { label: "Failed", tone: "danger", icon: "x-circle" },
  reverted: { label: "Reverted", tone: "neutral", icon: "undo" },
};

/** Which CMS state the task is in, following local status moves. */
export function cmsStateFor(status: TaskStatus, record: CmsState, mode: ExecutionMode): CmsState {
  if (mode === "guidance") return "guidance";
  if (status === "staged") return "staged";
  if (status === "applied") return "applied";
  if (status === "published") return "published";
  if (["suggested", "pending_approval", "approved", "queued", "in_progress", "blocked", "draft_ready"].includes(status)) return "draft";
  return record;
}

/** "read_content" becomes "Read content". Scope names stay neutral; no platform names. */
const scopeLabel = (scope: string) => {
  const text = scope.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function nextWrite(status: TaskStatus, mode: ExecutionMode): { label: string; target: TaskStatus } | null {
  if (mode === "guidance" || mode === "ai_draft") return null;
  if (status === "draft_ready" && mode === "cms_staged") return { label: "Stage draft", target: "staged" };
  if (status === "approved" || status === "queued") return mode === "cms_staged" ? { label: "Stage draft", target: "staged" } : { label: "Apply change", target: "applied" };
  if (status === "staged") return { label: "Apply change", target: "applied" };
  if (status === "applied") return { label: "Publish", target: "published" };
  return null;
}

type Props = {
  storeId: string;
  execution: ExecutionRecord;
  remote: RemoteCheck | null;
  draft: TaskDraft;
  text: string;
  status: TaskStatus;
  mode: ExecutionMode;
  approvalState: ApprovalState;
  diffHash: string | null;
  role: Role;
  batch: Record<string, BatchItem["result"]>;
  onWrite: (target: TaskStatus, label: string) => void;
  onRollback: (reason: string) => void;
  onRedraft: () => void;
  onRecheck: () => void;
};

function Scope({ name, ok }: { name: string; ok?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-xs">
      {ok === undefined ? null : <Icon name={ok ? "check-circle" : "x-circle"} size={12} className={ok ? "text-success-icon" : "text-danger-icon"} />}
      <span className="font-mono">{name}</span>
    </span>
  );
}

/** One line of what the write changes, for the confirmation. */
function changeSummary(draft: TaskDraft, fields: FieldOutcome[]): string {
  if (draft.kind === "batch") return `${draft.items.filter((i) => i.result !== "excluded").length} items. Excluded items are not written.`;
  if (fields[0]) return `${fields[0].field}: ${fields.length} ${fields.length === 1 ? "field" : "fields"} changed.`;
  return "One change.";
}

/** Connector, scopes, remote version check, exact diff, per-field outcome, CMS state and rollback. */
export function TaskExecutionTab({ storeId, execution, remote, draft, text, status, mode, approvalState, diffHash, role, batch, onWrite, onRollback, onRedraft, onRecheck }: Props) {
  const [confirm, setConfirm] = useState<{ label: string; target: TaskStatus } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");

  const { connector, rollback } = execution;
  const cms = cmsStateFor(status, execution.cmsState, mode);
  const stepIndex = Math.max(0, CMS_STEPS.indexOf(cms));
  const write = nextWrite(status, mode);
  const canExecute = role === "owner" || role === "admin" || role === "editor";
  const changed = Boolean(remote?.changed);
  const failure = execution.failure ?? null;
  const connectionBlock = connector && connector.state !== "connected" ? "The connector needs attention. Reconnect it first." : null;
  const stageWord = failure?.stage === "stage" ? "staging" : failure?.stage === "publish" ? "publish" : "apply";
  const retryTarget: TaskStatus = failure?.stage === "stage" ? "staged" : failure?.stage === "publish" ? "published" : "applied";
  const retry = failure && status === "failed" && mode !== "guidance" && mode !== "ai_draft" ? { label: draft.kind === "batch" ? "Retry failed items" : `Retry ${stageWord}`, target: retryTarget } : null;

  let writeBlock: string | null = null;
  if (write || retry) {
    if (!canExecute) writeBlock = "Your role cannot run execution.";
    else if (approvalState !== "approved") writeBlock = "Needs an approved diff first.";
    else if (connectionBlock) writeBlock = connectionBlock;
    else if (retry && failure?.retryBlockedBy) writeBlock = failure.retryBlockedBy;
  }

  const fields: FieldOutcome[] = execution.fields.map((f) => {
    if (f.outcome === "pending" && WRITTEN.has(status)) return { ...f, outcome: "written", note: undefined };
    if (f.outcome === "written" && status === "rolled_back") return { ...f, outcome: "reverted" };
    return f;
  });

  /** The exact diff above already shows before / after for these drafts. */
  const diffCovered = ((draft.kind === "text" || draft.kind === "patch") && fields.length === 1) || draft.kind === "batch";
  const rolledBack = status === "rolled_back";
  const canRollback = rollback.available && ROLLBACK_STATUSES.has(status);
  const rollbackReady = reason.trim().length >= 5 && (!rollback.laterEdit || ack);

  return (
    <div className="flex flex-col gap-3">
      <div className={cms === "guidance" ? "grid grid-cols-[minmax(0,1fr)] gap-3" : "grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-2"}>
        <Card>
          <CardHeader title="Connector" subtitle="Optional" actions={connector && connector.state !== "disconnected" ? <DemoBadge>Demo</DemoBadge> : <Badge tone="neutral" icon="plug">Not connected</Badge>} />
          <CardBody className="flex flex-col gap-3">
            {connector ? (
              <>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "Site", value: connector.site },
                    { label: "Connection", value: <Status kind="integration" value={connector.state} /> },
                    {
                      label: "Granted access",
                      value: (
                        <span className="flex flex-wrap gap-1.5">
                          {connector.scopesGranted.map((scope) => (
                            <Scope key={scope} name={scopeLabel(scope)} />
                          ))}
                        </span>
                      ),
                    },
                    {
                      label: "This task needs",
                      value: (
                        <span className="flex flex-wrap gap-1.5">
                          {connector.scopesRequired.map((scope) => (
                            <Scope key={scope} name={scopeLabel(scope)} ok={connector.scopesGranted.includes(scope)} />
                          ))}
                        </span>
                      ),
                    },
                  ]}
                />
                {connector.note ? <p className="text-helper text-fg-subtle">{connector.note}</p> : null}
                {connector.state !== "connected" ? (
                  <Link href={`/stores/${storeId}/settings`} className="text-label font-medium text-accent-text hover:underline">Open website settings to reconnect</Link>
                ) : null}
              </>
            ) : (
              <Callout tone="neutral" title="Not connected">
                {mode === "guidance" ? "A person makes any change." : "Writes are simulated. A connector is optional."}
              </Callout>
            )}
          </CardBody>
        </Card>

        {cms === "guidance" ? null : (
          <Card>
            <CardHeader title="Change state" info="Draft and staged are not live. Applied and published are not verified." />
            <CardBody className="flex flex-col gap-3">
              <Stepper
                steps={CMS_STEPS.map((s) => ({ id: s, label: CMS_STATE_LABEL[s] }))}
                current={cms === "published" ? CMS_STEPS.length : stepIndex}
              />
              {execution.stagedAt ? <p className="tnum text-xs text-fg-subtle">Staged {formatDateTime(execution.stagedAt)}</p> : null}
            </CardBody>
          </Card>
        )}
      </div>

      {failure ? (
        <Card>
          <CardHeader title="Last attempt failed" subtitle={`${failure.stage === "stage" ? "Staging" : failure.stage === "publish" ? "Publish" : "Apply"} · ${formatDateTime(failure.at)} UTC`} />
          <CardBody className="flex flex-col gap-3">
            <Callout tone="danger" title={failure.nothingWritten ? "Failed. Nothing was changed on the live site." : "Failed. Part of the change may have been written."}>
              <p>{failure.message}</p>
              <p className="mt-1 font-mono text-xs">{failure.code}</p>
            </Callout>
            <ul className="divide-y divide-line rounded-control border border-line">
              {failure.attempts.map((attempt, index) => (
                <li key={attempt.at} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                  <span className="text-fg">Attempt {index + 1}</span>
                  <span className="tnum text-xs text-fg-muted">{formatDateTime(attempt.at)} UTC · {attempt.result}</span>
                </li>
              ))}
            </ul>
            <KeyValue
              columns={2}
              items={[
                { label: "Retry", value: failure.retryBlockedBy ? <Badge tone="warning" icon="lock">Blocked</Badge> : failure.retryable ? <Badge tone="success" icon="check-circle">Available</Badge> : <Badge tone="neutral">Not possible</Badge> },
                { label: "Rollback", value: failure.nothingWritten ? "Not needed" : "See rollback below" },
              ]}
            />
            <p className="text-[13px] text-fg-muted">{failure.retryBlockedBy ? `${failure.retryBlockedBy} ` : ""}{failure.nextStep}</p>
          </CardBody>
        </Card>
      ) : null}

      {remote ? (
        <Card>
          <CardHeader
            title="Remote version check"
            subtitle={remote.resource}
            actions={
              <Button
                size="sm"
                icon="refresh"
                onClick={onRecheck}
              >
                Re-check
              </Button>
            }
          />
          <CardBody className="flex flex-col gap-3">
            {changed ? (
              <Callout
                tone="warning"
                title="Resource changed since draft"
                actions={status === "queued" || status === "approved" || status === "staged" ? <Button size="sm" icon="sparkles" onClick={onRedraft}>Redraft from current</Button> : undefined}
              >
                {remote.changedBy ? `${remote.changedBy} edited it ${remote.changedAt ? formatDateTime(remote.changedAt) : ""}. ` : ""}
                {remote.note ?? ""} The write is held until the draft is rebuilt from the current copy.
              </Callout>
            ) : (
              <Callout tone="success" title="Remote matches the draft" />
            )}
            <KeyValue
              columns={3}
              items={[
                { label: "Version at draft", value: <Mono>{remote.versionAtDraft}</Mono> },
                { label: "Version now", value: <Mono>{remote.versionNow}</Mono> },
                { label: "Checked", value: <span className="tnum">{formatDateTime(remote.checkedAt)} UTC</span> },
                { label: "Hash at draft", value: <Mono>{shortHash(remote.hashAtDraft)}</Mono> },
                { label: "Hash now", value: <Mono>{shortHash(remote.hashNow)}</Mono> },
              ]}
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Exact diff" info="What is written, nothing more." />
        <CardBody>
          {draft.kind === "text" ? (
            <DiffView before={draft.before} after={text} beforeLabel="Current" afterLabel="Will be written" />
          ) : draft.kind === "patch" ? (
            <CodeDiff before={draft.before} after={text} label={remote ? draft.language : `${draft.resource} · ${draft.language}`} />
          ) : draft.kind === "batch" ? (
            <ul className="divide-y divide-line rounded-control border border-line">
              {draft.items.map((item) => {
                const result = batch[item.id] ?? item.result;
                const view = BATCH_BADGE[result];
                return (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                    <span className="min-w-0 truncate text-fg">{item.pageUrl.replace("https://", "")}</span>
                    <span className="flex items-center gap-2">
                      <Mono>{item.from}</Mono>
                      <Icon name="arrow-right" size={12} className="text-fg-subtle" />
                      <Mono>{item.to}</Mono>
                      <Badge tone={view.tone} icon={view.icon}>{view.label}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-subtle">No diff.</p>
          )}
        </CardBody>
      </Card>

      {fields.length > 0 ? (
        <Card>
          <CardHeader title="Per-field outcome" />
          <CardBody className="pt-2">
            <ul className="divide-y divide-line">
              {fields.map((f) => {
                const view = OUTCOME[f.outcome];
                return (
                  <li key={f.field} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-fg">{f.field}</p>
                      {diffCovered ? null : (
                        <p className="mt-0.5 truncate text-xs text-fg-muted">
                          {f.before} <Icon name="arrow-right" size={11} className="inline" /> {f.after}
                        </p>
                      )}
                      {f.note ? <p className="mt-0.5 text-xs text-fg-subtle">{f.note}</p> : null}
                    </div>
                    <Badge tone={view.tone} icon={view.icon}>{view.label}</Badge>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {rollback.record ? (
        <Card>
          <CardHeader title="Rollback record" />
          <CardBody className="flex flex-col gap-3">
            <KeyValue
              columns={2}
              items={[
                { label: "Rolled back", value: <span className="tnum">{formatDateTime(rollback.record.at)} · {rollback.record.by}</span> },
                { label: "Restored hash", value: <Mono>{shortHash(rollback.record.restoredHash)}</Mono> },
                { label: "Reason", value: rollback.record.reason },
                { label: "Outcome", value: rollback.record.outcome === "restored" ? "Restored" : "Restored with manual merge" },
              ]}
            />
            {rollback.record.preservedEdits.length > 0 ? (
              <Callout tone="warning" title="Later edit kept">
                {rollback.record.note} Kept: {rollback.record.preservedEdits.join(", ")}.
              </Callout>
            ) : (
              <p className="text-helper text-fg-subtle">{rollback.record.note}</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {write ? (
          <Button variant="secondary" icon="bolt" disabled={Boolean(writeBlock) || changed} title={changed ? "Resource changed since draft" : undefined} onClick={() => setConfirm(write)}>
            {write.label}
          </Button>
        ) : null}
        {retry ? (
          <Button variant="secondary" icon="refresh" disabled={Boolean(writeBlock) || changed} title={changed ? "Resource changed since draft" : undefined} onClick={() => setConfirm(retry)}>
            {retry.label}
          </Button>
        ) : null}
        {canRollback ? (
          <Button
            variant="danger-ghost"
            icon="undo"
            onClick={() => {
              setReason("");
              setAck(false);
              setRolling(true);
            }}
          >
            Roll back
          </Button>
        ) : null}
        {writeBlock ? (
          <span className="flex items-center gap-1.5 text-xs text-fg-muted">
            <Icon name="lock" size={13} />
            {writeBlock}
          </span>
        ) : null}
        {!write && !retry && !canRollback && !rolledBack ? <span className="text-xs text-fg-subtle">{rollback.unavailableReason ?? "No execution step available."}</span> : null}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        tone="primary"
        title={confirm?.label ?? "Write"}
        confirmLabel={confirm?.label ?? "Write"}
        onConfirm={() => {
          if (!confirm) return;
          onWrite(confirm.target, confirm.label);
          setConfirm(null);
        }}
      >
        <p>
          Simulated: records this write of the exact diff{connector ? <> to <span className="font-medium text-fg">{connector.site}</span></> : null}. Nothing is sent to a real site. Approved diff <Mono>{shortHash(diffHash)}</Mono> is checked against the remote version first.
        </p>
        <p className="mt-2 text-fg-muted">{changeSummary(draft, fields)}</p>
      </ConfirmDialog>

      <Dialog
        open={rolling}
        onClose={() => setRolling(false)}
        title="Roll back this change"
        description="Restores the version from before this task."
        footer={
          <>
            <Button onClick={() => setRolling(false)}>Cancel</Button>
            <Button
              variant="danger"
              icon="undo"
              disabled={!rollbackReady}
              onClick={() => {
                setRolling(false);
                onRollback(reason.trim());
              }}
            >
              Roll back
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {rollback.laterEdit ? (
            <Callout tone="warning" title="The remote resource was edited after this change">
              {rollback.laterEdit.by} edited it {formatDateTime(rollback.laterEdit.at)}. {rollback.laterEdit.note} Rollback does not overwrite it automatically, so it needs manual reconciliation.
            </Callout>
          ) : null}
          {rollback.laterEdit ? <Checkbox checked={ack} onChange={(event) => setAck(event.target.checked)} label="I will reconcile the later edit manually" /> : null}
          <Field label="Reason" required hint="Recorded in history." error={reason.length > 0 && reason.trim().length < 5 ? "Write at least 5 characters." : undefined}>
            {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
