"use client";

import { useMemo, useState } from "react";

import { HeaderAction } from "@/components/shell/page-chrome";
import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useDemoEvents } from "@/demo-state";
import { EvidenceTrace } from "@/features/evidence/evidence-trace";
import type { Role } from "@/types/core";
import type { TaskDetailData, TaskSummary } from "@/types/fixes";

import { ReasonDialog, REASONS, SupersedeDialog } from "./fix-dialogs";
import { allowedMoves, isTaskOpen } from "./fixes-logic";
import { LifecycleTracker } from "./lifecycle-tracker";
import { TaskApprovalTab } from "./task-approval";
import { TaskDraftTab } from "./task-draft";
import { TaskExecutionTab } from "./task-execution";
import { TaskHistoryTab } from "./task-history";
import { TaskOverviewTab } from "./task-overview";
import { TaskVerificationTab } from "./task-verification";
import { useTaskModel, type FixLinks } from "./use-task-model";

type TabId = "overview" | "draft" | "approval" | "execution" | "verification" | "history";
type Dialogs = "cancel" | "reject" | "supersede" | "applied" | null;

type Props = { storeId: string; detail: TaskDetailData; tasks: TaskSummary[]; role: Role; actorName: string; links: FixLinks };

/** Task detail: lifecycle (four separate states) and tabs. Every change is saved locally and emits an event. */
export function TaskWorkspace({ storeId, detail, tasks, role, actorName, links }: Props) {
  const m = useTaskModel({ storeId, detail, tasks, actorName, links });
  const { view, act } = m;
  const { task, draft, verification } = detail;
  const status = view.status;

  const [jump, setJump] = useState<{ tab: TabId; n: number }>({ tab: "overview", n: 0 });
  const [dialog, setDialog] = useState<Dialogs>(null);
  const goTo = (tab: TabId) => setJump((current) => ({ tab, n: current.n + 1 }));

  const annotations = useDemoEvents({ taskId: task.id, kinds: ["comparison.annotated"] });
  const annotated = useMemo(() => annotations.map((e) => e.refs.comparisonId).filter((id): id is string => Boolean(id)), [annotations]);

  const verificationId = view.outcome?.sourceHref?.split("/").pop();
  const traceIds = useMemo(
    () => ({
      storeId,
      findingId: task.findingId,
      taskId: task.id,
      verificationId: verificationId?.startsWith("aud-") || verificationId?.startsWith("run-") ? verificationId : undefined,
      observationId: view.outcome ? (links.latestRunId ?? undefined) : undefined,
    }),
    [storeId, task.findingId, task.id, verificationId, view.outcome, links.latestRunId],
  );

  const moves = allowedMoves(status, task.mode);
  const supersedeCandidates = m.fix.tasks.filter((t) => t.findingId === task.findingId && t.id !== task.id && isTaskOpen(t.status));

  let primary: React.ReactNode = null;
  switch (status) {
    case "suggested":
      primary = <Button variant="primary" icon="play" onClick={act.startWork}>Start work</Button>;
      break;
    case "pending_approval":
      primary = <Button variant="primary" icon="check" onClick={() => goTo("approval")}>Review approval</Button>;
      break;
    case "approved":
    case "queued":
    case "staged":
      primary = <Button variant="primary" icon="bolt" onClick={() => goTo("execution")}>Open execution</Button>;
      break;
    case "blocked":
      primary = <Button variant="primary" icon="play" onClick={act.startWork}>Resume work</Button>;
      break;
    case "in_progress":
      primary =
        task.mode === "guidance" ? (
          <Button variant="primary" icon="check" onClick={() => setDialog("applied")}>Mark applied</Button>
        ) : (
          <Button variant="primary" icon="file-text" onClick={() => goTo("draft")}>Open draft</Button>
        );
      break;
    case "draft_ready":
      primary =
        task.mode === "ai_draft" ? (
          <Button variant="primary" icon="check" onClick={() => setDialog("applied")}>Mark applied</Button>
        ) : m.needsApproval && (view.approvalState === "not_requested" || view.approvalState === "rejected") ? (
          <Button variant="primary" icon="clock" onClick={() => goTo("approval")}>Request approval</Button>
        ) : (
          <Button variant="primary" icon="bolt" onClick={() => goTo("execution")}>Open execution</Button>
        );
      break;
    case "applied":
    case "published":
      primary = (
        <Button
          variant="primary"
          icon="shield-check"
          onClick={() => {
            act.queueVerification();
            goTo("verification");
          }}
        >
          Queue verification
        </Button>
      );
      break;
    case "verification_pending":
      primary = (
        <Button
          variant="primary"
          icon="shield-check"
          loading={m.verifying}
          onClick={() => {
            goTo("verification");
            act.runVerification();
          }}
        >
          Run verification
        </Button>
      );
      break;
    case "failed":
      primary = view.execution.failure ? <Button variant="primary" icon="alert-triangle" onClick={() => goTo("execution")}>Review failure</Button> : null;
      break;
    case "partially_verified":
    case "rolled_back":
      primary = <Button variant="primary" icon="play" onClick={act.startWork}>Reopen work</Button>;
      break;
    case "rejected":
    case "cancelled":
      primary = <Button variant="primary" icon="refresh" onClick={act.reopen}>Reopen</Button>;
      break;
    default:
      primary = null;
  }

  const more: MenuItem[] = [
    ...(moves.includes("rolled_back") ? [{ label: "Roll back", icon: "undo" as const, onSelect: () => goTo("execution") }] : []),
    ...(moves.includes("rejected") ? [{ label: "Reject", icon: "minus-circle" as const, onSelect: () => setDialog("reject") }] : []),
    ...(moves.includes("superseded") ? [{ label: "Replace with another task", icon: "layers" as const, onSelect: () => setDialog("supersede") }] : []),
    ...(moves.includes("cancelled") ? [{ type: "separator" as const }, { label: "Cancel task", icon: "x-circle" as const, tone: "danger" as const, onSelect: () => setDialog("cancel") }] : []),
  ];

  return (
    <>
      <PageHeader
        title={task.title}
        meta={
          <>
            <Status kind="task" value={status} />
            <Status kind="priority" value={task.priority} />
          </>
        }
        actions={<Menu trigger={<IconButton icon="more" label="More actions" variant="secondary" />} items={more} />}
      />
      <HeaderAction>{primary}</HeaderAction>

      <div className="flex min-w-0 flex-col gap-4">
        <LifecycleTracker status={status} mode={task.mode} execution={view.execution} />
        <EvidenceTrace ids={traceIds} label="Evidence trace for this task" />

        <Tabs
          key={`${jump.tab}-${jump.n}`}
          label="Task sections"
          defaultId={jump.tab}
          tabs={[
            { id: "overview", label: "Overview", content: <TaskOverviewTab storeId={storeId} detail={detail} view={view} /> },
            {
              id: "draft",
              label: "Draft",
              content: (
                <TaskDraftTab
                  draft={draft}
                  status={status}
                  text={m.text}
                  onText={act.setText}
                  claims={view.claims}
                  generating={m.generating}
                  version={view.version}
                  onGenerate={act.regenerate}
                  onReset={act.resetDraft}
                  onSave={act.saveDraft}
                  dirty={m.dirty}
                  needsReapproval={m.diffChanged}
                  batch={view.batch}
                  onBatch={act.batchSet}
                />
              ),
            },
            {
              id: "approval",
              label: "Approval",
              content: (
                <TaskApprovalTab
                  approval={detail.approval}
                  state={view.approvalState}
                  decidedBy={view.decision.by}
                  decidedAt={view.decision.at}
                  decidedNote={view.decision.note}
                  mode={task.mode}
                  status={status}
                  role={role}
                  diffChanged={m.diffChanged}
                  onRequest={act.requestApproval}
                  onApprove={act.approve}
                  onReject={act.rejectApproval}
                />
              ),
            },
            {
              id: "execution",
              label: "Execution",
              content: (
                <TaskExecutionTab
                  storeId={storeId}
                  execution={view.execution}
                  remote={view.remote}
                  draft={draft}
                  text={m.text}
                  status={status}
                  mode={task.mode}
                  approvalState={view.approvalState}
                  diffHash={detail.approval.diffHash}
                  role={role}
                  batch={view.batch}
                  onWrite={act.write}
                  onRollback={act.rollback}
                  onRedraft={act.redraft}
                  onRecheck={act.recheckRemote}
                />
              ),
            },
            {
              id: "verification",
              label: "Verification",
              content: (
                <TaskVerificationTab
                  storeId={storeId}
                  record={verification}
                  outcome={view.outcome}
                  status={status}
                  verifying={m.verifying}
                  simulated={m.simulated}
                  onSimulated={m.setSimulated}
                  onRun={act.runVerification}
                  latestRunId={links.latestRunId}
                  comparisons={links.comparisons}
                  annotated={annotated}
                  onAnnotate={act.annotate}
                />
              ),
            },
            { id: "history", label: "History", count: m.history.length, content: <TaskHistoryTab events={m.history} /> },
          ]}
        />
      </div>

      <ConfirmDialog
        open={dialog === "applied"}
        onClose={() => setDialog(null)}
        tone="primary"
        title="Mark as applied"
        confirmLabel="Mark applied"
        onConfirm={() => {
          setDialog(null);
          act.markApplied();
        }}
      >
        <p>This records that a person applied the change outside Rankvora AI. Nothing is written by us. It stays unverified until checks pass.</p>
      </ConfirmDialog>
      <ReasonDialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title="Cancel task"
        description="Stops the task. Work already done is kept in history."
        confirmLabel="Cancel task"
        reasons={REASONS.cancel}
        onConfirm={(reason) => {
          setDialog(null);
          act.cancel(reason);
        }}
      />
      <ReasonDialog
        open={dialog === "reject"}
        onClose={() => setDialog(null)}
        title="Reject task"
        confirmLabel="Reject"
        reasons={REASONS.reject}
        onConfirm={(reason) => {
          setDialog(null);
          act.reject(reason);
        }}
      />
      <SupersedeDialog
        open={dialog === "supersede"}
        onClose={() => setDialog(null)}
        candidates={supersedeCandidates}
        onConfirm={(successorId, reason) => {
          setDialog(null);
          act.supersede(successorId, reason);
        }}
      />
    </>
  );
}
