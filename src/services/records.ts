/**
 * Data access for records shared across Audit, Fixes, Monitoring and Comparison.
 * Reads demonstration data today; will call real services later.
 */
import { DEMO_FINDINGS, buildRunResponses } from "@/demo/shared-records";
import { RP, registryFor } from "@/demo/registry";
import { buildEvidenceChain, mergeEvidenceEvents, type EvidenceEventLike, type EvidenceNode } from "@/features/evidence/chain";
import type { EvidenceIds, Finding, ResponseSample } from "@/types/shared-records";

export async function listFindings(storeId: string): Promise<Finding[]> {
  return DEMO_FINDINGS.filter((f) => f.storeId === storeId);
}

export async function getFinding(storeId: string, findingId: string): Promise<Finding | null> {
  return DEMO_FINDINGS.find((f) => f.storeId === storeId && f.id === findingId) ?? null;
}

/** Responses for one audit (aud-…) or monitoring run (run-…). */
export async function listRunResponses(storeId: string, runId: string): Promise<ResponseSample[]> {
  return buildRunResponses(runId).filter((r) => r.storeId === storeId);
}

export async function getResponse(storeId: string, responseId: string): Promise<ResponseSample | null> {
  const runId = responseId.match(/^resp-(.+)-\d+$/)?.[1];
  if (!runId) return null;
  return buildRunResponses(runId).find((r) => r.storeId === storeId && r.id === responseId) ?? null;
}

/**
 * Registry accessors (ids, titles, dates, statuses, headline numbers) for one store.
 * `storeId` defaults to runpro-pk only so older call sites keep compiling; pass it explicitly.
 */
export const registry = {
  audits: (storeId: string = RP) => registryFor(storeId).audits,
  runs: (storeId: string = RP) => registryFor(storeId).runs,
  schedules: (storeId: string = RP) => registryFor(storeId).schedules,
  comparisons: (storeId: string = RP) => registryFor(storeId).comparisons,
  tasks: (storeId: string = RP) => registryFor(storeId).tasks,
  reports: (storeId: string = RP) => registryFor(storeId).reports,
};

// ---------------------------------------------------------------------------
// Evidence links: one finding id across Audit, Fixes, Monitoring and Comparison
// ---------------------------------------------------------------------------

export type EvidenceTaskRef = { id: string; title: string; status: string; href: string; /** Created in this browser (demo-state). */ local?: boolean };

export type EvidenceLinks = {
  storeId: string;
  findingId: string;
  /** Shared ids for the chain. Pass them to `<EvidenceTrace ids={...} />`; it merges later local events itself. */
  ids: EvidenceIds;
  chain: EvidenceNode[];
  tasks: EvidenceTaskRef[];
  /** Local events that touched this finding or its tasks, oldest first. */
  events: EvidenceEventLike[];
};

const VERIFYING = new Set(["verification_pending", "verified_success", "partially_verified"]);
const FIXED = new Set(["applied", "published", ...VERIFYING]);
const SKIPPED = new Set(["rejected", "superseded", "cancelled"]);

/** Which metric a finding's lane and category move. */
function metricFor(finding: Finding): string {
  if (finding.lane === "ai_visibility") return "mention-rate";
  return finding.category === "technical" || finding.category === "schema" ? "technical-pass-rate" : "content-pass-rate";
}

/** The response that best shows the finding: for a missed mention, a succeeded response where the brand is absent. */
function evidenceResponse(finding: Finding, promptId: string | undefined): ResponseSample | null {
  if (!promptId) return null;
  const forPrompt = buildRunResponses(finding.auditId).filter((r) => r.storeId === finding.storeId && r.promptId === promptId && r.status === "succeeded");
  return forPrompt.find((r) => r.brandMentioned === "no") ?? forPrompt[0] ?? null;
}

/**
 * Static ids of a finding's chain: metric and source run, prompt, response, citation, the fix task, the run or audit
 * that verified it, the monitoring observation and a before/after comparison. Deterministic; the same finding always
 * gets the same ids. Anything the seeded data does not have is simply left out.
 */
export function evidenceIdsForFinding(finding: Finding): EvidenceIds {
  const reg = registryFor(finding.storeId);
  const tasks = reg.tasks.filter((t) => t.findingId === finding.id);
  const task = tasks.find((t) => !SKIPPED.has(t.status)) ?? tasks[0];
  const promptId = finding.affectedPromptIds[0];
  const response = evidenceResponse(finding, promptId);
  const citation = response ? (response.citations.find((c) => c.source === (response.brandMentioned === "no" ? "competitor" : "owned")) ?? response.citations[0]) : undefined;

  let verificationId: string | undefined;
  if (task && VERIFYING.has(task.status)) {
    const audit = reg.audits.find((a) => a.type === "verification" && a.completedAt !== null && a.startedAt >= finding.firstDetectedAt);
    const after = task.dueAt ?? finding.lastObservedAt;
    verificationId = audit?.id ?? (reg.runs.find((r) => r.scheduledFor >= after) ?? reg.runs[reg.runs.length - 1])?.id;
  }
  const comparison = task && FIXED.has(task.status) ? reg.comparisons.find((c) => c.type === "before_after_fixes") : undefined;

  return {
    storeId: finding.storeId,
    metricId: metricFor(finding),
    sourceId: finding.auditId,
    promptId,
    responseId: response?.id,
    citation: citation?.domain,
    findingId: finding.id,
    taskId: task?.id,
    verificationId,
    observationId: promptId && response ? `${promptId}|${response.channelId}` : undefined,
    comparisonId: comparison?.id,
  };
}

/**
 * The evidence chain for one finding. Pass locally recorded demo events (`useDemoEvents()` on the client) to merge
 * tasks created, verifications run and comparisons annotated in this browser: the finding keeps one identifier and
 * the chain grows. Without events it is the static chain.
 */
export async function getEvidenceLinks(storeId: string, findingId: string, events: readonly EvidenceEventLike[] = []): Promise<EvidenceLinks | null> {
  const finding = await getFinding(storeId, findingId);
  if (!finding) return null;
  const merged = mergeEvidenceEvents(evidenceIdsForFinding(finding), events);
  const reg = registryFor(storeId);
  const tasks: EvidenceTaskRef[] = reg.tasks
    .filter((t) => t.findingId === findingId)
    .map((t) => ({ id: t.id, title: t.title, status: t.status, href: `/stores/${storeId}/fixes/tasks/${t.id}` }));
  for (const id of merged.localTaskIds) {
    if (tasks.some((t) => t.id === id)) continue;
    const created = merged.events.find((e) => e.kind === "task.created" && e.refs.taskId === id);
    tasks.push({ id, title: created?.label ?? id, status: "suggested", href: `/stores/${storeId}/fixes/tasks/${id}`, local: true });
  }
  return { storeId, findingId, ids: merged.ids, chain: buildEvidenceChain(merged.ids), tasks, events: merged.events };
}
