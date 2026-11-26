/** The effective view of a task: seeded detail with the local changes from its row laid over it. Pure. */
import type {
  ApprovalState,
  BatchItem,
  ExecutionRecord,
  RemoteCheck,
  TaskDetailData,
  TaskRow,
  TaskStatus,
  UnsupportedClaim,
  VerificationOutcome,
} from "@/types/fixes";

export type TaskView = {
  status: TaskStatus;
  assignee: string | null;
  approvalState: ApprovalState;
  decision: { by?: string; at?: string; note?: string };
  requestedAt?: string;
  /** Saved draft text (text and patch drafts), else the seeded text. */
  text: string;
  /** The text as it was when approved, if it was approved here. */
  approvedText?: string;
  claims: UnsupportedClaim[];
  version: number;
  batch: Record<string, BatchItem["result"]>;
  remote: RemoteCheck | null;
  execution: ExecutionRecord;
  outcome: VerificationOutcome | null;
  rejection?: TaskDetailData["rejection"];
  cancellation?: TaskDetailData["cancellation"];
  supersession?: TaskDetailData["supersession"];
};

export function buildTaskView(detail: TaskDetailData, row: Partial<TaskRow> | undefined): TaskView {
  const { draft, execution, approval } = detail;
  const r = row ?? {};
  const seededText = draft.kind === "text" || draft.kind === "patch" ? draft.after : "";
  const mode = detail.task.mode;

  const remote: RemoteCheck | null = execution.remote
    ? {
        ...execution.remote,
        ...(r.remoteResolved ? { changed: false, versionAtDraft: execution.remote.versionNow, hashAtDraft: execution.remote.hashNow } : {}),
        ...(r.remoteCheckedAt ? { checkedAt: r.remoteCheckedAt } : {}),
      }
    : null;

  const wrote = Boolean(r.appliedAt) && (mode === "cms_staged" || mode === "approved_apply");
  const merged: ExecutionRecord = {
    ...execution,
    remote,
    completedAt: r.completedAt ?? execution.completedAt,
    stagedAt: r.stagedAt ?? execution.stagedAt,
    appliedAt: r.appliedAt ?? execution.appliedAt,
    publishedAt: r.publishedAt ?? execution.publishedAt,
    failure: r.failure === undefined ? execution.failure : (r.failure ?? undefined),
    rollback: {
      ...execution.rollback,
      available: execution.rollback.available || wrote,
      record: r.rollbackRecord ?? execution.rollback.record,
    },
  };

  return {
    status: r.status ?? detail.task.status,
    assignee: r.assignee === undefined ? detail.task.assignee : r.assignee,
    approvalState: r.approvalState ?? approval.state,
    decision: r.decision ?? { by: approval.decidedBy, at: approval.decidedAt, note: approval.note },
    requestedAt: r.requestedAt ?? approval.requestedAt,
    text: r.draftText ?? seededText,
    approvedText: r.approvedText,
    claims: r.draftClaims ?? (draft.kind === "text" ? draft.unsupportedClaims : []),
    version: r.draftVersion ?? (draft.kind === "guidance" ? 1 : draft.version),
    batch: r.batch ?? {},
    remote,
    execution: merged,
    outcome: r.outcome === undefined ? detail.verification.outcome : r.outcome,
    rejection: r.rejection ?? detail.rejection,
    cancellation: r.cancellation ?? detail.cancellation,
    supersession: r.supersession ?? detail.supersession,
  };
}
