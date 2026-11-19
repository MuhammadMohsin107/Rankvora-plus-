"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Status } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { DEMO_NOW } from "@/lib/format";
import { statusMeta } from "@/lib/status";
import type { Role } from "@/types/core";
import type { ApprovalState, AssigneeOption, BatchItem, HistoryEvent, HistoryKind, TaskDetailData, TaskStatus, VerificationOutcome } from "@/types/fixes";

import { MODE_LABEL } from "./fixes-shared";
import { LifecycleTracker } from "./lifecycle-tracker";
import { TaskApprovalTab } from "./task-approval";
import { TaskDraftTab } from "./task-draft";
import { TaskExecutionTab } from "./task-execution";
import { TaskHistoryTab } from "./task-history";
import { TaskOverviewTab } from "./task-overview";
import { TaskVerificationTab } from "./task-verification";

type TabId = "overview" | "draft" | "approval" | "execution" | "verification" | "history";

type Props = { storeId: string; detail: TaskDetailData; role: Role; actorName: string; assignees: AssigneeOption[] };

/** Task detail: lifecycle (four separate states) and tabs. All changes are local demo state. */
export function TaskWorkspace({ storeId, detail, role, actorName, assignees }: Props) {
  const toast = useToast();
  const { task, draft, approval, execution, verification } = detail;
  const base = `/stores/${storeId}/fixes`;

  const originalText = draft.kind === "text" || draft.kind === "patch" ? draft.after : "";
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assignee, setAssignee] = useState<string | null>(task.assignee);
  const [approvalState, setApprovalState] = useState<ApprovalState>(approval.state);
  const [decision, setDecision] = useState<{ by?: string; at?: string; note?: string }>({ by: approval.decidedBy, at: approval.decidedAt, note: approval.note });
  const [text, setText] = useState(originalText);
  const [claims, setClaims] = useState(draft.kind === "text" ? draft.unsupportedClaims : []);
  const [gen, setGen] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [batch, setBatch] = useState<Record<string, BatchItem["result"]>>({});
  const [remoteResolved, setRemoteResolved] = useState(false);
  const [outcome, setOutcome] = useState<VerificationOutcome | null>(verification.outcome);
  const [verifying, setVerifying] = useState(false);
  const [events, setEvents] = useState<HistoryEvent[]>(detail.history);
  const [viewRole, setViewRole] = useState<Role>(role);
  const [jump, setJump] = useState<{ tab: TabId; n: number }>({ tab: "overview", n: 0 });
  const [markApplied, setMarkApplied] = useState(false);

  const goTo = (tab: TabId) => setJump((current) => ({ tab, n: current.n + 1 }));
  const pushEvent = (kind: HistoryKind, title: string, detailText?: string) =>
    setEvents((current) => [...current, { id: `local-${current.length + 1}`, at: DEMO_NOW, actor: actorName, kind, title, detail: detailText }]);
  const label = (s: TaskStatus) => statusMeta("task", s).label;

  const generatedText = draft.kind === "text" && gen % 2 === 1 ? draft.alternate.after : originalText;
  const dirty = text !== generatedText;
  const diffChanged = approvalState === "approved" && text !== originalText;

  const remote = execution.remote && remoteResolved ? { ...execution.remote, changed: false, versionAtDraft: execution.remote.versionNow, hashAtDraft: execution.remote.hashNow } : execution.remote;

  const generate = () => {
    setGenerating(true);
    setTimeout(() => {
      const next = gen + 1;
      setGen(next);
      setGenerating(false);
      if (draft.kind === "text") {
        const useAlt = next % 2 === 1;
        setText(useAlt ? draft.alternate.after : draft.after);
        const flagged = useAlt ? draft.alternate.unsupportedClaims : draft.unsupportedClaims;
        setClaims(flagged);
        pushEvent("draft", `Draft v${draft.version + next} generated`, `${flagged.length} unsupported ${flagged.length === 1 ? "claim" : "claims"} flagged`);
        toast.push({ title: `Draft v${draft.version + next} generated`, description: `${flagged.length} unsupported ${flagged.length === 1 ? "claim" : "claims"} flagged. Simulated, not a real model call.`, tone: flagged.length ? "warning" : "success" });
      } else {
        setText(originalText);
        pushEvent("draft", `Patch regenerated (v${(draft.kind === "patch" ? draft.version : 1) + next})`, "Output matches the previous patch");
        toast.push({ title: "Patch regenerated", description: "Output matches the previous patch. Simulated.", tone: "info" });
      }
    }, 1100);
  };

  const runVerification = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      const result = verification.simulated;
      if (!result) {
        toast.push({ title: "Verification queued", description: "No demo result available for this task.", tone: "info" });
        return;
      }
      setOutcome(result);
      setStatus(result.result);
      const passed = result.checks.filter((c) => c.after.status === "pass").length;
      pushEvent("verification", `${label(result.result)}`, `${passed} of ${result.checks.length} checks passed`);
      toast.push({ title: label(result.result), description: `${passed} of ${result.checks.length} checks passed. Demo result, not saved.`, tone: result.result === "verified_success" ? "success" : "warning" });
    }, 1500);
  };

  let primary: React.ReactNode = null;
  switch (status) {
    case "suggested":
      primary = assignee ? (
        <Button
          variant="primary"
          icon="play"
          onClick={() => {
            setStatus("in_progress");
            pushEvent("status", "Work started");
            toast.push({ title: "Work started", description: "Demo action, not saved." });
          }}
        >
          Start work
        </Button>
      ) : (
        <Button variant="primary" icon="user" onClick={() => goTo("overview")}>
          Assign in overview
        </Button>
      );
      break;
    case "pending_approval":
      primary = <Button variant="primary" icon="check" onClick={() => goTo("approval")}>Review approval</Button>;
      break;
    case "approved":
    case "queued":
    case "staged":
      primary = <Button variant="primary" icon="bolt" onClick={() => goTo("execution")}>Open execution</Button>;
      break;
    case "in_progress":
      primary = <Button variant="primary" icon="file-text" onClick={() => goTo("draft")}>Open draft</Button>;
      break;
    case "draft_ready":
      primary =
        task.mode === "ai_draft" ? (
          <Button variant="primary" icon="check" onClick={() => setMarkApplied(true)}>Mark applied</Button>
        ) : task.mode === "approved_apply" && approvalState === "not_requested" ? (
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
            setStatus("verification_pending");
            pushEvent("status", "Queued for verification", "Applied is not verified");
            toast.push({ title: "Queued for verification", description: "Demo action, not saved." });
            goTo("verification");
          }}
        >
          Queue verification
        </Button>
      );
      break;
    case "verification_pending":
      primary = (
        <Button variant="primary" icon="shield-check" loading={verifying} onClick={() => { goTo("verification"); runVerification(); }}>
          Run verification
        </Button>
      );
      break;
    default:
      primary = null;
  }

  return (
    <>
      <PageHeader
        title={task.title}
        breadcrumb={[{ label: "Fixes", href: base }, { label: "Tasks", href: `${base}/tasks` }, { label: task.id }]}
        subtitle={`${task.id} · ${MODE_LABEL[task.mode]}`}
        meta={
          <>
            <Status kind="task" value={status} />
            <Status kind="priority" value={task.priority} />
          </>
        }
        actions={primary}
      />

      <div className="flex flex-col gap-5">
        <LifecycleTracker status={status} mode={task.mode} execution={execution} />

        <Tabs
          key={`${jump.tab}-${jump.n}`}
          label="Task sections"
          defaultId={jump.tab}
          tabs={[
            {
              id: "overview",
              label: "Overview",
              content: (
                <TaskOverviewTab
                  storeId={storeId}
                  detail={detail}
                  status={status}
                  assignee={assignee}
                  assignees={assignees}
                  onAssign={(name) => {
                    setAssignee(name);
                    pushEvent("status", `Assigned to ${name}`);
                    toast.push({ title: `Assigned to ${name}`, description: "Demo action, not saved." });
                  }}
                />
              ),
            },
            {
              id: "draft",
              label: "Draft",
              content: (
                <TaskDraftTab
                  draft={draft}
                  status={status}
                  text={text}
                  onText={setText}
                  claims={claims}
                  generating={generating}
                  version={draft.kind === "guidance" ? 1 : draft.version + gen}
                  onGenerate={generate}
                  onReset={() => {
                    setText(generatedText);
                    toast.push({ title: "Edits discarded", tone: "info" });
                  }}
                  dirty={dirty}
                  needsReapproval={diffChanged}
                  batch={batch}
                  onBatch={(id, result, message) => {
                    setBatch((current) => ({ ...current, [id]: result }));
                    pushEvent("draft", message);
                    toast.push({ title: message, description: "Demo action, not saved.", tone: "info" });
                  }}
                />
              ),
            },
            {
              id: "approval",
              label: "Approval",
              content: (
                <TaskApprovalTab
                  approval={approval}
                  state={approvalState}
                  decidedBy={decision.by}
                  decidedAt={decision.at}
                  mode={task.mode}
                  status={status}
                  actualRole={role}
                  viewRole={viewRole}
                  onViewRole={setViewRole}
                  diffChanged={diffChanged}
                  onRequest={() => {
                    setApprovalState("pending");
                    setStatus("pending_approval");
                    pushEvent("approval", "Approval requested", "Owner or admin must approve the exact diff");
                    toast.push({ title: "Approval requested", description: "Owner or admin must approve the exact diff. Demo action, not saved." });
                  }}
                  onApprove={() => {
                    setApprovalState("approved");
                    setDecision({ by: actorName, at: DEMO_NOW, note: "Only this exact diff can be written." });
                    if (status === "pending_approval") setStatus("approved");
                    pushEvent("approval", "Approved exact diff");
                    toast.push({ title: "Diff approved", description: "Status Approved. Nothing is written yet. Demo action, not saved." });
                  }}
                  onReject={(reason) => {
                    setApprovalState("rejected");
                    setDecision({ by: actorName, at: DEMO_NOW, note: reason });
                    setStatus("in_progress");
                    pushEvent("approval", "Approval rejected", reason);
                    toast.push({ title: "Approval rejected", description: "The task is back in progress. Demo action, not saved.", tone: "info" });
                  }}
                />
              ),
            },
            {
              id: "execution",
              label: "Execution",
              content: (
                <TaskExecutionTab
                  execution={execution}
                  remote={remote}
                  draft={draft}
                  text={text}
                  status={status}
                  mode={task.mode}
                  approvalState={approvalState}
                  diffHash={approval.diffHash}
                  viewRole={viewRole}
                  batch={batch}
                  onWrite={(target, actionLabel) => {
                    setStatus(target);
                    pushEvent("execution", actionLabel, "Remote check passed");
                    toast.push({ title: `${actionLabel}: ${label(target)}`, description: "Not verified yet. Demo action, nothing was written.", tone: "info" });
                  }}
                  onRollback={(reason) => {
                    setStatus("rolled_back");
                    pushEvent("rollback", "Rolled back", reason);
                    toast.push({ title: "Rolled back", description: "Demo action, nothing was written.", tone: "info" });
                  }}
                  onRedraft={() => {
                    setRemoteResolved(true);
                    setBatch((current) => ({ ...current, ...Object.fromEntries((draft.kind === "batch" ? draft.items : []).filter((i) => i.result === "conflict").map((i) => [i.id, "ready" as const])) }));
                    pushEvent("draft", "Redrafted from the current remote copy");
                    toast.push({ title: "Redrafted from current copy", description: "The hold is cleared. Approval still covers staging. Demo action.", tone: "success" });
                  }}
                />
              ),
            },
            {
              id: "verification",
              label: "Verification",
              content: <TaskVerificationTab storeId={storeId} record={verification} outcome={outcome} status={status} verifying={verifying} onRun={runVerification} />,
            },
            { id: "history", label: "History", count: events.length, content: <TaskHistoryTab events={events} /> },
          ]}
        />
      </div>

      <ConfirmDialog
        open={markApplied}
        onClose={() => setMarkApplied(false)}
        tone="primary"
        title="Mark as applied"
        confirmLabel="Mark applied"
        onConfirm={() => {
          setMarkApplied(false);
          setStatus("applied");
          pushEvent("execution", "Marked applied", "Applied outside Rankvora Plus");
          toast.push({ title: "Marked applied", description: "Applied is not verified. Queue verification next. Demo action, not saved.", tone: "info" });
        }}
      >
        <p>This records that a person applied the draft outside Rankvora Plus. Nothing is written by us. It stays unverified until checks pass.</p>
      </ConfirmDialog>
    </>
  );
}
