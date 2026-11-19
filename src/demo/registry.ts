/**
 * DEMONSTRATION DATA — not real.
 *
 * Cross-module registry for store "runpro-pk". Every module (Audit, Fixes,
 * Monitoring, Comparison, Reports, Dashboard) MUST use these ids, titles,
 * dates, statuses and headline numbers so the product tells one consistent
 * story. Modules add their own detail around these records, never contradict them.
 *
 * Fixed timestamps only. "Now" is 2026-11-19T09:00:00Z (see DEMO_NOW).
 */
import type { Rate } from "@/types/core";

export const RP = "runpro-pk";

/** 9 active prompts × 3 channels × 2 samples = 54 planned jobs per full run. */
export const PLANNED_JOBS_PER_RUN = 54;

export type RegistryAudit = {
  id: string;
  title: string;
  type: "initial" | "full" | "focused" | "verification" | "triggered" | "scheduled";
  lanes: ("ai_visibility" | "website_readiness")[];
  status: "completed" | "completed_with_warnings" | "in_progress" | "partially_completed";
  startedAt: string;
  completedAt: string | null;
  snapshotId: string | null;
  /** AI lane headline (successful, eligible responses). */
  mention: Rate | null;
  recommendation: Rate | null;
  plannedJobs: number;
  succeededJobs: number;
  failedJobs: number;
  findingsCreated: number;
  /** Website lane: pages assessed / discovered in-scope. */
  pages: Rate | null;
  createdBy: string;
};

export const REGISTRY_AUDITS: RegistryAudit[] = [
  {
    id: "aud-004",
    title: "Full audit — November",
    type: "full",
    lanes: ["ai_visibility", "website_readiness"],
    status: "in_progress",
    startedAt: "2026-11-19T08:42:00Z",
    completedAt: null,
    snapshotId: null,
    mention: null,
    recommendation: null,
    plannedJobs: 54,
    succeededJobs: 31,
    failedJobs: 2,
    findingsCreated: 0,
    pages: { n: 61, d: 120 },
    createdBy: "Sana Iqbal",
  },
  {
    id: "aud-003",
    title: "Verification — Glide 2 product facts",
    type: "verification",
    lanes: ["ai_visibility", "website_readiness"],
    status: "completed",
    startedAt: "2026-11-12T07:10:00Z",
    completedAt: "2026-11-12T07:29:00Z",
    snapshotId: "snap-aud-003",
    mention: { n: 5, d: 6 },
    recommendation: { n: 2, d: 6 },
    plannedJobs: 6,
    succeededJobs: 6,
    failedJobs: 0,
    findingsCreated: 1,
    pages: { n: 8, d: 8 },
    createdBy: "Bilal Ahmed",
  },
  {
    id: "aud-002",
    title: "Full audit — October",
    type: "full",
    lanes: ["ai_visibility", "website_readiness"],
    status: "completed_with_warnings",
    startedAt: "2026-10-20T05:00:00Z",
    completedAt: "2026-10-20T05:51:00Z",
    snapshotId: "snap-aud-002",
    mention: { n: 21, d: 48 },
    recommendation: { n: 9, d: 48 },
    plannedJobs: 54,
    succeededJobs: 48,
    failedJobs: 6,
    findingsCreated: 5,
    pages: { n: 112, d: 120 },
    createdBy: "Sana Iqbal",
  },
  {
    id: "aud-001",
    title: "Initial audit",
    type: "initial",
    lanes: ["ai_visibility", "website_readiness"],
    status: "completed",
    startedAt: "2026-08-12T06:00:00Z",
    completedAt: "2026-08-12T06:38:00Z",
    snapshotId: "snap-aud-001",
    mention: { n: 18, d: 48 },
    recommendation: { n: 8, d: 48 },
    plannedJobs: 54,
    succeededJobs: 48,
    failedJobs: 6,
    findingsCreated: 3,
    pages: { n: 103, d: 120 },
    createdBy: "Sana Iqbal",
  },
];

export type RegistryRun = {
  id: string;
  scheduleId: string;
  scheduledFor: string;
  status: "completed" | "completed_with_warnings" | "partially_completed" | "failed" | "running" | "skipped";
  /** Successful, eligible analysed responses. */
  mention: Rate;
  recommendation: Rate;
  plannedJobs: number;
  succeededJobs: number;
  failedJobs: number;
  snapshotId: string;
  costUsd: number;
};

const runRow = (
  n: number,
  date: string,
  mention: Rate,
  rec: Rate,
  failed: number,
  status: RegistryRun["status"] = "completed",
  cost = 3.2,
): RegistryRun => ({
  id: `run-00${n}`,
  scheduleId: "sch-001",
  scheduledFor: `${date}T04:00:00Z`,
  status,
  mention,
  recommendation: rec,
  plannedJobs: 54,
  succeededJobs: 54 - failed,
  failedJobs: failed,
  snapshotId: `snap-mon-00${n}`,
  costUsd: cost,
});

/** Weekly runs of schedule sch-001, oldest → newest. run-008 is the latest. */
export const REGISTRY_RUNS: RegistryRun[] = [
  runRow(1, "2026-09-29", { n: 19, d: 46 }, { n: 7, d: 46 }, 8, "completed_with_warnings", 3.0),
  runRow(2, "2026-10-06", { n: 20, d: 48 }, { n: 8, d: 48 }, 6, "completed_with_warnings", 3.1),
  runRow(3, "2026-10-13", { n: 18, d: 47 }, { n: 8, d: 47 }, 7, "completed_with_warnings", 3.1),
  runRow(4, "2026-10-20", { n: 22, d: 48 }, { n: 9, d: 48 }, 6, "completed_with_warnings", 3.2),
  runRow(5, "2026-10-27", { n: 21, d: 45 }, { n: 9, d: 45 }, 9, "completed_with_warnings", 3.1),
  runRow(6, "2026-11-03", { n: 23, d: 48 }, { n: 10, d: 48 }, 6, "completed_with_warnings", 3.3),
  runRow(7, "2026-11-10", { n: 24, d: 48 }, { n: 10, d: 48 }, 6, "completed_with_warnings", 3.3),
  runRow(8, "2026-11-17", { n: 25, d: 48 }, { n: 11, d: 48 }, 6, "completed_with_warnings", 3.4),
];

export const REGISTRY_SCHEDULES = [
  { id: "sch-001", name: "RunPro weekly visibility check", frequency: "Weekly · Tue 09:00", timezone: "Asia/Karachi", status: "active" as const, promptCount: 9, channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"], samples: 2, nextRunAt: "2026-11-24T04:00:00Z" },
  { id: "sch-002", name: "Core prompts — daily OpenAI check", frequency: "Daily · 08:00", timezone: "Asia/Karachi", status: "paused" as const, promptCount: 5, channelIds: ["ch-openai"], samples: 1, nextRunAt: null },
  { id: "sch-003", name: "Local prompts — monthly", frequency: "Monthly · 1st 10:00", timezone: "Asia/Karachi", status: "needs_attention" as const, promptCount: 2, channelIds: ["ch-gemini", "ch-perplexity"], samples: 1, nextRunAt: "2026-12-01T05:00:00Z" },
];

export type RegistryComparison = {
  id: string;
  title: string;
  type: "snapshot_vs_snapshot" | "period_vs_period" | "initial_vs_latest" | "before_after_fixes" | "platform";
  baseline: string;
  current: string;
  status: "completed" | "completed_with_warnings" | "partially_comparable" | "not_comparable" | "insufficient_data";
  comparability: "comparable" | "partially_comparable" | "comparable_with_warnings" | "not_comparable" | "insufficient_data";
  createdAt: string;
  createdBy: string;
  methodologyVersion: string;
};

export const REGISTRY_COMPARISONS: RegistryComparison[] = [
  { id: "cmp-001", title: "Initial audit vs latest monitoring", type: "initial_vs_latest", baseline: "snap-aud-001", current: "snap-mon-008", status: "completed_with_warnings", comparability: "partially_comparable", createdAt: "2026-11-18T09:12:00Z", createdBy: "Sana Iqbal", methodologyVersion: "1.0" },
  { id: "cmp-002", title: "October vs November (monitoring)", type: "period_vs_period", baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19", status: "completed", comparability: "comparable", createdAt: "2026-11-18T10:30:00Z", createdBy: "Hira Malik", methodologyVersion: "1.0" },
  { id: "cmp-003", title: "Before vs after: Glide 2 product facts", type: "before_after_fixes", baseline: "snap-aud-002", current: "snap-aud-003", status: "insufficient_data", comparability: "insufficient_data", createdAt: "2026-11-13T08:00:00Z", createdBy: "Bilal Ahmed", methodologyVersion: "1.0" },
  { id: "cmp-004", title: "Audit August vs audit October", type: "snapshot_vs_snapshot", baseline: "snap-aud-001", current: "snap-aud-002", status: "partially_comparable", comparability: "comparable_with_warnings", createdAt: "2026-10-22T11:00:00Z", createdBy: "Omar Farooq", methodologyVersion: "1.0" },
];

export type RegistryTask = {
  id: string;
  title: string;
  findingId: string;
  status:
    | "suggested"
    | "pending_approval"
    | "approved"
    | "queued"
    | "in_progress"
    | "blocked"
    | "draft_ready"
    | "staged"
    | "applied"
    | "published"
    | "verification_pending"
    | "verified_success"
    | "partially_verified"
    | "failed"
    | "rolled_back"
    | "rejected"
    | "superseded";
  assignee: string | null;
  dueAt: string | null;
  mode: "guidance" | "ai_draft" | "cms_staged" | "approved_apply";
  risk: "low" | "medium" | "high" | "critical";
  priority: "P0" | "P1" | "P2" | "P3";
};

/** 6 of these are open → matches the store summary "pending tasks". */
export const REGISTRY_TASKS: RegistryTask[] = [
  { id: "task-001", title: "Add running-surface and cushioning facts to Glide 2 page", findingId: "fnd-001", status: "draft_ready", assignee: "Hira Malik", dueAt: "2026-11-24T00:00:00Z", mode: "ai_draft", risk: "medium", priority: "P2" },
  { id: "task-002", title: "Correct Glide 2 structured-data price", findingId: "fnd-002", status: "pending_approval", assignee: "Omar Farooq", dueAt: "2026-11-21T00:00:00Z", mode: "approved_apply", risk: "high", priority: "P1" },
  { id: "task-003", title: "Replace two broken internal links on collection pages", findingId: "fnd-003", status: "queued", assignee: "Hira Malik", dueAt: "2026-11-26T00:00:00Z", mode: "cms_staged", risk: "low", priority: "P2" },
  { id: "task-004", title: "Publish beginner buying guide", findingId: "fnd-007", status: "verification_pending", assignee: "Hira Malik", dueAt: "2026-11-15T00:00:00Z", mode: "cms_staged", risk: "medium", priority: "P2" },
  { id: "task-005", title: "Add sameAs and contact points to Organization schema", findingId: "fnd-008", status: "verified_success", assignee: "Omar Farooq", dueAt: "2026-11-05T00:00:00Z", mode: "ai_draft", risk: "medium", priority: "P3" },
  { id: "task-006", title: "Review robots.txt rule for OAI-SearchBot", findingId: "fnd-006", status: "blocked", assignee: "Omar Farooq", dueAt: "2026-11-28T00:00:00Z", mode: "guidance", risk: "high", priority: "P1" },
  { id: "task-007", title: "Investigate missing mention on affordable-shoes prompt (Gemini)", findingId: "fnd-004", status: "suggested", assignee: null, dueAt: null, mode: "guidance", risk: "low", priority: "P1" },
  { id: "task-008", title: "Add FAQ block to marathon page", findingId: "fnd-009", status: "rolled_back", assignee: "Hira Malik", dueAt: "2026-11-08T00:00:00Z", mode: "approved_apply", risk: "medium", priority: "P2" },
];

export type RegistryReport = {
  id: string;
  type: "audit" | "monitoring" | "comparison";
  title: string;
  sourceId: string;
  period: string;
  createdAt: string;
  version: string;
  status: "ready" | "generating" | "failed";
};

export const REGISTRY_REPORTS: RegistryReport[] = [
  { id: "rep-cmp-001", type: "comparison", title: "Initial audit vs latest monitoring", sourceId: "cmp-001", period: "12 Aug – 17 Nov 2026", createdAt: "2026-11-18T09:20:00Z", version: "Methodology 1.0", status: "ready" },
  { id: "rep-cmp-002", type: "comparison", title: "October vs November (monitoring)", sourceId: "cmp-002", period: "1 Oct – 19 Nov 2026", createdAt: "2026-11-18T10:40:00Z", version: "Methodology 1.0", status: "ready" },
  { id: "rep-mon-008", type: "monitoring", title: "Weekly monitoring — 17 Nov", sourceId: "run-008", period: "17 Nov 2026", createdAt: "2026-11-17T05:15:00Z", version: "Analysis 1.2", status: "ready" },
  { id: "rep-mon-007", type: "monitoring", title: "Weekly monitoring — 10 Nov", sourceId: "run-007", period: "10 Nov 2026", createdAt: "2026-11-10T05:15:00Z", version: "Analysis 1.2", status: "ready" },
  { id: "rep-aud-003", type: "audit", title: "Verification audit — Glide 2 product facts", sourceId: "aud-003", period: "12 Nov 2026", createdAt: "2026-11-12T07:30:00Z", version: "Criteria 2.1", status: "ready" },
  { id: "rep-aud-002", type: "audit", title: "Full audit — October", sourceId: "aud-002", period: "20 Oct 2026", createdAt: "2026-10-20T05:55:00Z", version: "Criteria 2.0", status: "ready" },
  { id: "rep-aud-001", type: "audit", title: "Initial audit", sourceId: "aud-001", period: "12 Aug 2026", createdAt: "2026-08-12T06:40:00Z", version: "Criteria 1.4", status: "ready" },
  { id: "rep-aud-004", type: "audit", title: "Full audit — November", sourceId: "aud-004", period: "19 Nov 2026", createdAt: "2026-11-19T08:42:00Z", version: "Criteria 2.1", status: "generating" },
];

// ===========================================================================
// Store "runpro-ae" (RunPro UAE). Same shapes and rules as runpro-pk above.
// 5 active prompts × 2 channels (OpenAI, Gemini) × 3 samples = 30 planned jobs per full run.
// Ids are prefixed "-ae-" so they never collide with runpro-pk records.
// ===========================================================================

export const AE = "runpro-ae";
export const PLANNED_JOBS_PER_RUN_AE = 30;

export const REGISTRY_AE_AUDITS: RegistryAudit[] = [
  {
    id: "aud-ae-003",
    title: "Focused audit — Dubai local prompts",
    type: "focused",
    lanes: ["ai_visibility"],
    status: "partially_completed",
    startedAt: "2026-11-14T06:00:00Z",
    completedAt: "2026-11-14T06:12:00Z",
    snapshotId: "snap-aud-ae-003",
    mention: { n: 3, d: 9 },
    recommendation: { n: 1, d: 9 },
    plannedJobs: 12,
    succeededJobs: 9,
    failedJobs: 3,
    findingsCreated: 0,
    pages: null,
    createdBy: "Hira Malik",
  },
  {
    id: "aud-ae-002",
    title: "Full audit — November",
    type: "full",
    lanes: ["ai_visibility", "website_readiness"],
    status: "completed",
    startedAt: "2026-11-05T05:00:00Z",
    completedAt: "2026-11-05T05:41:00Z",
    snapshotId: "snap-aud-ae-002",
    mention: { n: 7, d: 30 },
    recommendation: { n: 3, d: 30 },
    plannedJobs: 30,
    succeededJobs: 30,
    failedJobs: 0,
    findingsCreated: 3,
    pages: { n: 58, d: 60 },
    createdBy: "Hira Malik",
  },
  {
    id: "aud-ae-001",
    title: "Initial audit",
    type: "initial",
    lanes: ["ai_visibility", "website_readiness"],
    status: "completed_with_warnings",
    startedAt: "2026-09-16T05:00:00Z",
    completedAt: "2026-09-16T05:34:00Z",
    snapshotId: "snap-aud-ae-001",
    mention: { n: 4, d: 28 },
    recommendation: { n: 1, d: 28 },
    plannedJobs: 30,
    succeededJobs: 28,
    failedJobs: 2,
    findingsCreated: 3,
    pages: { n: 41, d: 60 },
    createdBy: "Sana Iqbal",
  },
];

const aeRun = (n: number, date: string, mention: Rate, rec: Rate, failed: number, cost: number): RegistryRun => ({
  id: `run-ae-00${n}`,
  scheduleId: "sch-ae-001",
  scheduledFor: `${date}T05:00:00Z`,
  status: failed > 0 ? "completed_with_warnings" : "completed",
  mention,
  recommendation: rec,
  plannedJobs: 30,
  succeededJobs: 30 - failed,
  failedJobs: failed,
  snapshotId: `snap-mon-ae-00${n}`,
  costUsd: cost,
});

/** Weekly runs of schedule sch-ae-001 (Wednesdays 09:00 Dubai), oldest → newest. run-ae-006 is the latest. */
export const REGISTRY_AE_RUNS: RegistryRun[] = [
  aeRun(1, "2026-10-14", { n: 3, d: 30 }, { n: 1, d: 30 }, 0, 2.0),
  aeRun(2, "2026-10-21", { n: 4, d: 29 }, { n: 2, d: 29 }, 1, 2.0),
  aeRun(3, "2026-10-28", { n: 4, d: 30 }, { n: 2, d: 30 }, 0, 2.0),
  aeRun(4, "2026-11-04", { n: 5, d: 28 }, { n: 2, d: 28 }, 2, 2.1),
  aeRun(5, "2026-11-11", { n: 6, d: 30 }, { n: 3, d: 30 }, 0, 2.0),
  aeRun(6, "2026-11-18", { n: 9, d: 30 }, { n: 3, d: 30 }, 0, 2.1),
];

export const REGISTRY_AE_SCHEDULES: typeof REGISTRY_SCHEDULES = [
  { id: "sch-ae-001", name: "RunPro UAE weekly check", frequency: "Weekly · Wed 09:00", timezone: "Asia/Dubai", status: "active", promptCount: 5, channelIds: ["ch-openai", "ch-gemini"], samples: 3, nextRunAt: "2026-11-25T05:00:00Z" },
  { id: "sch-ae-002", name: "Dubai local prompts — daily Gemini", frequency: "Daily · 10:00", timezone: "Asia/Dubai", status: "paused", promptCount: 2, channelIds: ["ch-gemini"], samples: 1, nextRunAt: null },
];

export const REGISTRY_AE_COMPARISONS: RegistryComparison[] = [
  { id: "cmp-ae-001", title: "Initial audit vs latest monitoring", type: "initial_vs_latest", baseline: "snap-aud-ae-001", current: "snap-mon-ae-006", status: "completed_with_warnings", comparability: "partially_comparable", createdAt: "2026-11-18T10:05:00Z", createdBy: "Hira Malik", methodologyVersion: "1.0" },
  { id: "cmp-ae-002", title: "October vs November (monitoring)", type: "period_vs_period", baseline: "2026-10-01 – 2026-10-31", current: "2026-11-01 – 2026-11-19", status: "completed", comparability: "comparable", createdAt: "2026-11-19T07:30:00Z", createdBy: "Sana Iqbal", methodologyVersion: "1.0" },
  { id: "cmp-ae-003", title: "Audit September vs audit November", type: "snapshot_vs_snapshot", baseline: "snap-aud-ae-001", current: "snap-aud-ae-002", status: "completed", comparability: "comparable", createdAt: "2026-11-06T09:00:00Z", createdBy: "Omar Farooq", methodologyVersion: "1.0" },
  { id: "cmp-ae-004", title: "Before vs after: product schema fix", type: "before_after_fixes", baseline: "snap-aud-ae-001", current: "snap-aud-ae-003", status: "insufficient_data", comparability: "insufficient_data", createdAt: "2026-11-15T08:20:00Z", createdBy: "Hira Malik", methodologyVersion: "1.0" },
];

/** 4 of these are open → matches the store summary "pending tasks". */
export const REGISTRY_AE_TASKS: RegistryTask[] = [
  { id: "task-ae-001", title: "Add Product and Offer schema to the WooCommerce product template", findingId: "fnd-ae-001", status: "staged", assignee: "Hira Malik", dueAt: "2026-11-25T00:00:00Z", mode: "cms_staged", risk: "medium", priority: "P1" },
  { id: "task-ae-002", title: "Switch JSON-LD priceCurrency from USD to AED", findingId: "fnd-ae-002", status: "failed", assignee: "Omar Farooq", dueAt: "2026-11-20T00:00:00Z", mode: "approved_apply", risk: "high", priority: "P1" },
  { id: "task-ae-003", title: "Add UAE delivery and returns section to product pages", findingId: "fnd-ae-003", status: "pending_approval", assignee: "Hira Malik", dueAt: "2026-11-27T00:00:00Z", mode: "ai_draft", risk: "low", priority: "P2" },
  { id: "task-ae-004", title: "Review Dubai local citations against GulfRun", findingId: "fnd-ae-004", status: "suggested", assignee: null, dueAt: null, mode: "guidance", risk: "low", priority: "P2" },
  { id: "task-ae-005", title: "Remove redirecting URLs from the sitemap", findingId: "fnd-ae-005", status: "verified_success", assignee: "Omar Farooq", dueAt: "2026-11-08T00:00:00Z", mode: "approved_apply", risk: "low", priority: "P3" },
  { id: "task-ae-006", title: "Rewrite hot-weather guidance on the homepage", findingId: "fnd-ae-006", status: "rejected", assignee: "Hira Malik", dueAt: null, mode: "guidance", risk: "low", priority: "P3" },
];

export const REGISTRY_AE_REPORTS: RegistryReport[] = [
  { id: "rep-cmp-ae-002", type: "comparison", title: "October vs November (monitoring)", sourceId: "cmp-ae-002", period: "1 Oct – 19 Nov 2026", createdAt: "2026-11-19T07:40:00Z", version: "Methodology 1.0", status: "ready" },
  { id: "rep-cmp-ae-001", type: "comparison", title: "Initial audit vs latest monitoring", sourceId: "cmp-ae-001", period: "16 Sep – 18 Nov 2026", createdAt: "2026-11-18T10:15:00Z", version: "Methodology 1.0", status: "ready" },
  { id: "rep-cmp-ae-003", type: "comparison", title: "Audit September vs audit November", sourceId: "cmp-ae-003", period: "16 Sep – 5 Nov 2026", createdAt: "2026-11-06T09:10:00Z", version: "Methodology 1.0", status: "ready" },
  { id: "rep-mon-ae-006", type: "monitoring", title: "Weekly monitoring — 18 Nov", sourceId: "run-ae-006", period: "18 Nov 2026", createdAt: "2026-11-18T05:40:00Z", version: "Analysis 1.2", status: "ready" },
  { id: "rep-mon-ae-005", type: "monitoring", title: "Weekly monitoring — 11 Nov", sourceId: "run-ae-005", period: "11 Nov 2026", createdAt: "2026-11-11T05:40:00Z", version: "Analysis 1.2", status: "ready" },
  { id: "rep-aud-ae-003", type: "audit", title: "Focused audit — Dubai local prompts", sourceId: "aud-ae-003", period: "14 Nov 2026", createdAt: "2026-11-14T06:13:00Z", version: "Criteria 2.1", status: "failed" },
  { id: "rep-aud-ae-002", type: "audit", title: "Full audit — November", sourceId: "aud-ae-002", period: "5 Nov 2026", createdAt: "2026-11-05T05:45:00Z", version: "Criteria 2.1", status: "ready" },
  { id: "rep-aud-ae-001", type: "audit", title: "Initial audit", sourceId: "aud-ae-001", period: "16 Sep 2026", createdAt: "2026-09-16T05:40:00Z", version: "Criteria 1.4", status: "ready" },
];

export type StoreRegistry = {
  audits: RegistryAudit[];
  runs: RegistryRun[];
  schedules: typeof REGISTRY_SCHEDULES;
  comparisons: RegistryComparison[];
  tasks: RegistryTask[];
  reports: RegistryReport[];
  plannedJobsPerRun: number;
};

const EMPTY_REGISTRY: StoreRegistry = { audits: [], runs: [], schedules: [], comparisons: [], tasks: [], reports: [], plannedJobsPerRun: 0 };

const REGISTRIES: Record<string, StoreRegistry> = {
  [RP]: { audits: REGISTRY_AUDITS, runs: REGISTRY_RUNS, schedules: REGISTRY_SCHEDULES, comparisons: REGISTRY_COMPARISONS, tasks: REGISTRY_TASKS, reports: REGISTRY_REPORTS, plannedJobsPerRun: PLANNED_JOBS_PER_RUN },
  [AE]: { audits: REGISTRY_AE_AUDITS, runs: REGISTRY_AE_RUNS, schedules: REGISTRY_AE_SCHEDULES, comparisons: REGISTRY_AE_COMPARISONS, tasks: REGISTRY_AE_TASKS, reports: REGISTRY_AE_REPORTS, plannedJobsPerRun: PLANNED_JOBS_PER_RUN_AE },
};

/** Registry of one store; stores without run history (e.g. homefit-uk) get empty lists. */
export function registryFor(storeId: string): StoreRegistry {
  return REGISTRIES[storeId] ?? EMPTY_REGISTRY;
}

/** Ids of every store that has registry data. */
export const REGISTRY_STORE_IDS = Object.keys(REGISTRIES);
