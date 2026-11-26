/**
 * Evidence chain: Metric -> Prompt -> Response -> Citation -> Finding -> Fix (-> Verification -> Observation -> Comparison).
 *
 * Pure and framework-free (no React, no demo data), so it runs on the server, in the browser and in tests.
 * A chain is built from shared ids. Every node links to the real route that owns that record.
 * Locally recorded demo events (task created, verified, comparison annotated, ...) can be merged
 * into the ids so a finding keeps the same identifier across Audit, Fixes, Monitoring and Comparison.
 */

import type { EvidenceIds, EvidenceKind } from "@/types/shared-records";

export type { EvidenceIds, EvidenceKind };

export const EVIDENCE_KINDS: readonly EvidenceKind[] = ["metric", "prompt", "response", "citation", "finding", "fix", "verification", "observation", "comparison"];

/** Short names used for the chip's type label and its accessible name. */
export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  metric: "Metric",
  prompt: "Prompt",
  response: "Response",
  citation: "Citation",
  finding: "Finding",
  fix: "Fix",
  verification: "Verification",
  observation: "Observation",
  comparison: "Comparison",
};

export type EvidenceNode = {
  kind: EvidenceKind;
  /** Record id shown in the chip (or the cited domain). */
  id: string;
  /** Readable text for the chip: the label override, else a short default. */
  label: string;
  /** Real in-app route that owns the record. */
  href: string;
};

const METRIC_LABEL: Record<string, string> = {
  "mention-rate": "Mention rate",
  "recommendation-rate": "Recommendation rate",
  "citation-rate": "Owned citation rate",
  "page-coverage": "Page coverage",
  "technical-pass-rate": "Technical pass rate",
  "content-pass-rate": "Content pass rate",
  "job-success-rate": "Job success rate",
};

/** "mention-rate" -> "Mention rate" (known ids), anything else is humanised. */
export function metricLabel(metricId: string): string {
  const known = METRIC_LABEL[metricId];
  if (known) return known;
  const text = metricId.replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : metricId;
}

const base = (storeId: string) => `/stores/${encodeURIComponent(storeId)}`;

/** Run id embedded in a response id: "resp-run-008-3" -> "run-008". */
export function runIdOfResponse(responseId: string): string | null {
  return responseId.match(/^resp-(.+)-\d+$/)?.[1] ?? null;
}

/** Route of an audit (aud-...) or monitoring run (run-...); null for anything else. */
export function sourceHref(storeId: string, sourceId: string | undefined): string | null {
  if (!sourceId) return null;
  if (sourceId.startsWith("aud-")) return `${base(storeId)}/audits/${encodeURIComponent(sourceId)}`;
  if (sourceId.startsWith("run-")) return `${base(storeId)}/monitoring/runs/${encodeURIComponent(sourceId)}`;
  return null;
}

/** Route that lists a response's run, with the response id as a deep-link hint. */
export function responseHref(storeId: string, responseId: string, fallbackSource?: string): string {
  const runId = runIdOfResponse(responseId) ?? fallbackSource;
  const query = `?response=${encodeURIComponent(responseId)}`;
  if (runId?.startsWith("aud-")) return `${base(storeId)}/audits/${encodeURIComponent(runId)}/ai-visibility${query}`;
  if (runId?.startsWith("run-")) return `${base(storeId)}/monitoring/runs/${encodeURIComponent(runId)}${query}`;
  return `${base(storeId)}/monitoring/observations${query}`;
}

/** The route for one node. Pure; also used by tables that render a single id. */
export function evidenceHref(kind: EvidenceKind, id: string, ids: EvidenceIds): string {
  const root = base(ids.storeId);
  switch (kind) {
    case "metric":
      return sourceHref(ids.storeId, ids.sourceId) ?? root;
    case "prompt":
      return `${root}/prompts/${encodeURIComponent(id)}`;
    case "response":
      return responseHref(ids.storeId, id, ids.sourceId);
    case "citation":
      return ids.responseId
        ? `${responseHref(ids.storeId, ids.responseId, ids.sourceId)}&citation=${encodeURIComponent(id)}`
        : (sourceHref(ids.storeId, ids.sourceId) ?? root);
    case "finding":
      return `${root}/fixes/findings/${encodeURIComponent(id)}`;
    case "fix":
      return `${root}/fixes/tasks/${encodeURIComponent(id)}`;
    case "verification":
      return sourceHref(ids.storeId, id) ?? (ids.taskId ? `${root}/fixes/tasks/${encodeURIComponent(ids.taskId)}` : root);
    case "observation":
      return id.startsWith("run-") ? (sourceHref(ids.storeId, id) ?? root) : `${root}/monitoring/observations`;
    case "comparison":
      return `${root}/comparisons/${encodeURIComponent(id)}`;
  }
}

function defaultLabel(kind: EvidenceKind, id: string): string {
  if (kind === "metric") return metricLabel(id);
  if (kind === "citation") return id.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (kind === "observation" && id.includes("|")) return id.split("|")[0];
  return id;
}

/** Which id field feeds which kind, in chain order. */
const ORDER: { kind: EvidenceKind; pick: (ids: EvidenceIds) => string | undefined }[] = [
  { kind: "metric", pick: (ids) => ids.metricId },
  { kind: "prompt", pick: (ids) => ids.promptId },
  { kind: "response", pick: (ids) => ids.responseId },
  { kind: "citation", pick: (ids) => ids.citation },
  { kind: "finding", pick: (ids) => ids.findingId },
  { kind: "fix", pick: (ids) => ids.taskId },
  { kind: "verification", pick: (ids) => ids.verificationId },
  { kind: "observation", pick: (ids) => ids.observationId },
  { kind: "comparison", pick: (ids) => ids.comparisonId },
];

/**
 * Nodes in fixed order, only for the ids that exist. A node's `href` is the real route of its record.
 * Pure: the same ids always give the same chain.
 */
export function buildEvidenceChain(ids: EvidenceIds): EvidenceNode[] {
  const nodes: EvidenceNode[] = [];
  for (const { kind, pick } of ORDER) {
    const id = pick(ids)?.trim();
    if (!id) continue;
    nodes.push({ kind, id, label: ids.labels?.[kind] ?? defaultLabel(kind, id), href: evidenceHref(kind, id, ids) });
  }
  return nodes;
}

/** Kinds from the chain that have no id yet, in chain order (used to say what is still missing). */
export function missingEvidenceKinds(ids: EvidenceIds): EvidenceKind[] {
  const have = new Set(buildEvidenceChain(ids).map((node) => node.kind));
  return EVIDENCE_KINDS.filter((kind) => !have.has(kind));
}

// ---------------------------------------------------------------------------
// Merging locally recorded demo events
// ---------------------------------------------------------------------------

/** The part of a demo-state event the chain needs. DemoEvent satisfies it. */
export type EvidenceEventLike = {
  id: string;
  at: string;
  kind: string;
  label: string;
  refs: {
    findingId?: string;
    taskId?: string;
    runId?: string;
    comparisonId?: string;
    promptId?: string;
    auditId?: string;
    websiteId?: string;
  };
};

export type MergedEvidence = {
  ids: EvidenceIds;
  /** Events that touched this finding or task, oldest first. */
  events: EvidenceEventLike[];
  /** Task ids created locally for this finding. */
  localTaskIds: string[];
};

const VERIFY_KINDS = new Set(["task.verified", "run.completed"]);

/**
 * Folds locally recorded events into the ids. Rules:
 *  - an event matches when it names the same finding, or the same task as the chain;
 *  - `task.created` for the finding supplies the fix id when the chain has none (the newest created task wins);
 *  - `task.verified` / `run.completed` with a run or audit id supplies the verification id;
 *  - `run.started` / `run.completed` with a run id and no verification supplies the observation id;
 *  - `comparison.annotated` / `comparison.created` with a comparison id supplies the comparison id.
 * Ids that already exist are never replaced, so the seeded record keeps its identity.
 */
export function mergeEvidenceEvents(ids: EvidenceIds, events: readonly EvidenceEventLike[]): MergedEvidence {
  const inStore = events.filter((event) => !event.refs.websiteId || event.refs.websiteId === ids.storeId);
  const chronological = (list: EvidenceEventLike[]) => list.sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id, "en", { numeric: true }) : a.at.localeCompare(b.at)));

  // Pass 1: tasks created locally for this finding supply the fix id when the chain has none.
  const localTaskIds = chronological(inStore.filter((e) => e.kind === "task.created" && ids.findingId !== undefined && e.refs.findingId === ids.findingId && e.refs.taskId))
    .map((e) => e.refs.taskId as string);
  const taskId = ids.taskId ?? localTaskIds[localTaskIds.length - 1];

  // Pass 2: every event that names this finding or this task.
  const matching = chronological(
    inStore.filter((e) => (ids.findingId !== undefined && e.refs.findingId === ids.findingId) || (taskId !== undefined && e.refs.taskId === taskId)),
  );

  const merged: EvidenceIds = { ...ids };
  if (taskId) merged.taskId = taskId;
  for (const event of matching) {
    const { refs, kind } = event;
    if (VERIFY_KINDS.has(kind)) {
      const source = refs.runId ?? refs.auditId;
      if (source && !merged.verificationId) merged.verificationId = source;
    }
    if ((kind === "run.started" || kind === "run.completed") && refs.runId && !merged.observationId) merged.observationId = refs.runId;
    if ((kind === "comparison.annotated" || kind === "comparison.created") && refs.comparisonId && !merged.comparisonId) merged.comparisonId = refs.comparisonId;
  }
  return { ids: merged, events: matching, localTaskIds };
}
