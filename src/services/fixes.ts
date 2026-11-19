/**
 * Data access for the Fixes module. Reads demonstration data today; will call
 * the real remediation services later. Screens only import from here.
 */
import { FINDING_EXTRAS, RECOMMENDATIONS, TASK_DETAILS, TASK_SUMMARY_EXTRAS } from "@/demo/fixes";
import { getCurrentUser, listMembers, listPromptsBase } from "@/services/core";
import { getFinding, getResponse, listFindings, registry } from "@/services/records";
import type {
  AssigneeOption,
  FindingDetailData,
  FindingRow,
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
  return registry
    .tasks()
    .filter((t) => byId.has(t.findingId))
    .map((t) => ({
      id: t.id,
      title: t.title,
      findingId: t.findingId,
      findingTitle: byId.get(t.findingId)?.title ?? t.findingId,
      status: t.status,
      assignee: t.assignee,
      dueAt: t.dueAt,
      mode: t.mode,
      risk: t.risk,
      priority: t.priority,
      blockers: TASK_SUMMARY_EXTRAS[t.id]?.blockers ?? [],
    }));
}

export async function listTaskSummaries(storeId: string): Promise<TaskSummary[]> {
  return summaries(storeId);
}

export async function listFindingRows(storeId: string): Promise<FindingRow[]> {
  const [findings, tasks] = await Promise.all([listFindings(storeId), summaries(storeId)]);
  return findings.map((f: Finding) => ({
    id: f.id,
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
  return { task, ...seed };
}

/** Pairs for generateStaticParams on finding detail routes (stores with data only). */
export async function findingStaticParams(storeIds: string[]): Promise<{ storeId: string; findingId: string }[]> {
  const out: { storeId: string; findingId: string }[] = [];
  for (const storeId of storeIds) for (const f of await listFindings(storeId)) out.push({ storeId, findingId: f.id });
  return out;
}

/** Pairs for generateStaticParams on task detail routes (stores with data only). */
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
