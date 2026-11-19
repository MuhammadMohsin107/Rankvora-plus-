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
  | "superseded";

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

export type FindingRow = {
  id: string;
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
  title: string;
  findingId: string;
  findingTitle: string;
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

export type ExecutionRecord = {
  connector: { label: string; store: string; state: "connected" | "needs_attention" | "disconnected"; scopesGranted: string[]; scopesRequired: string[] } | null;
  cmsState: CmsState;
  /** Result of the pre-write remote version/hash check. */
  remote: RemoteCheck | null;
  fields: FieldOutcome[];
  completedAt: string | null;
  stagedAt: string | null;
  appliedAt: string | null;
  publishedAt: string | null;
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
};

export type AssigneeOption = { id: string; name: string; role: string };
