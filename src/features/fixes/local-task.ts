/**
 * Tasks created in this browser. Pure: builds the row (and the detail view of that row) from a finding and a
 * recommendation. Everything is simulated and labelled so; nothing is sent anywhere.
 * Does not import demo data, so the client bundle stays small.
 */
import type {
  ExecutionMode,
  LocalTaskSeed,
  Recommendation,
  TaskDetailData,
  TaskRow,
  TaskStatus,
  UnsupportedClaim,
} from "@/types/fixes";
import type { FindingCategory, FindingStatus, Priority } from "@/types/shared-records";

/** Deterministic demo digest (FNV-1a). Not a real SHA-256; the UI labels it a demo digest. */
export function localDigest(seed: string): string {
  let out = "";
  for (let word = 0; word < 8; word += 1) {
    let h = 0x811c9dc5 ^ (word * 0x9e3779b1);
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out;
}

/** The part of a finding a new task needs. */
export type TaskFinding = {
  id: string;
  title: string;
  category: FindingCategory;
  priority: Priority;
  status: FindingStatus;
  expected: string;
  actual: string;
  affectedUrls: string[];
  verificationCriteria: string[];
};

export type NewTaskInput = {
  storeId: string;
  finding: TaskFinding;
  recommendation: Recommendation | null;
  mode: ExecutionMode;
  assignee: string | null;
  dueAt: string | null;
  actorName: string;
  now: string;
};

const UNSUPPORTED_ALTERNATE: UnsupportedClaim = { text: "Trusted by thousands of customers.", reason: "No source fact supports this claim." };

export function modeNeedsApproval(mode: ExecutionMode): boolean {
  return mode === "approved_apply" || mode === "cms_staged";
}

/** Simulated draft text: the recommended action stated plainly, from the finding's own facts. */
export function simulatedDraftText(finding: TaskFinding, rec: Recommendation | null): string {
  const action = rec?.action ?? `Resolve: ${finding.title}`;
  const outcome = rec?.expectedOutcome ?? finding.expected;
  return `${action}\n\nExpected: ${outcome}`;
}

export function buildTaskSeed(input: NewTaskInput): LocalTaskSeed {
  const { finding, recommendation: rec, mode, actorName, now } = input;
  const resource = finding.affectedUrls[0]?.replace(/^https?:\/\//, "") ?? "Affected resource";
  const planned = (rec?.verificationPlan.length ? rec.verificationPlan : finding.verificationCriteria).map((label, index) => ({ id: `c${index + 1}`, label, expect: "Passes" }));
  const facts = [
    { label: "Observed", value: finding.actual, source: `Finding ${finding.id}` },
    { label: "Expected", value: finding.expected, source: `Finding ${finding.id}` },
  ];
  const after = simulatedDraftText(finding, rec);
  const draft: LocalTaskSeed["draft"] =
    mode === "guidance"
      ? {
          kind: "guidance",
          owner: input.assignee ?? "Unassigned",
          steps: [
            { title: "Review the finding", detail: finding.actual },
            { title: "Make the change", detail: rec?.action ?? finding.expected },
            { title: "Re-check", detail: planned[0]?.label ?? "Run the verification checks." },
          ],
          sourceFacts: facts,
        }
      : {
          kind: "text",
          resource,
          field: "Proposed change",
          before: finding.actual,
          after,
          alternate: { after: `${after}\n${UNSUPPORTED_ALTERNATE.text}`, unsupportedClaims: [UNSUPPORTED_ALTERNATE] },
          sourceFacts: facts,
          unsupportedClaims: [],
          modelLabel: "Simulated draft",
          generatedAt: now,
          version: 1,
        };
  return {
    recommendationId: rec?.id ?? null,
    createdAt: now,
    createdBy: actorName,
    successCriteria: finding.verificationCriteria,
    dependencies: (rec?.dependencies ?? []).map((label) => ({ label, met: false })),
    draft,
    approvalNeeded: modeNeedsApproval(mode),
    plannedChecks: planned.length ? planned : [{ id: "c1", label: "Re-run the audit check for this finding", expect: "Passes" }],
  };
}

/** The row stored in the demo-state tasks collection. The id is assigned by the store. */
export function buildTaskRow(input: NewTaskInput): Omit<TaskRow, "id"> {
  const { finding, recommendation: rec } = input;
  const seed = buildTaskSeed(input);
  return {
    storeId: input.storeId,
    title: rec?.title ?? `Fix: ${finding.title}`,
    findingId: finding.id,
    findingTitle: finding.title,
    category: finding.category,
    openDependencies: seed.dependencies.length,
    status: "suggested",
    assignee: input.assignee,
    dueAt: input.dueAt,
    mode: input.mode,
    risk: rec?.risk ?? "low",
    priority: finding.priority,
    blockers: [],
    seed,
  };
}

/** Detail view of a task created here. Status and other live fields still come from the row. */
export function detailFromRow(row: TaskRow, findingStatus: FindingStatus): TaskDetailData {
  const seed = row.seed;
  if (!seed) throw new Error("Not a local task");
  const task = { ...row };
  const resource = seed.draft.kind === "text" ? seed.draft.resource : "the site";
  return {
    task,
    findingStatus,
    recommendationId: seed.recommendationId,
    createdAt: seed.createdAt,
    createdBy: seed.createdBy,
    successCriteria: seed.successCriteria,
    dependencies: seed.dependencies,
    draft: seed.draft,
    approval: seed.approvalNeeded
      ? { state: "not_requested", diffHash: localDigest(`${row.id}-diff`), writes: [`Simulated write of the proposed change to ${resource}`] }
      : { state: "not_required", notRequiredReason: row.mode === "guidance" ? "Guidance only. No write is made by Rankvora AI." : "AI draft only. A person applies the change.", diffHash: row.mode === "guidance" ? null : localDigest(`${row.id}-diff`), writes: [] },
    execution: {
      connector: null,
      cmsState: row.mode === "guidance" ? "guidance" : "draft",
      remote: null,
      fields:
        seed.draft.kind === "text"
          ? [{ field: seed.draft.field, before: seed.draft.before, after: seed.draft.after, outcome: "pending" }]
          : [],
      completedAt: null,
      stagedAt: null,
      appliedAt: null,
      publishedAt: null,
      rollback: { available: false, unavailableReason: "Nothing has been applied.", laterEdit: null, record: null },
    },
    verification: { plannedChecks: seed.plannedChecks, outcome: null, simulated: null, context: null },
    history: [],
  };
}

/** Initial status for a task created in this browser. */
export const NEW_TASK_STATUS: TaskStatus = "suggested";
