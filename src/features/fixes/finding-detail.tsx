"use client";

import Link from "next/link";
import { useState } from "react";

import { PageHeader, SplitLayout } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, KeyValue } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Dialog, ConfirmDialog } from "@/components/ui/overlay";
import { Timeline } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { ResponseButton } from "@/features/responses/response-inspector";
import { formatDate, formatDateTime } from "@/lib/format";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { Role } from "@/types/core";
import type { AssigneeOption, ExecutionMode, FindingDetailData, ResolvedEvidence } from "@/types/fixes";

import { canApprove, CATEGORY_LABEL, MODE_HINT, MODE_LABEL } from "./fixes-shared";
import { RecommendationCard, type RecLocal } from "./recommendation-card";

type Dialogs = { type: "approve" | "edit" | "reject" | "task"; recId: string } | null;

const REJECT_REASONS = ["Not relevant", "Already handled", "Too risky", "Accepting the risk", "Other"];

const LANE_LABEL = { ai_visibility: "AI visibility lane", website_readiness: "Website readiness lane" } as const;

const evidenceIcon: Record<ResolvedEvidence["kind"], IconName> = { response: "prompts", page: "globe", prompt: "search" };

function evidenceLabel(e: ResolvedEvidence): string {
  if (e.kind === "response") return `${e.response.providerLabel} · sample ${e.response.sample}`;
  if (e.kind === "page") return e.url.replace("https://", "");
  return `Prompt ${e.promptId}`;
}

type Props = { storeId: string; data: FindingDetailData; role: Role; assignees: AssigneeOption[] };

/** Finding detail with recommendation approval, edit and rejection (demo, local state). */
export function FindingDetail({ storeId, data, role, assignees }: Props) {
  const toast = useToast();
  const { finding, extras, evidence, prompts, recommendations, tasks } = data;
  const base = `/stores/${storeId}`;
  const approver = canApprove(role);

  const [local, setLocal] = useState<Record<string, RecLocal>>(() =>
    Object.fromEntries(
      recommendations.map((r) => [
        r.id,
        { status: r.status, action: r.action, decisionNote: r.decisionNote, decidedBy: r.decidedBy, edited: false, taskCreated: false } satisfies RecLocal,
      ]),
    ),
  );
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [editText, setEditText] = useState("");
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<ExecutionMode>("ai_draft");
  const [assignee, setAssignee] = useState(assignees[0]?.name ?? "");
  const [due, setDue] = useState("2026-11-30");

  const active = dialog ? recommendations.find((r) => r.id === dialog.recId) : undefined;
  const patch = (id: string, next: Partial<RecLocal>) => setLocal((current) => ({ ...current, [id]: { ...current[id], ...next } }));
  const close = () => setDialog(null);

  const open = (type: NonNullable<Dialogs>["type"], recId: string) => {
    const rec = recommendations.find((r) => r.id === recId);
    if (!rec) return;
    if (type === "edit") setEditText(local[recId].action);
    if (type === "reject") {
      setReason(REJECT_REASONS[0]);
      setNote("");
    }
    if (type === "task") setMode(rec.suggestedMode);
    setDialog({ type, recId });
  };

  const evidenceLabels = Object.fromEntries(evidence.map((e) => [e.id, evidenceLabel(e)]));

  const approvedWithoutTask = recommendations.find((r) => local[r.id].status === "approved" && !r.taskId && !local[r.id].taskCreated);
  const hasProposed = recommendations.some((r) => local[r.id].status === "proposed");

  let primary: React.ReactNode;
  if (approvedWithoutTask) {
    primary = (
      <Button variant="primary" icon="plus" onClick={() => open("task", approvedWithoutTask.id)}>
        Create task
      </Button>
    );
  } else if (hasProposed) {
    primary = (
      <ButtonLink href="#recommendations" variant="primary" icon="check">
        Review recommendations
      </ButtonLink>
    );
  } else if (tasks[0]) {
    primary = (
      <ButtonLink href={`${base}/fixes/tasks/${tasks[0].id}`} variant="primary" trailingIcon="arrow-right">
        Open {tasks[0].id}
      </ButtonLink>
    );
  } else {
    primary = (
      <ButtonLink href={`${base}/fixes`} variant="secondary" icon="arrow-left">
        Findings inbox
      </ButtonLink>
    );
  }

  return (
    <>
      <PageHeader
        title={finding.title}
        breadcrumb={[
          { label: "Fixes", href: `${base}/fixes` },
          { label: "Findings", href: `${base}/fixes` },
          { label: finding.id },
        ]}
        subtitle={`${CATEGORY_LABEL[finding.category]} · ${LANE_LABEL[finding.lane]} · first detected ${formatDate(finding.firstDetectedAt)}`}
        meta={
          <>
            <Status kind="finding" value={finding.status} />
            <Status kind="severity" value={finding.severity} />
            <Status kind="priority" value={finding.priority} />
          </>
        }
        actions={primary}
      />

      <SplitLayout
        main={
          <>
            <Card>
              <CardHeader title="Expected vs observed" />
              <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                <div className="rounded-control border border-line bg-surface-2/40 p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <Icon name="check-circle" size={14} />
                    Expected
                  </h3>
                  <p className="mt-1 text-[13px] text-fg">{finding.expected}</p>
                </div>
                <div className="rounded-control border border-line bg-surface-2/40 p-3">
                  <h3 className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <Icon name="alert-circle" size={14} />
                    Observed
                  </h3>
                  <p className="mt-1 text-[13px] text-fg">{finding.actual}</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Evidence" subtitle={`${evidence.length} items`} info="Raw responses are read-only. Failed requests are never counted as the brand being absent." />
              <CardBody className="pt-2">
                {evidence.length === 0 ? (
                  <p className="text-[13px] text-fg-subtle">No evidence recorded.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {evidence.map((e) => (
                      <li key={e.id} id={`ev-${e.id}`} className="flex scroll-mt-24 items-start gap-3 py-2.5">
                        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-subtle">
                          <Icon name={evidenceIcon[e.kind]} size={15} />
                        </span>
                        <div className="min-w-0 flex-1">
                          {e.kind === "response" ? (
                            <>
                              <ResponseButton response={e.response}>View API answer sample</ResponseButton>
                              <p className="mt-0.5 text-xs text-fg-subtle">
                                {e.response.providerLabel} API · {e.response.model} · {SEARCH_MODE_LABEL[e.response.searchMode]} · sample {e.response.sample}
                              </p>
                            </>
                          ) : e.kind === "page" ? (
                            <>
                              <a href={e.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
                                <span className="truncate">{e.url.replace("https://", "")}</span>
                                <Icon name="external" size={12} className="shrink-0" />
                              </a>
                              <p className="mt-0.5 text-xs text-fg-subtle">
                                <Link href={`${base}/audits/${e.auditId}`} className="hover:underline">{e.auditId}</Link> crawl
                              </p>
                            </>
                          ) : (
                            <>
                              <Link href={`${base}/prompts/${e.promptId}`} className="text-[13px] font-medium text-accent-text hover:underline">
                                {e.text}
                              </Link>
                              <p className="mt-0.5 text-xs text-fg-subtle">Prompt {e.promptId}</p>
                            </>
                          )}
                          <p className="mt-0.5 text-xs text-fg-muted">{e.note}</p>
                        </div>
                        <Badge tone="neutral">{e.id.toUpperCase()}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Affected" subtitle={`${finding.affectedUrls.length} URLs · ${prompts.length} prompts`} />
              <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <h3 className="mb-1.5 text-xs font-medium text-fg-subtle">URLs</h3>
                  {finding.affectedUrls.length === 0 ? (
                    <p className="text-[13px] text-fg-subtle">None. This finding comes from AI responses.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {finding.affectedUrls.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-[13px] text-accent-text hover:underline">
                            <span className="truncate">{url.replace("https://", "")}</span>
                            <Icon name="external" size={12} className="shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="mb-1.5 text-xs font-medium text-fg-subtle">Prompts</h3>
                  {prompts.length === 0 ? (
                    <p className="text-[13px] text-fg-subtle">None. This finding comes from a page check.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {prompts.map((p) => (
                        <li key={p.id}>
                          <Link href={`${base}/prompts/${p.id}`} className="text-[13px] text-accent-text hover:underline">
                            {p.text}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardBody>
            </Card>

            <section id="recommendations" aria-labelledby="rec-heading" className="flex scroll-mt-24 flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 id="rec-heading" className="text-sm font-semibold text-fg">
                  Recommendations <span className="tnum font-normal text-fg-subtle">{recommendations.length}</span>
                </h2>
                {!approver ? <Badge tone="neutral" icon="lock">View only</Badge> : null}
              </div>
              {recommendations.length === 0 ? (
                <EmptyState
                  icon="sparkles"
                  title="No recommendations"
                  description={finding.status === "false_positive" ? "Closed as a false positive." : "Nothing proposed yet."}
                  action={<ButtonLink href={`${base}/fixes`} variant="secondary" icon="arrow-left">Findings inbox</ButtonLink>}
                />
              ) : (
                recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    rec={rec}
                    local={local[rec.id]}
                    evidenceLabels={evidenceLabels}
                    canApprove={approver}
                    storeId={storeId}
                    onApprove={() => open("approve", rec.id)}
                    onEdit={() => open("edit", rec.id)}
                    onReject={() => open("reject", rec.id)}
                    onReopen={() => {
                      patch(rec.id, { status: "proposed", decisionNote: undefined });
                      toast.push({ title: "Recommendation reopened", description: "Back to Proposed. Demo action, not saved.", tone: "info" });
                    }}
                    onCreateTask={() => open("task", rec.id)}
                  />
                ))
              )}
            </section>
          </>
        }
        aside={
          <>
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <KeyValue
                  columns={1}
                  items={[
                    { label: "Confidence", value: <Status kind="confidence" value={finding.confidence} /> },
                    { label: "First detected", value: <Link href={finding.auditId.startsWith("run-") ? `${base}/monitoring/runs/${finding.auditId}` : `${base}/audits/${finding.auditId}`} className="text-accent-text hover:underline">{finding.auditId} · {formatDate(finding.firstDetectedAt)}</Link> },
                    { label: "Last observed", value: <span className="tnum">{formatDateTime(finding.lastObservedAt)} UTC</span> },
                    { label: "Observed", value: <span className="tnum">{finding.recurrenceCount} {finding.recurrenceCount === 1 ? "time" : "times"}</span> },
                    ...(extras.duplicate ? [{ label: "Possible duplicate", value: <Link href={`${base}/fixes/findings/${extras.duplicate.ofId}`} className="text-accent-text hover:underline">{extras.duplicate.ofId} · {extras.duplicate.reason}</Link> }] : []),
                  ]}
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Rationale" />
              <CardBody className="flex flex-col gap-3">
                <div>
                  <Status kind="severity" value={finding.severity} />
                  <p className="mt-1.5 text-[13px] text-fg-muted">{extras.severityRationale}</p>
                </div>
                <div className="border-t border-line pt-3">
                  <Status kind="priority" value={finding.priority} />
                  <p className="mt-1.5 text-[13px] text-fg-muted">{extras.priorityRationale}</p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Linked tasks" subtitle={tasks.length === 0 ? undefined : `${tasks.length}`} />
              <CardBody className="pt-2">
                {tasks.length === 0 ? (
                  <p className="text-[13px] text-fg-subtle">No task yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {tasks.map((t) => (
                      <li key={t.id}>
                        <Link href={`${base}/fixes/tasks/${t.id}`} className="flex flex-col gap-1.5 rounded-control py-2.5 hover:bg-surface-2/60">
                          <span className="text-[13px] font-medium text-fg">{t.title}</span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Status kind="task" value={t.status} />
                            <span className="tnum text-xs text-fg-subtle">{t.id}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Verification criteria" info="Checked by re-running checks. A task being applied or published does not verify the finding." />
              <CardBody className="pt-2">
                <ul className="flex flex-col gap-2">
                  {extras.verificationCriteria.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-[13px] text-fg-muted">
                      <Icon name="shield-check" size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                      {c}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Observation history" subtitle={`${extras.observations.length} ${extras.observations.length === 1 ? "observation" : "observations"}`} />
              <CardBody>
                <Timeline
                  items={extras.observations.map((o, index) => ({
                    id: o.id,
                    icon: index === 0 ? "circle-dot" : "eye",
                    tone: index === 0 ? "accent" : "neutral",
                    time: formatDateTime(o.at),
                    title: (
                      <span>
                        {index === 0 ? "First detected" : "Observed again"}
                        {o.provisional ? <Badge tone="warning" className="ml-1.5">Provisional</Badge> : null}
                      </span>
                    ),
                    meta: (
                      <>
                        {o.sourceHref ? <Link href={`${base}/${o.sourceHref}`} className="text-accent-text hover:underline">{o.source}</Link> : o.source}
                        <span> · {o.note}</span>
                      </>
                    ),
                  }))}
                />
              </CardBody>
            </Card>
          </>
        }
      />

      <ConfirmDialog
        open={dialog?.type === "approve"}
        onClose={close}
        tone="primary"
        title="Approve recommendation"
        confirmLabel="Approve"
        onConfirm={() => {
          if (!dialog) return;
          patch(dialog.recId, { status: "approved", decidedBy: "you", decisionNote: undefined });
          toast.push({ title: "Recommendation approved", description: "A task can now be created. Nothing on the site changes. Demo action, not saved." });
          close();
        }}
      >
        <p>{active?.title}</p>
        <p className="mt-2">Approving makes it eligible for a task. It does not edit the site or write to Shopify.</p>
      </ConfirmDialog>

      <Dialog
        open={dialog?.type === "edit"}
        onClose={close}
        title="Edit proposed action"
        description="Edits to an approved action need approval again."
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              disabled={editText.trim().length < 10}
              onClick={() => {
                if (!dialog) return;
                const wasApproved = local[dialog.recId].status === "approved";
                patch(dialog.recId, { action: editText.trim(), edited: true, ...(wasApproved ? { status: "proposed" as const, decisionNote: undefined } : {}) });
                toast.push({ title: "Action updated", description: wasApproved ? "Back to Proposed: it needs approval again. Demo action, not saved." : "Demo action, not saved.", tone: wasApproved ? "info" : "success" });
                close();
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Proposed action" hint="Imperative, scoped to one resource." error={editText.trim().length < 10 ? "Write at least 10 characters." : undefined}>
          {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={4} value={editText} onChange={(event) => setEditText(event.target.value)} />}
        </Field>
      </Dialog>

      <Dialog
        open={dialog?.type === "reject"}
        onClose={close}
        title="Reject recommendation"
        description={active?.title}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!dialog) return;
                patch(dialog.recId, { status: "rejected", decisionNote: `${reason}${note.trim() ? `: ${note.trim()}` : ""}` });
                toast.push({ title: "Recommendation rejected", description: `${reason}. Demo action, not saved.`, tone: "info" });
                close();
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

      <Dialog
        open={dialog?.type === "task"}
        onClose={close}
        title="Create task"
        description={active?.title}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant="primary"
              icon="plus"
              onClick={() => {
                if (!dialog) return;
                patch(dialog.recId, { taskCreated: true });
                toast.push({ title: "Task created", description: `${MODE_LABEL[mode]} · ${assignee || "Unassigned"} · due ${formatDate(due)}. Status Suggested. Demo action, not saved.` });
                close();
              }}
            >
              Create task
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
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
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Assignee">
              {({ id }) => (
                <Select id={id} value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Due date">
              {({ id }) => <Input id={id} type="date" value={due} onChange={(event) => setDue(event.target.value)} />}
            </Field>
          </div>
        </div>
      </Dialog>
    </>
  );
}
