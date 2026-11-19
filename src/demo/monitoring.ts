/**
 * DEMONSTRATION DATA — not real. Monitoring module.
 *
 * Schedules sch-001…003 and runs run-001…008 come from src/demo/registry.ts (ids,
 * statuses, headline numbers). Everything here adds detail around them: schedule
 * configuration + version history, event/alert specs, usage caps, and a small
 * schedule for runpro-ae. Job-level data is NOT authored here: it is derived by
 * src/services/monitoring.ts from the shared response generator, so totals agree.
 *
 * Fixed timestamps only. Read this through src/services/monitoring.ts.
 */
import type { AlertSeverity } from "@/types/core";
import type {
  AlertRules,
  AlertStatus,
  DeliveryRow,
  EventType,
  MonitoringSchedule,
  RunStatus,
  ScheduleConfig,
  ScheduleVersion,
  UsageCaps,
} from "@/types/monitoring";

export const ALL_EVENT_TYPES: EventType[] = [
  "new_mention",
  "lost_mention",
  "new_recommendation",
  "lost_recommendation",
  "owned_citation_gained",
  "owned_citation_lost",
  "sentiment_shift",
  "competitor_increase",
  "competitor_decrease",
  "rank_movement",
  "provider_error_spike",
  "run_incomplete",
  "run_late",
];

const SANA = "Sana Iqbal";
const OMAR = "Omar Farooq";
const HIRA = "Hira Malik";

const EMAILS = ["sana@northstar.example", "omar@northstar.example"];
const WEBHOOK = "https://hooks.northstar.example/rankvora";

const rulesV1: AlertRules = {
  categories: ALL_EVENT_TYPES,
  threshold: "Any change",
  persistence: { required: 1, window: 1 },
  cooldownHours: 12,
  quietHours: { enabled: false, from: "22:00", to: "07:00" },
};
const rulesV2: AlertRules = {
  categories: ALL_EVENT_TYPES,
  threshold: "Any change in a ≥ 2-sample prompt",
  persistence: { required: 2, window: 3 },
  cooldownHours: 24,
  quietHours: { enabled: true, from: "22:00", to: "07:00" },
};

const PK_PROMPTS = ["p-001", "p-002", "p-003", "p-004", "p-005", "p-006", "p-007", "p-008", "p-009"];

const sch001Base: ScheduleConfig = {
  promptMode: "latest",
  promptIds: PK_PROMPTS,
  promptCount: 9,
  pinnedVersions: {},
  channelIds: ["ch-openai", "ch-gemini", "ch-perplexity"],
  market: "PK",
  language: "en",
  frequency: { kind: "weekly", weekday: 2, runsPerMonth: 4.33 },
  timezone: "Asia/Karachi",
  localTime: "09:00",
  samples: 2,
  windowMinutes: 60,
  maxConcurrency: 3,
  retry: { maxAttempts: 3, backoffSeconds: 30 },
  usageCap: { jobsPerMonth: 600, costUsd: 20 },
  alerts: rulesV1,
  notify: { inApp: true, email: EMAILS, webhook: WEBHOOK },
};

const sch001V2: ScheduleConfig = { ...sch001Base, windowMinutes: 90, alerts: rulesV2 };

const sch001Versions: ScheduleVersion[] = [
  { version: 2, createdAt: "2026-10-15T08:20:00Z", createdBy: OMAR, changes: ["Run window 60 → 90 min", "Alert persistence: confirm repeat 2 of 3 runs (was 1 of 1)", "Cooldown 12 → 24 h", "Quiet hours 22:00–07:00 on"], config: sch001V2 },
  { version: 1, createdAt: "2026-09-22T10:05:00Z", createdBy: SANA, changes: ["Created: 9 prompts × 3 channels × 2 samples", "Weekly · Tue 09:00 Asia/Karachi"], config: sch001Base },
];

const sch002Config: ScheduleConfig = {
  promptMode: "latest",
  promptIds: ["p-001", "p-002", "p-003", "p-005", "p-006"],
  promptCount: 5,
  pinnedVersions: {},
  channelIds: ["ch-openai"],
  market: "PK",
  language: "en",
  frequency: { kind: "daily", runsPerMonth: 30 },
  timezone: "Asia/Karachi",
  localTime: "08:00",
  samples: 1,
  windowMinutes: 30,
  maxConcurrency: 2,
  retry: { maxAttempts: 2, backoffSeconds: 20 },
  usageCap: { jobsPerMonth: 200, costUsd: 8 },
  alerts: { ...rulesV2, cooldownHours: 24 },
  notify: { inApp: true, email: [EMAILS[0]], webhook: null },
};

const sch003Config: ScheduleConfig = {
  promptMode: "pinned",
  promptIds: ["p-006", "p-013"],
  promptCount: 2,
  pinnedVersions: { "p-006": 1, "p-013": 1 },
  channelIds: ["ch-gemini", "ch-perplexity"],
  market: "PK",
  language: "en",
  frequency: { kind: "monthly", dayOfMonth: 1, runsPerMonth: 1 },
  timezone: "Asia/Karachi",
  localTime: "10:00",
  samples: 1,
  windowMinutes: 45,
  maxConcurrency: 2,
  retry: { maxAttempts: 3, backoffSeconds: 30 },
  usageCap: { jobsPerMonth: 20, costUsd: 2 },
  alerts: { ...rulesV2, categories: ["new_mention", "lost_mention", "owned_citation_gained", "owned_citation_lost", "provider_error_spike", "run_incomplete"] },
  notify: { inApp: true, email: [], webhook: null },
};

const schAeConfig: ScheduleConfig = {
  promptMode: "latest",
  promptIds: [],
  promptCount: 5,
  pinnedVersions: {},
  channelIds: ["ch-openai", "ch-gemini"],
  market: "AE",
  language: "en",
  frequency: { kind: "weekly", weekday: 3, runsPerMonth: 4.33 },
  timezone: "Asia/Dubai",
  localTime: "09:00",
  samples: 3,
  windowMinutes: 60,
  maxConcurrency: 3,
  retry: { maxAttempts: 3, backoffSeconds: 30 },
  usageCap: { jobsPerMonth: 160, costUsd: 12 },
  alerts: rulesV2,
  notify: { inApp: true, email: [EMAILS[0]], webhook: null },
};

/** Per-schedule fields not held in the registry (config, versions). Merged with REGISTRY_SCHEDULES by the service. */
export const SCHEDULE_DETAILS: Record<string, { createdAt: string; createdBy: string; statusReason: string | null; versions: ScheduleVersion[] }> = {
  "sch-001": { createdAt: "2026-09-22T10:05:00Z", createdBy: SANA, statusReason: null, versions: sch001Versions },
  "sch-002": {
    createdAt: "2026-11-12T09:40:00Z",
    createdBy: HIRA,
    statusReason: "Paused by Hira Malik on 12 Nov, before the first run.",
    versions: [{ version: 1, createdAt: "2026-11-12T09:40:00Z", createdBy: HIRA, changes: ["Created: 5 core prompts × OpenAI × 1 sample", "Daily · 08:00 Asia/Karachi"], config: sch002Config }],
  },
  "sch-003": {
    createdAt: "2026-11-05T11:15:00Z",
    createdBy: OMAR,
    statusReason: "Prompt p-013 is paused, so it will be skipped. 1 of 2 prompts is active.",
    versions: [{ version: 1, createdAt: "2026-11-05T11:15:00Z", createdBy: OMAR, changes: ["Created: 2 local prompts × Gemini + Perplexity × 1 sample", "Monthly · 1st 10:00 Asia/Karachi", "Prompt versions pinned"], config: sch003Config }],
  },
  "sch-ae-001": {
    createdAt: "2026-11-04T10:30:00Z",
    createdBy: SANA,
    statusReason: null,
    versions: [{ version: 1, createdAt: "2026-11-04T10:30:00Z", createdBy: SANA, changes: ["Created: 5 prompts × OpenAI + Gemini × 3 samples", "Weekly · Wed 09:00 Asia/Dubai"], config: schAeConfig }],
  },
};

/** Schedules for stores other than runpro-pk (pk schedules live in the registry). */
export const EXTRA_SCHEDULES: Omit<MonitoringSchedule, "versions" | "createdAt" | "createdBy" | "statusReason" | "currentVersion">[] = [
  { id: "sch-ae-001", storeId: "runpro-ae", name: "RunPro UAE weekly check", status: "active", nextRunAt: "2026-11-25T05:00:00Z" },
];

/** Which schedule version produced a run, by schedule id and run time. */
export function scheduleVersionAt(scheduleId: string, iso: string): number {
  if (scheduleId === "sch-001") return Date.parse(iso) >= Date.parse("2026-10-15T08:20:00Z") ? 2 : 1;
  return 1;
}

/** Runs of other stores (no job-level records in the demo). Summary numbers match StoreSummary. */
export type AuthoredRun = {
  id: string;
  storeId: string;
  scheduleId: string;
  scheduledFor: string;
  status: RunStatus;
  mention: { n: number; d: number };
  recommendation: { n: number; d: number };
  planned: number;
  succeeded: number;
  failed: number;
  costUsd: number;
  durationSeconds: number;
  snapshotId: string;
};

export const EXTRA_RUNS: AuthoredRun[] = [
  { id: "run-ae-001", storeId: "runpro-ae", scheduleId: "sch-ae-001", scheduledFor: "2026-11-11T05:00:00Z", status: "completed", mention: { n: 6, d: 30 }, recommendation: { n: 3, d: 30 }, planned: 30, succeeded: 30, failed: 0, costUsd: 2.0, durationSeconds: 1380, snapshotId: "snap-mon-ae-001" },
  { id: "run-ae-002", storeId: "runpro-ae", scheduleId: "sch-ae-001", scheduledFor: "2026-11-18T05:00:00Z", status: "completed", mention: { n: 9, d: 30 }, recommendation: { n: 3, d: 30 }, planned: 30, succeeded: 30, failed: 0, costUsd: 2.1, durationSeconds: 1410, snapshotId: "snap-mon-ae-002" },
];

/** Monthly monitoring budget for runpro-pk (set on the schedules' usage caps). Per-provider request cap is per month. */
export const USAGE_CAPS: Record<string, UsageCaps & { providerRequests: number }> = {
  "runpro-pk": { requests: 600, samples: 450, searchCalls: 300, tokens: 150_000, costUsd: 20, providerRequests: 250 },
  "runpro-ae": { requests: 300, samples: 240, searchCalls: 160, tokens: 80_000, costUsd: 12, providerRequests: 150 },
};

/** Calendar periods used on the Usage tab. Run ids per period (runs are weekly, Tuesday). */
export const USAGE_PERIODS: { id: string; label: string; runIds: string[] }[] = [
  { id: "2026-11", label: "Nov 2026 (to 19 Nov)", runIds: ["run-006", "run-007", "run-008"] },
  { id: "2026-10", label: "Oct 2026", runIds: ["run-002", "run-003", "run-004", "run-005"] },
  { id: "2026-09", label: "Sep 2026", runIds: ["run-001"] },
];

/** Monitoring-relevant timeline markers on the trend chart (x = run date label is resolved by the service). */
export const TIMELINE_MARKERS: { runId: string; label: string }[] = [
  { runId: "run-004", label: "p-003 v3 in use" },
  { runId: "run-005", label: "Gemini timeouts" },
];

// ---------------------------------------------------------------------------
// Events and alerts
// ---------------------------------------------------------------------------

export type SlotRef = { runId: string; promptId: string; channelId: string; sample: number };

export type AlertSpec = {
  severity: AlertSeverity;
  status: AlertStatus;
  delivery: DeliveryRow[];
  cooldown: string;
  persistence: { rule: string; progress: string } | null;
  handledBy: string | null;
};

export type EventSpec = {
  id: string;
  storeId: string;
  type: EventType;
  runId: string;
  at: string;
  /** Headline id (al-…) when this event raised one of the shared alerts. */
  headlineId: string | null;
  /** Title for events whose alert is not in the shared headline list. */
  title?: string;
  /** Slot-level evidence, resolved from the response generator by the service. */
  previous?: SlotRef;
  current?: SlotRef;
  /** Aggregate evidence the service computes from the run's responses. */
  metric?: "run_incomplete" | "error_spike" | "avg_position" | "competitor_citations" | "integration";
  /** For aggregate evidence: the compared runs and the provider (if any). */
  compare?: { previousRunId: string | null; channelId?: string };
  summary: string;
  note?: string;
  alert: AlertSpec | null;
};

const inApp = (status: DeliveryRow["status"], detail = ""): DeliveryRow => ({ channel: "in_app", status, detail });
const email = (status: DeliveryRow["status"], detail = ""): DeliveryRow => ({ channel: "email", status, detail });
const webhook = (status: DeliveryRow["status"], detail = ""): DeliveryRow => ({ channel: "webhook", status, detail });

const SAMPLE_NOTE = "Samples vary between runs. Read this as a count across samples, not as one answer.";

export const EVENT_SPECS: EventSpec[] = [
  {
    id: "ev-001",
    storeId: "runpro-pk",
    type: "new_mention",
    runId: "run-008",
    at: "2026-11-17T04:41:00Z",
    headlineId: "al-001",
    previous: { runId: "run-007", promptId: "p-001", channelId: "ch-openai", sample: 1 },
    current: { runId: "run-008", promptId: "p-001", channelId: "ch-openai", sample: 2 },
    summary: "A sample names the brand where the compared previous sample did not.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "new",
      delivery: [inApp("sent", "04:41 UTC"), email("sent", "Digest · 05:00 UTC"), webhook("failed", "HTTP 502 · retry exhausted")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: null,
    },
  },
  {
    id: "ev-002",
    storeId: "runpro-pk",
    type: "lost_mention",
    runId: "run-008",
    at: "2026-11-17T04:44:00Z",
    headlineId: "al-002",
    previous: { runId: "run-007", promptId: "p-002", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-008", promptId: "p-002", channelId: "ch-gemini", sample: 2 },
    summary: "One Gemini sample no longer names the brand. Candidate until the repeat rule is met.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "high",
      status: "new",
      delivery: [inApp("sent", "04:44 UTC"), email("sent", "04:45 UTC"), webhook("retrying", "Attempt 2 of 3")],
      cooldown: "24 h per prompt × provider. 1 duplicate suppressed.",
      persistence: { rule: "Confirm repeat 2 of 3 runs", progress: "Seen in 1 of 3 runs. Next check: run on 24 Nov." },
      handledBy: null,
    },
  },
  {
    id: "ev-003",
    storeId: "runpro-pk",
    type: "owned_citation_gained",
    runId: "run-008",
    at: "2026-11-17T04:52:00Z",
    headlineId: "al-003",
    previous: { runId: "run-007", promptId: "p-007", channelId: "ch-perplexity", sample: 2 },
    current: { runId: "run-008", promptId: "p-007", channelId: "ch-perplexity", sample: 2 },
    summary: "An owned-domain page is cited in a Perplexity sample for the buying-guide prompt.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "low",
      status: "new",
      delivery: [inApp("sent", "04:52 UTC"), email("pending", "Queued for the weekly digest")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: null,
    },
  },
  {
    id: "ev-004",
    storeId: "runpro-pk",
    type: "new_recommendation",
    runId: "run-008",
    at: "2026-11-17T04:40:00Z",
    headlineId: null,
    title: "New recommendation: “RunPro versus Brand X” on Gemini",
    previous: { runId: "run-007", promptId: "p-003", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-008", promptId: "p-003", channelId: "ch-gemini", sample: 1 },
    summary: "Sample 1 moved from a plain mention to a recommendation.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-005",
    storeId: "runpro-pk",
    type: "sentiment_shift",
    runId: "run-008",
    at: "2026-11-17T04:40:00Z",
    headlineId: null,
    title: "Sentiment shift: mixed → positive on “RunPro versus Brand X” (Gemini)",
    previous: { runId: "run-007", promptId: "p-003", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-008", promptId: "p-003", channelId: "ch-gemini", sample: 1 },
    summary: "Same slot as the new recommendation. Sentiment is classified per answer.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-006",
    storeId: "runpro-pk",
    type: "new_mention",
    runId: "run-008",
    at: "2026-11-17T04:52:00Z",
    headlineId: null,
    title: "New mention: “How should a beginner choose the correct running shoe?” on Perplexity",
    previous: { runId: "run-007", promptId: "p-007", channelId: "ch-perplexity", sample: 2 },
    current: { runId: "run-008", promptId: "p-007", channelId: "ch-perplexity", sample: 2 },
    summary: "A previously empty sample now names the brand.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-007",
    storeId: "runpro-pk",
    type: "run_incomplete",
    runId: "run-008",
    at: "2026-11-17T05:12:00Z",
    headlineId: "al-005",
    metric: "run_incomplete",
    compare: { previousRunId: "run-007" },
    summary: "Some jobs failed after retries. They are excluded from rates and not treated as brand absent.",
    alert: {
      severity: "info",
      status: "resolved",
      delivery: [inApp("sent", "05:12 UTC")],
      cooldown: "1 per run.",
      persistence: null,
      handledBy: "Auto-resolved: failures below the 15% threshold",
    },
  },
  {
    id: "ev-008",
    storeId: "runpro-pk",
    type: "new_mention",
    runId: "run-007",
    at: "2026-11-10T04:45:00Z",
    headlineId: null,
    title: "New mention: “Where can I buy beginner running shoes in Lahore?” on Perplexity",
    previous: { runId: "run-006", promptId: "p-006", channelId: "ch-perplexity", sample: 1 },
    current: { runId: "run-007", promptId: "p-006", channelId: "ch-perplexity", sample: 1 },
    summary: "A previously empty sample now names the brand.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-009",
    storeId: "runpro-pk",
    type: "new_mention",
    runId: "run-006",
    at: "2026-11-03T04:44:00Z",
    headlineId: null,
    title: "New mention: “Which affordable running shoes would you recommend…” on OpenAI",
    previous: { runId: "run-005", promptId: "p-002", channelId: "ch-openai", sample: 1 },
    current: { runId: "run-006", promptId: "p-002", channelId: "ch-openai", sample: 1 },
    summary: "A previously empty sample now names the brand and cites the owned domain.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-010",
    storeId: "runpro-pk",
    type: "provider_error_spike",
    runId: "run-005",
    at: "2026-10-27T04:50:00Z",
    headlineId: null,
    title: "Gemini error spike: 9 jobs timed out in the 27 Oct run",
    metric: "error_spike",
    compare: { previousRunId: "run-004", channelId: "ch-gemini" },
    summary: "Half of the Gemini jobs failed. Rates for that run use only successful responses.",
    alert: {
      severity: "high",
      status: "resolved",
      delivery: [inApp("sent", "04:50 UTC"), email("sent", "04:51 UTC"), webhook("sent", "HTTP 200")],
      cooldown: "24 h per provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Omar Farooq · Gemini healthy in the next run",
    },
  },
  {
    id: "ev-011",
    storeId: "runpro-pk",
    type: "lost_mention",
    runId: "run-005",
    at: "2026-10-27T04:47:00Z",
    headlineId: null,
    title: "Lost mention candidate: “Where can I buy beginner running shoes in Lahore?” on Gemini",
    previous: { runId: "run-004", promptId: "p-006", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-005", promptId: "p-006", channelId: "ch-gemini", sample: 1 },
    summary: "Not confirmed: the brand was named again in the next run.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "04:47 UTC"), email("sent", "04:48 UTC")],
      cooldown: "12 h per prompt × provider. 0 duplicates suppressed.",
      persistence: { rule: "Confirm repeat 2 of 3 runs", progress: "Not confirmed: seen in 1 of 3 runs, mentioned again on 3 Nov." },
      handledBy: "Resolved by Hira Malik · not confirmed",
    },
  },
  {
    id: "ev-012",
    storeId: "runpro-pk",
    type: "owned_citation_lost",
    runId: "run-005",
    at: "2026-10-27T04:47:00Z",
    headlineId: null,
    title: "Owned citation lost: “Where can I buy beginner running shoes in Lahore?” on Gemini",
    previous: { runId: "run-004", promptId: "p-006", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-005", promptId: "p-006", channelId: "ch-gemini", sample: 1 },
    summary: "The owned page was not cited in this sample. Muted while the lost-mention candidate was open.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "low",
      status: "muted",
      delivery: [inApp("sent", "04:47 UTC")],
      cooldown: "24 h per prompt × provider. Muted until 3 Nov.",
      persistence: null,
      handledBy: "Muted by Hira Malik",
    },
  },
  {
    id: "ev-013",
    storeId: "runpro-pk",
    type: "rank_movement",
    runId: "run-005",
    at: "2026-10-27T04:55:00Z",
    headlineId: null,
    title: "Rank movement: average list position 1.8 → 2.1",
    metric: "avg_position",
    compare: { previousRunId: "run-004" },
    summary: "Average position in ordered lists moved down. Two Gemini lists were not available in this run.",
    alert: {
      severity: "low",
      status: "resolved",
      delivery: [inApp("sent", "04:55 UTC")],
      cooldown: "7 d per store.",
      persistence: null,
      handledBy: "Resolved by Omar Farooq · position recovered on 3 Nov",
    },
  },
  {
    id: "ev-014",
    storeId: "runpro-pk",
    type: "new_recommendation",
    runId: "run-004",
    at: "2026-10-20T04:46:00Z",
    headlineId: null,
    title: "New recommendation: “Which RunPro shoe is suitable for long-distance running?” on Perplexity",
    previous: { runId: "run-003", promptId: "p-005", channelId: "ch-perplexity", sample: 1 },
    current: { runId: "run-004", promptId: "p-005", channelId: "ch-perplexity", sample: 1 },
    summary: "Sample 1 moved from a plain mention to a recommendation.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "04:46 UTC"), email("sent", "04:47 UTC")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Sana Iqbal",
    },
  },
  {
    id: "ev-015",
    storeId: "runpro-pk",
    type: "competitor_increase",
    runId: "run-003",
    at: "2026-10-13T04:49:00Z",
    headlineId: null,
    title: "Competitor increase: competitor-domain citations 56% → 60%",
    metric: "competitor_citations",
    compare: { previousRunId: "run-002" },
    summary: "More answers cited a competitor domain. This is context for review, not a cause.",
    alert: {
      severity: "low",
      status: "resolved",
      delivery: [inApp("sent", "04:49 UTC")],
      cooldown: "7 d per competitor.",
      persistence: null,
      handledBy: "Resolved by Omar Farooq",
    },
  },
  {
    id: "ev-ae-001",
    storeId: "runpro-ae",
    type: "integration_attention",
    runId: "run-ae-002",
    at: "2026-11-18T05:30:00Z",
    headlineId: "al-004",
    metric: "integration",
    summary: "The commerce connection for this store needs attention. Monitoring itself is not affected.",
    alert: {
      severity: "medium",
      status: "read",
      delivery: [inApp("sent", "05:30 UTC"), email("sent", "05:31 UTC")],
      cooldown: "24 h per integration.",
      persistence: null,
      handledBy: null,
    },
  },
];
