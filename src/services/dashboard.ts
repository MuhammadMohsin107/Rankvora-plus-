/**
 * Aggregates the headline pieces of every module for the store Dashboard.
 * Reads only shared records (registry, findings, generated responses), so the
 * Dashboard never contradicts the module screens.
 */
import { REGISTRY_AUDITS, REGISTRY_RUNS, REGISTRY_SCHEDULES, REGISTRY_TASKS } from "@/demo/registry";
import { DEMO_COMPETITORS, DEMO_ALERTS } from "@/demo/shared";
import { buildRunResponses, DEMO_FINDINGS } from "@/demo/shared-records";
import { getComparisonDetail } from "@/services/comparison";
import type { Comparability, MetricResult } from "@/types/comparison";
import type { Finding } from "@/types/shared-records";

const OPEN_FINDING = new Set<Finding["status"]>(["new", "under_review", "confirmed", "in_remediation", "awaiting_verification", "reopened"]);
const OPEN_TASK = new Set(["suggested", "pending_approval", "approved", "queued", "in_progress", "blocked", "draft_ready", "staged", "applied", "published", "verification_pending", "partially_verified", "failed"]);
const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export type DashboardData = {
  trend: { runId: string; date: string; mention: { n: number; d: number }; recommendation: { n: number; d: number } }[];
  findings: Finding[];
  tasks: typeof REGISTRY_TASKS;
  competitors: { id: string; name: string; status: "confirmed" | "suggested" | "archived"; n: number; d: number }[];
  monitoring: {
    schedule: (typeof REGISTRY_SCHEDULES)[number];
    lastRun: (typeof REGISTRY_RUNS)[number];
    openAlerts: number;
    inProgressAudit: (typeof REGISTRY_AUDITS)[number] | null;
  };
  /** Headline of the latest completed comparison; same engine and numbers as the Comparison module. */
  comparison: { id: string; title: string; verdict: Comparability; matchedPairs: number; baselineSlots: number; mention: MetricResult | null; recommendation: MetricResult | null } | null;
  activity: { id: string; title: string; detail: string; at: string; tone: "success" | "warning" | "accent" | "neutral" | "info"; icon: "check-circle" | "alert-triangle" | "audit" | "monitoring" | "compare" | "fixes" }[];
};

export async function getDashboardData(storeId: string): Promise<DashboardData | null> {
  if (storeId !== "runpro-pk") return null;

  const latest = REGISTRY_RUNS[REGISTRY_RUNS.length - 1];
  const responses = buildRunResponses(latest.id).filter((r) => r.status === "succeeded");
  const competitors = DEMO_COMPETITORS.filter((c) => c.storeId === storeId && c.status !== "archived").map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    n: responses.filter((r) => r.competitors.some((x) => x.name === c.name && x.mentioned)).length,
    d: responses.length,
  }));

  const cmp = await getComparisonDetail(storeId, "cmp-001");
  const openAudit = REGISTRY_AUDITS.find((a) => a.status === "in_progress") ?? null;

  return {
    trend: REGISTRY_RUNS.map((r) => ({ runId: r.id, date: r.scheduledFor, mention: r.mention, recommendation: r.recommendation })),
    findings: DEMO_FINDINGS.filter((f) => f.storeId === storeId && OPEN_FINDING.has(f.status)).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    tasks: REGISTRY_TASKS.filter((t) => OPEN_TASK.has(t.status)),
    competitors: competitors.sort((a, b) => b.n - a.n),
    monitoring: {
      schedule: REGISTRY_SCHEDULES[0],
      lastRun: latest,
      openAlerts: DEMO_ALERTS.filter((a) => a.storeId === storeId && !a.read).length,
      inProgressAudit: openAudit,
    },
    comparison: cmp
      ? {
          id: cmp.record.id,
          title: cmp.record.title,
          verdict: cmp.result.verdict,
          matchedPairs: cmp.result.matchedPairs,
          baselineSlots: cmp.result.baselineSlots,
          mention: cmp.result.headline.find((m) => m.id === "mention") ?? null,
          recommendation: cmp.result.headline.find((m) => m.id === "recommendation") ?? null,
        }
      : null,
    activity: [
      { id: "act-2", title: "Weekly run completed with warnings", detail: "run-008 · failed requests excluded from rates", at: "2026-11-17T05:12:00Z", tone: "warning", icon: "monitoring" },
      { id: "act-3", title: "Guide published, verification pending", detail: "task-004 · Publish beginner buying guide", at: "2026-11-15T09:00:00Z", tone: "info", icon: "fixes" },
      { id: "act-4", title: "Verification audit completed", detail: "aud-003 · Glide 2 product facts", at: "2026-11-12T07:29:00Z", tone: "success", icon: "check-circle" },
      { id: "act-5", title: "Task verified", detail: "task-005 · Organization schema updated", at: "2026-11-12T07:25:00Z", tone: "success", icon: "fixes" },
    ],
  };
}
