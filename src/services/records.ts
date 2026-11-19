/**
 * Data access for records shared across Audit, Fixes, Monitoring and Comparison.
 * Reads demonstration data today; will call real services later.
 */
import { DEMO_FINDINGS, buildRunResponses } from "@/demo/shared-records";
import { RP, registryFor } from "@/demo/registry";
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
