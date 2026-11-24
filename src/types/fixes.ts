/** Types for the Fixes module (findings inbox, recommendations, tasks). */
import type { Confidence, FindingCategory, FindingStatus, Priority, ResponseSample, Severity } from "@/types/shared-records";

export type TaskStatus =
  | "suggested"
  | "pending_approval"
  | "approved"
  | "queued"
  | "in_progress"
  | "blocked"
  | "draft_ready"
  | "staged"
  | "applied"
  | "published"
  | "verification_pending"
  | "verified_success"
  | "partially_verified"
  | "failed"
  | "rolled_back"
  | "rejected"
  | "cancelled"
  | "superseded";

/** All 18 task statuses in lifecycle order. */
export const TASK_STATUSES: readonly TaskStatus[] = [
  "suggested",
  "pending_approval",
  "approved",
  "queued",
  "in_progress",
  "blocked",
  "draft_ready",
  "staged",
  "applied",
  "published",
  "verification_pending",
  "verified_success",
  "partially_verified",
  "failed",
  "rolled_back",
  "rejected",
  "cancelled",
  "superseded",
];

export type ExecutionMode = "guidance" | "ai_draft" | "cms_staged" | "approved_apply";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type CauseClassification = "confirmed" | "likely" | "hypothesis";
export type Effort = "small" | "medium" | "large";
export type RecommendationStatus = "proposed" | "approved" | "rejected";
export type CheckStatus = "pass" | "fail" | "warning" | "not_applicable" | "not_assessed" | "inconclusive" | "blocked" | "error";

// ---------------------------------------------------------------------------
// Evidence and recommendations
// ---------------------------------------------------------------------------

export type EvidenceSpec =
  | { id: string; kind: "response"; responseId: string; note: string }
  | { id: string; kind: "page"; url: string; note: string; auditId: string }
  | { id: string; kind: "prompt"; promptId: string; note: string };

export type ResolvedEvidence =
  | { id: string; kind: "response"; response: ResponseSample; note: string }
  | { id: string; kind: "page"; url: string; note: string; auditId: string }
  | { id: string; kind: "prompt"; promptId: string; text: string; note: string };

export type Recommendation = {
  id: string;
  findingId: string;
  title: string;
  problem: string;
  /** Ids of the finding's evidence items this recommendation relies on. */
  evidenceIds: string[];
  cause: { classification: CauseClassification; basis: string };
  /** Imperative, scoped to one resource. */
  action: string;
  /** Why it matters. Never a ranking guarantee. */
  why: string;
  expectedOutcome: string;
  effort: Effort;
  risk: RiskLevel;
  suggestedMode: ExecutionMode;
  dependencies: string[];
  limitations: string[];
  verificationPlan: string[];
  status: RecommendationStatus;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  taskId: string | null;
};

export type Observation = { id: string; at: string; source: string; sourceHref?: string; note?: string; provisional?: boolean };

export type FindingExtras = {
  severityRationale: string;
  priorityRationale: string;
  verificationCriteria: string[];
  evidence: EvidenceSpec[];
  observations: Observation[];
  duplicate?: { ofId: string; reason: string };
};

/** Why a finding was closed by a person (false positive or accepted risk). */
export type FindingReview = {
  kind: "false_positive" | "accepted_risk";
  reason: string;
  /** Accepted risk only: ISO date after which the risk is reviewed again. */
  expiresAt?: string;
  by: string;
  at: string;
};

export type FindingRow = {
  id: string;
  /** Website id (route segment). Needed because local overlays are shared across websites. */
  storeId: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  priority: Priority;
  confidence: Confidence;
  status: FindingStatus;
  urlCount: number;
  promptCount: number;
  lastObservedAt: string;
  duplicate: { ofId: string; reason: string } | null;
  tasks: { id: string; title: string; status: TaskStatus }[];
  /** True when the finding is closed (resolved, false positive, accepted risk). */
  closed: boolean;
  /** Set by a local review decision (false positive, accepted risk). */
  review?: FindingReview | null;
  /** What a new task needs, so a task can be created from the inbox row. */
  context?: FindingTaskContext;
};

export type FindingTaskContext = {
  expected: string;
  actual: string;
  affectedUrls: string[];
  verificationCriteria: string[];
  /** The first recommendation that is not rejected, if any. */
  recommendation: Recommendation | null;
};

export type FindingDetailData = {
  finding: {
    id: string;
    title: string;
    category: FindingCategory;
    severity: Severity;
    priority: Priority;
    confidence: Confidence;
    status: FindingStatus;
    lane: "ai_visibility" | "website_readiness";
    firstDetectedAt: string;
    lastObservedAt: string;
    auditId: string;
    affectedUrls: string[];
    expected: string;
    actual: string;
    recurrenceCount: number;
  };
  extras: Omit<FindingExtras, "evidence">;
  evidence: ResolvedEvidence[];
  prompts: { id: string; text: string }[];
  recommendations: Recommendation[];
  tasks: TaskSummary[];
};

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export type TaskSummary = {
  id: string;
  /** Website id (route segment). */
  storeId: string;
  title: string;
  findingId: string;
  findingTitle: string;
  category: FindingCategory;
  /** Dependencies not yet met (0 when none). */
  openDependencies: number;
  /** Cancelled tasks: why. Superseded tasks: id of the replacing task. */
  cancelReason?: string;
  supersededBy?: string | null;
  status: TaskStatus;
  assignee: string | null;
  dueAt: string | null;
  mode: ExecutionMode;
  risk: RiskLevel;
  priority: Priority;
  blockers: string[];
};

export type DraftFact = { label: string; value: string; source: string };
export type UnsupportedClaim = { text: string; reason: string };

type DraftBase = {
  sourceFacts: DraftFact[];
  unsupportedClaims: UnsupportedClaim[];
  /** Drafting model label (not an AI visibility channel). */
  modelLabel: string;
  generatedAt: string;
  version: number;
};

export type TextDraft = DraftBase & {
  kind: "text";
  resource: string;
  field: string;
  before: string;
  after: string;
  /** Output of a simulated regeneration. */
  alternate: { after: string; unsupportedClaims: UnsupportedClaim[] };
};

export type PatchDraft = DraftBase & {
  kind: "patch";
  resource: string;
  language: string;
  before: string;
  after: string;
};

export type BatchItem = {
  id: string;
  pageUrl: string;
  linkText: string;
  from: string;
  to: string;
  result: "ready" | "conflict" | "excluded" | "applied" | "failed";
  reason?: string;
};

export type BatchDraft = DraftBase & { kind: "batch"; resource: string; items: BatchItem[] };

export type GuidanceDraft = {
  kind: "guidance";
  owner: string;
  steps: { title: string; detail: string }[];
  sourceFacts: DraftFact[];
};

export type TaskDraft = TextDraft | PatchDraft | BatchDraft | GuidanceDraft;

export type ApprovalState = "not_required" | "not_requested" | "pending" | "approved" | "rejected";

export type ApprovalRecord = {
  state: ApprovalState;
  /** Why no approval is needed (mode without an external write). */
  notRequiredReason?: string;
  diffHash: string | null;
  /** Exactly what will be written on approval. */
  writes: string[];
  requestedBy?: string;
  requestedAt?: string;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
};

export type CmsState = "guidance" | "draft" | "staged" | "applied" | "published";

export type FieldOutcome = { field: string; before: string; after: string; outcome: "pending" | "written" | "skipped" | "failed" | "reverted"; note?: string };

export type RemoteCheck = {
  resource: string;
  versionAtDraft: string;
  versionNow: string;
  hashAtDraft: string;
  hashNow: string;
  checkedAt: string;
  changed: boolean;
  changedBy?: string;
  changedAt?: string;
  note?: string;
};

export type RollbackRecord = {
  at: string;
  by: string;
  reason: string;
  restoredHash: string;
  outcome: "restored" | "restored_with_manual_merge";
  note: string;
  preservedEdits: string[];
};

/** A failed write attempt. Nothing is changed on the live site unless `nothingWritten` is false. */
export type ExecutionFailure = {
  at: string;
  stage: "stage" | "apply" | "publish";
  code: string;
  message: string;
  attempts: { at: string; result: string }[];
  /** Whether a retry can succeed once the cause is fixed. */
  retryable: boolean;
  /** Plain reason a retry is blocked right now, or null when a retry is available. */
  retryBlockedBy: string | null;
  nothingWritten: boolean;
  nextStep: string;
};

export type ExecutionRecord = {
  connector: {
    /** Neutral name, for example "Website connector". Connectors are optional and shown as Demo. */
    label: string;
    /** Site the connector points at (domain). */
    site: string;
    state: "connected" | "needs_attention" | "disconnected";
    scopesGranted: string[];
    scopesRequired: string[];
    /** Context for scopes or state that differ from when the task last wrote. */
    note?: string;
  } | null;
  cmsState: CmsState;
  /** Result of the pre-write remote version/hash check. */
  remote: RemoteCheck | null;
  fields: FieldOutcome[];
  completedAt: string | null;
  stagedAt: string | null;
  appliedAt: string | null;
  publishedAt: string | null;
  /** Set when the last write attempt failed. */
  failure?: ExecutionFailure;
  rollback: {
    available: boolean;
    unavailableReason?: string;
    /** A later edit on the remote resource: rollback needs manual reconciliation. */
    laterEdit: { by: string; at: string; note: string } | null;
    record: RollbackRecord | null;
  };
};

export type VerificationCheck = {
  id: string;
  label: string;
  before: { status: CheckStatus; detail: string };
  after: { status: CheckStatus; detail: string };
};

export type VerificationOutcome = {
  result: "verified_success" | "partially_verified" | "failed" | "rolled_back";
  checks: VerificationCheck[];
  ranAt: string;
  sourceLabel: string;
  sourceHref?: string;
  findingEffect: string;
};

export type VerificationRecord = {
  plannedChecks: { id: string; label: string; expect: string }[];
  /** Completed verification, if any. */
  outcome: VerificationOutcome | null;
  /** What "Run verification" returns in this demo. */
  simulated: VerificationOutcome | null;
  context: { label: string; n: number; d: number; basis: string } | null;
};

export type HistoryKind = "created" | "draft" | "approval" | "execution" | "verification" | "rollback" | "status";

export type HistoryEvent = { id: string; at: string; actor: string; kind: HistoryKind; title: string; detail?: string };

export type TaskDetailData = {
  task: TaskSummary;
  /** Status of the related finding when the page was built. */
  findingStatus: FindingStatus;
  recommendationId: string | null;
  createdAt: string;
  createdBy: string;
  successCriteria: string[];
  dependencies: { label: string; met: boolean }[];
  draft: TaskDraft;
  approval: ApprovalRecord;
  execution: ExecutionRecord;
  verification: VerificationRecord;
  history: HistoryEvent[];
  /** Why the task was rejected (status rejected only). */
  rejection?: { by: string; at: string; reason: string };
  /** Why the task was cancelled (status cancelled only). */
  cancellation?: { by: string; at: string; reason: string };
  /** Replacing task (status superseded only). */
  supersession?: { by: string; at: string; successorId: string; reason: string };
};

/** A task created in this browser: everything the detail view needs, copied from the finding and recommendation. */
export type LocalTaskSeed = Omit<TaskDetailData, "task" | "findingStatus" | "history" | "approval" | "execution" | "verification"> & {
  approvalNeeded: boolean;
  plannedChecks: VerificationRecord["plannedChecks"];
};

/** Fields written onto a task row by local actions. Every field is optional: absent means "as seeded". */
export type TaskLocal = {
  approvalState?: ApprovalState;
  decision?: { by?: string; at?: string; note?: string };
  requestedAt?: string;
  /** Saved draft text (text and patch drafts). */
  draftText?: string;
  draftVersion?: number;
  draftClaims?: UnsupportedClaim[];
  /** How many times the draft was regenerated (odd = alternate output). */
  draftGen?: number;
  /** The exact text that was approved. A later edit invalidates the approval. */
  approvedText?: string;
  batch?: Record<string, BatchItem["result"]>;
  remoteResolved?: boolean;
  remoteCheckedAt?: string;
  completedAt?: string;
  stagedAt?: string;
  appliedAt?: string;
  publishedAt?: string;
  /** Number of apply attempts (batch tasks fail one item on the first attempt). */
  applyAttempts?: number;
  failure?: ExecutionFailure | null;
  outcome?: VerificationOutcome | null;
  rollbackRecord?: RollbackRecord | null;
  rejection?: { by: string; at: string; reason: string };
  cancellation?: { by: string; at: string; reason: string };
  supersession?: { by: string; at: string; successorId: string; reason: string };
  /** Task created in this browser. */
  seed?: LocalTaskSeed;
};

/** A task row as stored in the local overlay: summary plus local changes. */
export type TaskRow = TaskSummary & TaskLocal;

