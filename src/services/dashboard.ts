/**
 * Aggregates the headline pieces of every module for the store Dashboard.
 * Reads only shared records (registry, findings, generated responses), so the
 * Dashboard never contradicts the module screens.
 */
import { registryFor, type RegistryAudit, type RegistryRun, type RegistryTask } from "@/demo/registry";
import { DEMO_COMPETITORS, DEMO_ALERTS } from "@/demo/shared";
import { buildRunResponses, DEMO_FINDINGS } from "@/demo/shared-records";
import { getComparisonDetail } from "@/services/comparison";
import type { Comparability, MetricResult } from "@/types/comparison";
import { OPEN_FINDING_STATUSES, OPEN_TASK_STATUSES } from "@/lib/record-status";
import type { Finding } from "@/types/shared-records";

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

export type DashboardData = {
  trend: { runId: string; date: string; mention: { n: number; d: number }; recommendation: { n: number; d: number } }[];
  findings: Finding[];
  tasks: RegistryTask[];
  competitors: { id: string; name: string; status: "confirmed" | "suggested" | "archived"; n: number; d: number }[];
  monitoring: {
    schedule: ReturnType<typeof registryFor>["schedules"][number];
    lastRun: RegistryRun;
    openAlerts: number;
    inProgressAudit: RegistryAudit | null;
  };
  /** Headline of the latest completed comparison; same engine and numbers as the Comparison module. */
  comparison: { id: string; title: string; verdict: Comparability; matchedPairs: number; baselineSlots: number; mention: MetricResult | null; recommendation: MetricResult | null } | null;
  activity: { id: string; title: string; detail: string; at: string; tone: "success" | "warning" | "accent" | "neutral" | "info"; icon: "check-circle" | "alert-triangle" | "audit" | "monitoring" | "compare" | "fixes" }[];
};

type Activity = DashboardData["activity"];

/** Authored activity feed per store (demonstration data). */
const ACTIVITY: Record<string, Activity> = {
  "runpro-pk": [
    { id: "act-2", title: "Weekly run completed with warnings", detail: "run-008 · failed requests excluded from rates", at: "2026-11-17T05:12:00Z", tone: "warning", icon: "monitoring" },
    { id: "act-3", title: "Guide published, verification pending", detail: "task-004 · Publish beginner buying guide", at: "2026-11-15T09:00:00Z", tone: "info", icon: "fixes" },
    { id: "act-4", title: "Verification audit completed", detail: "aud-003 · Glide 2 product facts", at: "2026-11-12T07:29:00Z", tone: "success", icon: "check-circle" },
    { id: "act-5", title: "Task verified", detail: "task-005 · Organization schema updated", at: "2026-11-12T07:25:00Z", tone: "success", icon: "fixes" },
  ],
  "runpro-ae": [
    { id: "act-ae-1", title: "Weekly run completed", detail: "run-ae-006 · 30 / 30 requests succeeded", at: "2026-11-18T05:22:00Z", tone: "success", icon: "monitoring" },
    { id: "act-ae-2", title: "Focused audit partially completed", detail: "aud-ae-003 · 3 of 12 requests failed", at: "2026-11-14T06:12:00Z", tone: "warning", icon: "audit" },
    { id: "act-ae-3", title: "Schema change staged", detail: "task-ae-001 · waiting to be published", at: "2026-11-13T10:00:00Z", tone: "info", icon: "fixes" },
    { id: "act-ae-4", title: "Task verified", detail: "task-ae-005 · Sitemap redirects removed", at: "2026-11-08T09:30:00Z", tone: "success", icon: "fixes" },
    { id: "act-ae-5", title: "Full audit completed", detail: "aud-ae-002 · 3 findings created", at: "2026-11-05T05:41:00Z", tone: "success", icon: "check-circle" },
  ],
};

export async function getDashboardData(storeId: string): Promise<DashboardData | null> {
  const reg = registryFor(storeId);
  if (reg.runs.length === 0 || reg.schedules.length === 0) return null;

  const latest = reg.runs[reg.runs.length - 1];
  const responses = buildRunResponses(latest.id).filter((r) => r.status === "succeeded");
  const competitors = DEMO_COMPETITORS.filter((c) => c.storeId === storeId && c.status !== "archived").map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    n: responses.filter((r) => r.competitors.some((x) => x.name === c.name && x.mentioned)).length,
    d: responses.length,
  }));

  const newestCompleted = [...reg.comparisons]
    .filter((c) => c.status === "completed" || c.status === "completed_with_warnings")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const cmp = newestCompleted ? await getComparisonDetail(storeId, newestCompleted.id) : null;
  const openAudit = reg.audits.find((a) => a.status === "in_progress") ?? null;
  const schedule = reg.schedules.find((s) => s.status === "active") ?? reg.schedules[0];

  return {
    trend: reg.runs.map((r) => ({ runId: r.id, date: r.scheduledFor, mention: r.mention, recommendation: r.recommendation })),
    findings: DEMO_FINDINGS.filter((f) => f.storeId === storeId && OPEN_FINDING_STATUSES.has(f.status)).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    tasks: reg.tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status)),
    competitors: competitors.sort((a, b) => b.n - a.n),
    monitoring: {
      schedule,
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
    activity: ACTIVITY[storeId] ?? [],
  };
}
