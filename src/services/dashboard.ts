/**
 * Aggregates the headline pieces of every module for the Dashboard and the websites list.
 * Reads only shared records (registry, findings, generated responses), so these screens
 * never contradict the module screens. Everything returned is plain JSON so a client view can
 * layer local demo-state changes (alerts read, tasks approved, ...) on top.
 */
import { registryFor } from "@/demo/registry";
import { ALL_PROMPTS, DEMO_ALERTS, DEMO_COMPETITORS, DEMO_STORES } from "@/demo/shared";
import { buildRunResponses, DEMO_FINDINGS } from "@/demo/shared-records";
import { getComparisonDetail } from "@/services/comparison";
import type { Comparability, MetricResult } from "@/types/comparison";
import type { ActivityItem, AlertHeadline, PromptBase, Rate } from "@/types/core";

export type DashboardFinding = { id: string; storeId: string; title: string; priority: "P0" | "P1" | "P2" | "P3"; severity: "critical" | "high" | "medium" | "low" | "informational"; status: string; /** First prompt and task linked to the finding (evidence chain). */ promptId?: string; taskId?: string };
export type DashboardTask = { id: string; storeId: string; title: string; status: string; findingId: string; priority: "P0" | "P1" | "P2" | "P3"; dueAt: string | null };

export type DashboardData = {
  storeId: string;
  trend: { runId: string; date: string; mention: Rate; recommendation: Rate }[];
  /** Every finding of the website. The view keeps the open ones after local changes. */
  findings: DashboardFinding[];
  tasks: DashboardTask[];
  /** Responses naming each confirmed or suggested competitor in the latest run. */
  competitors: { id: string; name: string; status: "confirmed" | "suggested" | "archived"; n: number; d: number }[];
  alerts: AlertHeadline[];
  lastRun: { id: string; scheduledFor: string; status: string; succeededJobs: number; plannedJobs: number };
  schedule: { id: string; name: string; status: string; nextRunAt: string | null };
  inProgressAudit: { id: string; title: string; done: number; planned: number } | null;
  channelCount: number;
  /** Prompts of the website. The view adds locally created ones (usePrompts). */
  prompts: PromptBase[];
  /** Headline of the latest completed comparison; same engine and numbers as the Comparison module. */
  comparison: { id: string; title: string; verdict: Comparability; matchedPairs: number; baselineSlots: number; mention: MetricResult | null; recommendation: MetricResult | null } | null;
  activity: ActivityItem[];
};

type Authored = Omit<ActivityItem, "websiteId">;

/** Authored activity feed per website (demonstration data). */
const ACTIVITY: Record<string, Authored[]> = {
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
  nutrition: [
    { id: "act-nu-1", title: "Triggered audit partially completed", detail: "aud-nu-005 · 3 of 12 requests failed", at: "2026-11-18T05:09:00Z", tone: "warning", icon: "audit" },
    { id: "act-nu-2", title: "Fix published, verification pending", detail: "task-nu-005 · Organization schema sameAs added", at: "2026-11-17T04:10:00Z", tone: "info", icon: "fixes" },
    { id: "act-nu-3", title: "Task verified", detail: "task-nu-003 · Noindex tag removed from the course page", at: "2026-11-16T03:12:00Z", tone: "success", icon: "fixes" },
    { id: "act-nu-4", title: "Verification audit completed", detail: "aud-nu-004 · Course page indexing", at: "2026-11-16T03:11:00Z", tone: "success", icon: "check-circle" },
    { id: "act-nu-5", title: "Weekly run completed", detail: "run-nu-006 · 42 / 42 requests succeeded", at: "2026-11-16T01:44:00Z", tone: "success", icon: "monitoring" },
  ],
  threadly: [
    { id: "act-th-1", title: "Triggered audit partially completed", detail: "aud-th-005 · 3 of 12 requests failed", at: "2026-11-18T13:09:00Z", tone: "warning", icon: "audit" },
    { id: "act-th-2", title: "Fix published, verification pending", detail: "task-th-005 · Organization schema sameAs added", at: "2026-11-17T12:10:00Z", tone: "info", icon: "fixes" },
    { id: "act-th-3", title: "Task verified", detail: "task-th-003 · Noindex tag removed from the Summer Linen collection page", at: "2026-11-16T11:12:00Z", tone: "success", icon: "fixes" },
    { id: "act-th-4", title: "Verification audit completed", detail: "aud-th-004 · Summer Linen collection indexing", at: "2026-11-16T11:11:00Z", tone: "success", icon: "check-circle" },
    { id: "act-th-5", title: "Weekly run completed", detail: "run-th-006 · 42 / 42 requests succeeded", at: "2026-11-16T09:44:00Z", tone: "success", icon: "monitoring" },
  ],
  "homefit-uk": [
    { id: "act-uk-1", title: "Website added", detail: "Setup in progress · no AI channel selected", at: "2026-11-10T14:00:00Z", tone: "neutral", icon: "globe" },
  ],
};

/** Authored activity of every website, with the website id attached. */
export async function listActivity(storeId?: string): Promise<ActivityItem[]> {
  return Object.entries(ACTIVITY)
    .filter(([id]) => !storeId || id === storeId)
    .flatMap(([websiteId, items]) => items.map((item) => ({ ...item, websiteId })));
}

export async function getDashboardData(storeId: string): Promise<DashboardData | null> {
  const reg = registryFor(storeId);
  if (reg.runs.length === 0 || reg.schedules.length === 0) return null;

  const latest = reg.runs[reg.runs.length - 1];
  const responses = buildRunResponses(latest.id).filter((r) => r.status === "succeeded");
  const competitors = DEMO_COMPETITORS.filter((c) => c.storeId === storeId && c.status !== "archived")
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      n: responses.filter((r) => r.competitors.some((x) => x.name === c.name && x.mentioned)).length,
      d: responses.length,
    }))
    .sort((a, b) => b.n - a.n);

  const newestCompleted = [...reg.comparisons]
    .filter((c) => c.status === "completed" || c.status === "completed_with_warnings")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const cmp = newestCompleted ? await getComparisonDetail(storeId, newestCompleted.id) : null;
  const openAudit = reg.audits.find((a) => a.status === "in_progress") ?? null;
  const schedule = reg.schedules.find((s) => s.status === "active") ?? reg.schedules[0];
  const store = DEMO_STORES.find((s) => s.id === storeId);
  const prompts = ALL_PROMPTS.filter((p) => p.storeId === storeId);

  return {
    storeId,
    trend: reg.runs.map((r) => ({ runId: r.id, date: r.scheduledFor, mention: r.mention, recommendation: r.recommendation })),
    findings: DEMO_FINDINGS.filter((f) => f.storeId === storeId).map((f) => ({ id: f.id, storeId, title: f.title, priority: f.priority, severity: f.severity, status: f.status, promptId: f.affectedPromptIds[0], taskId: f.taskIds[0] })),
    tasks: reg.tasks.map((t) => ({ id: t.id, storeId, title: t.title, status: t.status, findingId: t.findingId, priority: t.priority, dueAt: t.dueAt })),
    competitors,
    alerts: DEMO_ALERTS.filter((a) => a.storeId === storeId),
    lastRun: { id: latest.id, scheduledFor: latest.scheduledFor, status: latest.status, succeededJobs: latest.succeededJobs, plannedJobs: latest.plannedJobs },
    schedule: { id: schedule.id, name: schedule.name, status: schedule.status, nextRunAt: schedule.nextRunAt },
    inProgressAudit: openAudit ? { id: openAudit.id, title: openAudit.title, done: openAudit.succeededJobs + openAudit.failedJobs, planned: openAudit.plannedJobs } : null,
    channelCount: store?.channelIds.length ?? 0,
    prompts,
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
    activity: (await listActivity(storeId)),
  };
}

export type WebsiteTask = { id: string; storeId: string; title: string; status: string };

/** Task rows across websites for the websites list (tasks only: id, website, title, status). */
export async function listWebsiteTasks(): Promise<WebsiteTask[]> {
  return DEMO_STORES.flatMap((s) => registryFor(s.id).tasks.map((t) => ({ id: t.id, storeId: s.id, title: t.title, status: t.status })));
}
