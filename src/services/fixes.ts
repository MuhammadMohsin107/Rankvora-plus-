/**
 * Data access for the Fixes module. Reads demonstration data today; will call
 * the real remediation services later. Screens only import from here.
 * Local changes (status moves, created tasks) are layered on in the browser by src/features/fixes.
 */
import { EXTRA_TASKS, FINDING_EXTRAS, RECOMMENDATIONS, TASK_DETAILS, TASK_SUMMARY_EXTRAS, TASK_TITLE_OVERRIDES } from "@/demo/fixes";
import { getCurrentUser, listMembers, listPromptsBase, listStoreChannels } from "@/services/core";
import { getFinding, getResponse, listFindings, registry } from "@/services/records";
import type {
  AssigneeOption,
  FindingDetailData,
  FindingRow,
  HistoryEvent,
  ResolvedEvidence,
  TaskDetailData,
  TaskSummary,
} from "@/types/fixes";
import type { Finding } from "@/types/shared-records";

const CLOSED = new Set(["verified_resolved", "false_positive", "accepted_risk"]);

async function summaries(storeId: string): Promise<TaskSummary[]> {
  const findings = await listFindings(storeId);
  if (findings.length === 0) return [];
  const byId = new Map(findings.map((f) => [f.id, f]));
  const openDeps = (taskId: string) => TASK_DETAILS[taskId]?.dependencies.filter((d) => !d.met).length ?? 0;
  const seeded: TaskSummary[] = registry
    .tasks(storeId)
    .filter((t) => byId.has(t.findingId))
    .map((t) => ({
      id: t.id,
      storeId,
      title: TASK_TITLE_OVERRIDES[t.id] ?? t.title,
      findingId: t.findingId,
      findingTitle: byId.get(t.findingId)?.title ?? t.findingId,
      category: byId.get(t.findingId)?.category ?? "technical",
      openDependencies: openDeps(t.id),
      status: t.status,
      assignee: t.assignee,
      dueAt: t.dueAt,
      mode: t.mode,
      risk: t.risk,
      priority: t.priority,
      blockers: TASK_SUMMARY_EXTRAS[t.id]?.blockers ?? [],
    }));
  const extras: TaskSummary[] = EXTRA_TASKS.filter((t) => t.storeId === storeId && byId.has(t.findingId)).map((t) => ({
    id: t.id,
    storeId,
    title: t.title,
    findingId: t.findingId,
    findingTitle: byId.get(t.findingId)?.title ?? t.findingId,
    category: byId.get(t.findingId)?.category ?? "technical",
    openDependencies: openDeps(t.id),
    status: t.status,
    assignee: t.assignee,
    dueAt: t.dueAt,
    mode: t.mode,
    risk: t.risk,
    priority: t.priority,
    blockers: [],
    cancelReason: t.cancelReason,
    supersededBy: t.supersededBy ?? null,
  }));
  return [...seeded, ...extras];
}

/** What a website needs before Fixes can show anything: findings come from audits, and audits need a connected AI platform. */
export async function getFixesSetup(storeId: string): Promise<{ hasAiPlatform: boolean }> {
  const channels = await listStoreChannels(storeId);
  return { hasAiPlatform: channels.length > 0 };
}

export async function listTaskSummaries(storeId: string): Promise<TaskSummary[]> {
  return summaries(storeId);
}

export async function listFindingRows(storeId: string): Promise<FindingRow[]> {
  const [findings, tasks] = await Promise.all([listFindings(storeId), summaries(storeId)]);
  return findings.map((f: Finding) => ({
    id: f.id,
    storeId,
    title: f.title,
    category: f.category,
    severity: f.severity,
    priority: f.priority,
    confidence: f.confidence,
    status: f.status,
    urlCount: f.affectedUrls.length,
    promptCount: f.affectedPromptIds.length,
    lastObservedAt: f.lastObservedAt,
    duplicate: FINDING_EXTRAS[f.id]?.duplicate ?? null,
    tasks: tasks.filter((t) => t.findingId === f.id).map((t) => ({ id: t.id, title: t.title, status: t.status })),
    closed: CLOSED.has(f.status),
    review: null,
    context: {
      expected: f.expected,
      actual: f.actual,
      affectedUrls: f.affectedUrls,
      verificationCriteria: FINDING_EXTRAS[f.id]?.verificationCriteria ?? [],
      recommendation: RECOMMENDATIONS.find((r) => r.findingId === f.id && r.status !== "rejected") ?? null,
    },
  }));
}

export async function getFindingDetail(storeId: string, findingId: string): Promise<FindingDetailData | null> {
  const finding = await getFinding(storeId, findingId);
  const extras = FINDING_EXTRAS[findingId];
  if (!finding || !extras) return null;

  const [tasks, prompts] = await Promise.all([summaries(storeId), listPromptsBase(storeId)]);
  const evidence: ResolvedEvidence[] = [];
  for (const spec of extras.evidence) {
    if (spec.kind === "response") {
      const response = await getResponse(storeId, spec.responseId);
      if (response) evidence.push({ id: spec.id, kind: "response", response, note: spec.note });
    } else if (spec.kind === "prompt") {
      const prompt = prompts.find((p) => p.id === spec.promptId);
      if (prompt) evidence.push({ id: spec.id, kind: "prompt", promptId: prompt.id, text: prompt.text, note: spec.note });
    } else {
      evidence.push({ id: spec.id, kind: "page", url: spec.url, note: spec.note, auditId: spec.auditId });
    }
  }

  return {
    finding: {
      id: finding.id,
      title: finding.title,
      category: finding.category,
      severity: finding.severity,
      priority: finding.priority,
      confidence: finding.confidence,
      status: finding.status,
      lane: finding.lane,
      firstDetectedAt: finding.firstDetectedAt,
      lastObservedAt: finding.lastObservedAt,
      auditId: finding.auditId,
      affectedUrls: finding.affectedUrls,
      expected: finding.expected,
      actual: finding.actual,
      recurrenceCount: finding.recurrenceCount,
    },
    extras: {
      severityRationale: extras.severityRationale,
      priorityRationale: extras.priorityRationale,
      verificationCriteria: extras.verificationCriteria,
      observations: extras.observations,
      duplicate: extras.duplicate,
    },
    evidence,
    prompts: finding.affectedPromptIds.map((id) => ({ id, text: prompts.find((p) => p.id === id)?.text ?? id })),
    recommendations: RECOMMENDATIONS.filter((r) => r.findingId === findingId),
    tasks: tasks.filter((t) => t.findingId === findingId),
  };
}

export async function getTaskDetail(storeId: string, taskId: string): Promise<TaskDetailData | null> {
  const tasks = await summaries(storeId);
  const task = tasks.find((t) => t.id === taskId);
  const seed = TASK_DETAILS[taskId];
  if (!task || !seed) return null;
  const finding = await getFinding(storeId, task.findingId);
  return { task, findingStatus: finding?.status ?? "new", ...seed };
}

/** Ids a task shares with Monitoring and Comparison: the latest completed run and the before/after comparisons. */
export async function getFixLinks(storeId: string): Promise<{ latestRunId: string | null; comparisons: { id: string; title: string }[] }> {
  const runs = registry.runs(storeId).filter((r) => r.status === "completed" || r.status === "completed_with_warnings");
  const comparisons = registry.comparisons(storeId);
  const preferred = comparisons.filter((c) => c.type === "before_after_fixes");
  return {
    latestRunId: runs.length ? runs[runs.length - 1].id : null,
    comparisons: (preferred.length ? preferred : comparisons).map((c) => ({ id: c.id, title: c.title })),
  };
}

export type SeededHistoryEntry = HistoryEvent & { taskId: string; findingId: string; taskTitle: string };

/** Seeded task history across the website, newest first, for the Fixes history timeline. */
export async function listSeededHistory(storeId: string): Promise<SeededHistoryEntry[]> {
  const tasks = await summaries(storeId);
  const out: SeededHistoryEntry[] = [];
  for (const task of tasks) {
    for (const event of TASK_DETAILS[task.id]?.history ?? []) {
      out.push({ ...event, id: `${task.id}-${event.id}`, taskId: task.id, findingId: task.findingId, taskTitle: task.title });
    }
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Pairs for generateStaticParams on finding detail routes (every website; websites without findings add none). */
export async function findingStaticParams(storeIds: string[]): Promise<{ storeId: string; findingId: string }[]> {
  const out: { storeId: string; findingId: string }[] = [];
  for (const storeId of storeIds) for (const f of await listFindings(storeId)) out.push({ storeId, findingId: f.id });
  return out;
}

/** Pairs for generateStaticParams on task detail routes (every website; websites without tasks add none). */
export async function taskStaticParams(storeIds: string[]): Promise<{ storeId: string; taskId: string }[]> {
  const out: { storeId: string; taskId: string }[] = [];
  for (const storeId of storeIds) for (const t of await summaries(storeId)) out.push({ storeId, taskId: t.id });
  return out;
}

export async function listAssignees(): Promise<AssigneeOption[]> {
  const members = await listMembers();
  return members.filter((m) => m.role !== "viewer").map((m) => ({ id: m.id, name: m.name, role: m.role }));
}

export async function getActor() {
  const user = await getCurrentUser();
  return { name: user.name, role: user.role };
}
