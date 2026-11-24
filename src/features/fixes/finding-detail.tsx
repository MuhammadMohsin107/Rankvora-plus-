"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Badge, Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Callout, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { Icon, type IconName } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { Timeline } from "@/components/ui/misc";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useDemoEvents, useDemoSettings } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import { ResponseButton } from "@/features/responses/response-inspector";
import { formatDate, formatDateTime } from "@/lib/format";
import { SEARCH_MODE_LABEL } from "@/lib/labels";
import type { Role } from "@/types/core";
import type { FindingDetailData, FindingRow, RecommendationStatus, ResolvedEvidence, TaskSummary } from "@/types/fixes";

import { REASONS, ReasonDialog } from "./fix-dialogs";
import { canCreateTask, isTaskOpen } from "./fixes-logic";
import { canApprove, CATEGORY_LABEL } from "./fixes-shared";
import { splitLabel } from "./history";
import { RecommendationCard, type RecLocal } from "./recommendation-card";
import { useFindingActions } from "./use-finding-actions";
import { useFixData } from "./use-fix-data";

const LANE_LABEL = { ai_visibility: "AI visibility lane", website_readiness: "Website readiness lane" } as const;
const evidenceIcon: Record<ResolvedEvidence["kind"], IconName> = { response: "prompts", page: "globe", prompt: "search" };

/** The severity / priority value is already in the header; drop the leading "High:" / "P1:" label from the rationale. */
const rationaleText = (text: string) => text.replace(/^(Critical|High|Medium|Low|Informational|P[0-3]):\s*/, "");

function evidenceLabel(e: ResolvedEvidence): string {
  if (e.kind === "response") return `${e.response.providerLabel} · sample ${e.response.sample}`;
  if (e.kind === "page") return e.url.replace("https://", "");
  return `Prompt ${e.promptId}`;
}

/** Local decision on one recommendation. Stored under one demo-state setting per website. */
type RecDecision = { status?: RecommendationStatus; action?: string; decisionNote?: string; decidedBy?: string; edited?: boolean };
type RecState = Record<string, RecDecision>;
const NO_DECISIONS: RecState = {};

const METRIC_FOR_CATEGORY: Partial<Record<string, string>> = { ai_visibility: "mention-rate", technical: "technical-pass-rate", content: "content-pass-rate" };

type Props = { storeId: string; data: FindingDetailData; row: FindingRow; tasks: TaskSummary[]; role: Role; actorName: string };
type Dialogs = { type: "approve" | "edit" | "reject"; recId: string } | null;

/** Finding detail: review, recommendations (approve, edit, reject), evidence, history. Everything is saved locally. */
export function FindingDetail({ storeId, data, row, tasks, role, actorName }: Props) {
  const { finding, extras, evidence, prompts, recommendations } = data;
  const base = `/stores/${storeId}`;
  const approver = canApprove(role);

  const fix = useFixData(storeId, tasks, [row], actorName);
  const actions = useFindingActions(fix);
  const current = fix.findings.find((f) => f.id === finding.id) ?? row;
  const status = current.status;
  const decisions = useDemoSettings<RecState>(`fixes.${storeId}.recommendations`, NO_DECISIONS);
  const events = useDemoEvents({ findingId: finding.id });

  const [dialog, setDialog] = useState<Dialogs>(null);
  const [tab, setTab] = useState("recommendations");
  // Evidence chips on a recommendation live in another tab: open it, then bring the item into view.
  const openEvidence = (evidenceId: string) => {
    setTab("evidence");
    window.setTimeout(() => {
      const target = document.getElementById(`ev-${evidenceId}`);
      if (!target) return;
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    }, 60);
  };
  const [editText, setEditText] = useState("");
  const active = dialog ? recommendations.find((r) => r.id === dialog.recId) : undefined;

  const localOf = (recId: string): RecLocal => {
    const rec = recommendations.find((r) => r.id === recId);
    const d = decisions.value[recId] ?? {};
    const linked = rec?.taskId ?? fix.tasks.find((t) => t.seed?.recommendationId === recId && isTaskOpen(t.status))?.id ?? null;
    return {
      status: d.status ?? rec?.status ?? "proposed",
      action: d.action ?? rec?.action ?? "",
      decisionNote: d.decisionNote ?? rec?.decisionNote,
      decidedBy: d.decidedBy ?? rec?.decidedBy,
      edited: d.edited ?? false,
      taskId: linked,
    };
  };
  const decide = (recId: string, next: RecDecision, label: string, detail?: string) => {
    decisions.patch({ [recId]: { ...decisions.value[recId], ...next } }, { kind: "finding.updated", label: detail ? `${label} · ${detail}` : label, refs: { findingId: finding.id, websiteId: storeId } });
  };

  const findingRow: FindingRow = { ...current, tasks: fix.tasks.filter((t) => t.findingId === finding.id).map((t) => ({ id: t.id, title: t.title, status: t.status })), context: { expected: finding.expected, actual: finding.actual, affectedUrls: finding.affectedUrls, verificationCriteria: extras.verificationCriteria, recommendation: recommendations.find((r) => localOf(r.id).status !== "rejected") ?? null } };
  const linkedTasks = findingRow.tasks;
  const openTask = linkedTasks.some((t) => isTaskOpen(t.status));

  const evidenceLabels = Object.fromEntries(evidence.map((e) => [e.id, evidenceLabel(e)]));
  const firstResponse = evidence.find((e) => e.kind === "response");

  const traceIds = useMemo(
    () => ({
      storeId,
      metricId: METRIC_FOR_CATEGORY[finding.category],
      sourceId: finding.auditId,
      promptId: prompts[0]?.id,
      responseId: firstResponse?.kind === "response" ? firstResponse.response.id : undefined,
      findingId: finding.id,
      taskId: data.tasks[0]?.id,
    }),
    [storeId, finding.category, finding.auditId, finding.id, prompts, firstResponse, data.tasks],
  );

  const firstOpen = recommendations.find((r) => localOf(r.id).status === "approved" && !localOf(r.id).taskId) ?? recommendations.find((r) => localOf(r.id).status !== "rejected") ?? null;
  const reviewItems = actions.menuItems(findingRow);

  let primary: React.ReactNode = null;
  if (status === "new" || status === "under_review") primary = <Button variant="primary" icon="check" onClick={() => fix.reviewFinding(finding.id, "confirm")}>Confirm</Button>;
  else if (canCreateTask(status) && !openTask) primary = <Button variant="primary" icon="plus" onClick={() => actions.openCreate(findingRow, firstOpen)}>Create task</Button>;

  const history = [
    ...extras.observations.map((o, index) => ({
      id: o.id,
      at: o.at,
      icon: (index === 0 ? "circle-dot" : "eye") as IconName,
      title: (
        <span>
          {index === 0 ? "First detected" : "Observed again"}
          {o.provisional ? <Badge tone="warning" className="ml-1.5">Provisional</Badge> : null}
        </span>
      ),
      meta: (
        <>
          {o.sourceHref ? <Link href={`${base}/${o.sourceHref}`} className="text-accent-text hover:underline">{o.source}</Link> : o.source}
          {o.note ? <span> · {o.note}</span> : null}
        </>
      ),
    })),
    ...events.map((e) => {
      const { title, detail } = splitLabel(e.label);
      return { id: e.id, at: e.at, icon: "circle" as IconName, title: <span>{title}</span>, meta: <>{actorName}{detail ? <span> · {detail}</span> : null}</> };
    }),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <>
      <PageHeader
        title={finding.title}
        subtitle={`${CATEGORY_LABEL[finding.category]} · ${LANE_LABEL[finding.lane]}`}
        meta={
          <>
            <Status kind="finding" value={status} />
            <Status kind="severity" value={finding.severity} />
          </>
        }
        actions={<Menu trigger={<IconButton icon="more" label="Finding actions" variant="secondary" />} items={reviewItems} />}
      />
      <HeaderAction>{primary}</HeaderAction>

      <div className="flex min-w-0 flex-col gap-3">
        <Card>
          <CardBody className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
              <div className="rounded-control border border-line bg-surface-2 p-3">
                <h3 className="flex items-center gap-1.5 text-helper font-medium text-success-text">
                  <Icon name="check-circle" size={14} className="text-success-icon" />
                  Expected
                </h3>
                <p className="mt-1 text-body-sm text-fg">{finding.expected}</p>
              </div>
              <div className="rounded-control border border-line bg-surface-2 p-3">
                <h3 className="flex items-center gap-1.5 text-helper font-medium text-warning-text">
                  <Icon name="alert-circle" size={14} className="text-warning-icon" />
                  Observed
                </h3>
                <p className="mt-1 text-body-sm text-fg">{finding.actual}</p>
              </div>
            </div>
            {linkedTasks.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Linked tasks">
                {linkedTasks.map((t) => (
                  <li key={t.id}>
                    <Link href={`${base}/fixes/tasks/${t.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-label hover:bg-surface-2">
                      <span className="tnum font-medium text-accent-text">{t.id}</span>
                      <Status kind="task" value={t.status} compact />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <EvidenceTrace ids={traceIds} label="Evidence trace for this finding" />
          </CardBody>
        </Card>

        {current.review ? (
          <Callout tone="neutral" title={current.review.kind === "false_positive" ? "Marked false positive" : "Risk accepted"}>
            {current.review.reason}
            {current.review.expiresAt ? ` Review again on ${formatDate(current.review.expiresAt)}.` : ""}
          </Callout>
        ) : null}
        {extras.duplicate ? (
          <Callout tone="neutral" title="Possible duplicate">
            <Link href={`${base}/fixes/findings/${extras.duplicate.ofId}`} className="text-accent-text hover:underline">{extras.duplicate.ofId}</Link> · {extras.duplicate.reason}
          </Callout>
        ) : null}

        <Tabs
          label="Finding sections"
          value={tab}
          onValueChange={setTab}
          tabs={[
            {
              id: "recommendations",
              label: "Recommendations",
              count: recommendations.length,
              content: (
                <section id="recommendations" aria-label="Recommendations" className="flex scroll-mt-24 flex-col gap-3">
                  {!approver ? <Badge tone="neutral" icon="lock" title="Only an owner or admin can approve.">View only</Badge> : null}
                  {recommendations.length === 0 ? (
                    <EmptyState icon="sparkles" title="No recommendations" description={status === "false_positive" ? "Closed as a false positive." : undefined} />
                  ) : (
                    recommendations.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        storeId={storeId}
                        rec={rec}
                        local={localOf(rec.id)}
                        confidence={finding.confidence}
                        evidenceLabels={evidenceLabels}
                        canApprove={approver}
                        onApprove={() => setDialog({ type: "approve", recId: rec.id })}
                        onEdit={() => {
                          setEditText(localOf(rec.id).action);
                          setDialog({ type: "edit", recId: rec.id });
                        }}
                        onReject={() => setDialog({ type: "reject", recId: rec.id })}
                        onReopen={() => {
                          decide(rec.id, { status: "proposed", decisionNote: undefined }, "Recommendation reopened", rec.id);
                          fix.notify("Recommendation reopened", "Back to Proposed.", "info");
                        }}
                        onCreateTask={() => actions.openCreate(findingRow, rec)}
                        onOpenEvidence={openEvidence}
                      />
                    ))
                  )}
                </section>
              ),
            },
            {
              id: "evidence",
              label: "Evidence",
              count: evidence.length,
              content: (
                <div className="flex flex-col gap-3">
                  <Card>
                    <CardHeader title="Evidence" info="Raw responses are read-only. Failed requests are never counted as the brand being absent." />
                    <CardBody className="pt-2">
                      {evidence.length === 0 ? (
                        <p className="text-body-sm text-fg-subtle">No evidence recorded.</p>
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
                                    <p className="mt-0.5 text-helper text-fg-subtle">
                                      {e.response.providerLabel} API · {e.response.model} · {SEARCH_MODE_LABEL[e.response.searchMode]} · sample {e.response.sample}
                                    </p>
                                  </>
                                ) : e.kind === "page" ? (
                                  <>
                                    <a href={e.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-body-sm font-medium text-accent-text hover:underline">
                                      <span className="truncate">{e.url.replace("https://", "")}</span>
                                      <Icon name="external" size={12} className="shrink-0" />
                                    </a>
                                    <p className="mt-0.5 text-helper text-fg-subtle">
                                      <Link href={`${base}/audits/${e.auditId}/website?page=${encodeURIComponent(e.url)}`} className="hover:underline">{e.auditId}</Link> crawl
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <Link href={`${base}/prompts/${e.promptId}`} className="text-body-sm font-medium text-accent-text hover:underline">
                                      {e.text}
                                    </Link>
                                    <p className="mt-0.5 text-helper text-fg-subtle">Prompt {e.promptId}</p>
                                  </>
                                )}
                                <p className="mt-0.5 text-helper text-fg-muted">{e.note}</p>
                              </div>
                              <Badge tone="neutral">{e.id.toUpperCase()}</Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Affected" />
                    <CardBody className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
                      <div className="min-w-0">
                        <h3 className="mb-1.5 text-helper font-medium text-fg-subtle">URLs</h3>
                        {finding.affectedUrls.length === 0 ? (
                          <p className="text-body-sm text-fg-subtle">None. This finding comes from AI responses.</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {finding.affectedUrls.map((url) => (
                              <li key={url}>
                                <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 text-body-sm text-accent-text hover:underline">
                                  <span className="truncate">{url.replace("https://", "")}</span>
                                  <Icon name="external" size={12} className="shrink-0" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="mb-1.5 text-helper font-medium text-fg-subtle">Prompts</h3>
                        {prompts.length === 0 ? (
                          <p className="text-body-sm text-fg-subtle">None. This finding comes from a page check.</p>
                        ) : (
                          <ul className="flex flex-col gap-1">
                            {prompts.map((p) => (
                              <li key={p.id}>
                                <Link href={`${base}/prompts/${p.id}`} className="text-body-sm text-accent-text hover:underline">
                                  {p.text}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader title="Why this priority" info="Internal prioritisation aid, not a ranking factor." />
                    <CardBody className="flex flex-col gap-3 pt-2">
                      <p className="text-body-sm text-fg-muted"><span className="font-medium text-fg">Severity.</span> {rationaleText(extras.severityRationale)}</p>
                      <p className="text-body-sm text-fg-muted"><span className="font-medium text-fg">Priority.</span> {rationaleText(extras.priorityRationale)}</p>
                      <div className="border-t border-line pt-3">
                        <h3 className="mb-1.5 text-helper font-medium text-fg-subtle">Verification criteria</h3>
                        <ul className="flex flex-col gap-1.5">
                          {extras.verificationCriteria.map((c) => (
                            <li key={c} className="flex items-start gap-2 text-body-sm text-fg-muted">
                              <Icon name="shield-check" size={15} className="mt-0.5 shrink-0 text-fg-subtle" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              ),
            },
            {
              id: "history",
              label: "History",
              count: history.length,
              content: (
                <Card>
                  <CardBody>
                    <Timeline items={history.map((h) => ({ id: h.id, icon: h.icon, tone: "neutral", time: formatDateTime(h.at), title: h.title, meta: h.meta }))} />
                  </CardBody>
                </Card>
              ),
            },
          ]}
        />
      </div>

      <ConfirmDialog
        open={dialog?.type === "approve"}
        onClose={() => setDialog(null)}
        tone="primary"
        title="Approve recommendation"
        confirmLabel="Approve"
        onConfirm={() => {
          if (!dialog) return;
          decide(dialog.recId, { status: "approved", decidedBy: actorName, decisionNote: undefined }, "Recommendation approved", dialog.recId);
          fix.notify("Recommendation approved", "A task can now be created.");
          setDialog(null);
        }}
      >
        <p>{active?.title}</p>
        <p className="mt-2">Approving makes it eligible for a task. It does not change the site.</p>
      </ConfirmDialog>

      <Dialog
        open={dialog?.type === "edit"}
        onClose={() => setDialog(null)}
        title="Edit proposed action"
        description="Edits to an approved action need approval again."
        size="sm"
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={editText.trim().length < 10}
              onClick={() => {
                if (!dialog) return;
                const wasApproved = localOf(dialog.recId).status === "approved";
                decide(dialog.recId, { action: editText.trim(), edited: true, ...(wasApproved ? { status: "proposed" as const, decisionNote: undefined } : {}) }, "Recommendation edited", dialog.recId);
                fix.notify("Action updated", wasApproved ? "Back to Proposed: it needs approval again." : undefined, wasApproved ? "info" : "success");
                setDialog(null);
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

      <ReasonDialog
        open={dialog?.type === "reject"}
        onClose={() => setDialog(null)}
        title="Reject recommendation"
        description={active?.title}
        confirmLabel="Reject"
        reasons={REASONS.reject}
        onConfirm={(reason) => {
          if (dialog) {
            decide(dialog.recId, { status: "rejected", decisionNote: reason }, "Recommendation rejected", reason);
            fix.notify("Recommendation rejected", reason, "info");
          }
          setDialog(null);
        }}
      />
      {actions.dialogs}
    </>
  );
}
