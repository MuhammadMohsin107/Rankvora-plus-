/**
 * Data access for records shared across Audit, Fixes, Monitoring and Comparison.
 * Reads demonstration data today; will call real services later.
 */
import { DEMO_FINDINGS, buildRunResponses } from "@/demo/shared-records";
import { REGISTRY_AUDITS, REGISTRY_COMPARISONS, REGISTRY_REPORTS, REGISTRY_RUNS, REGISTRY_SCHEDULES, REGISTRY_TASKS } from "@/demo/registry";
import type { Finding, ResponseSample } from "@/types/shared-records";

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

// Registry accessors (ids, titles, dates, statuses, headline numbers).
export const registry = {
  audits: () => REGISTRY_AUDITS,
  runs: () => REGISTRY_RUNS,
  schedules: () => REGISTRY_SCHEDULES,
  comparisons: () => REGISTRY_COMPARISONS,
  tasks: () => REGISTRY_TASKS,
  reports: () => REGISTRY_REPORTS,
};
