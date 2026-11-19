/**
 * DEMONSTRATION DATA — not real. Monitoring module.
 *
 * Schedules and runs of every store come from src/demo/registry.ts (ids, statuses,
 * headline numbers): runpro-pk sch-001…003 / run-001…008 and runpro-ae
 * sch-ae-001…002 / run-ae-001…006. Everything here adds detail around them:
 * schedule configuration + version history, event/alert specs, usage caps and
 * usage periods. Job-level data is NOT authored here: it is derived by
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

const AE_PROMPTS = ["p-ae-001", "p-ae-002", "p-ae-003", "p-ae-004", "p-ae-005"];

/** sch-ae-001 version 1 (7 Oct): 5 prompts × OpenAI + Gemini × 3 samples = 30 jobs per run. */
const schAeBase: ScheduleConfig = {
  promptMode: "latest",
  promptIds: AE_PROMPTS,
  promptCount: 5,
  pinnedVersions: {},
  channelIds: ["ch-openai", "ch-gemini"],
  market: "AE",
  language: "en",
  frequency: { kind: "weekly", weekday: 3, runsPerMonth: 4.33 },
  timezone: "Asia/Dubai",
  localTime: "09:00",
  samples: 3,
  windowMinutes: 45,
  maxConcurrency: 2,
  retry: { maxAttempts: 3, backoffSeconds: 30 },
  usageCap: { jobsPerMonth: 160, costUsd: 12 },
  alerts: rulesV1,
  notify: { inApp: true, email: [EMAILS[0]], webhook: null },
};

/** Version 2 (30 Oct): longer window, more concurrency, confirm-repeat alert rule. */
const schAeV2: ScheduleConfig = { ...schAeBase, windowMinutes: 60, maxConcurrency: 3, alerts: rulesV2 };

const schAeVersions: ScheduleVersion[] = [
  { version: 2, createdAt: "2026-10-30T07:45:00Z", createdBy: OMAR, changes: ["Run window 45 → 60 min", "Max concurrency 2 → 3", "Alert persistence: confirm repeat 2 of 3 runs (was 1 of 1)", "Cooldown 12 → 24 h", "Quiet hours 22:00–07:00 on"], config: schAeV2 },
  { version: 1, createdAt: "2026-10-07T10:30:00Z", createdBy: SANA, changes: ["Created: 5 prompts × OpenAI + Gemini × 3 samples", "Weekly · Wed 09:00 Asia/Dubai"], config: schAeBase },
];

/** sch-ae-002: Dubai local prompts, Gemini only, daily. Paused before its first run. */
const schAe002Config: ScheduleConfig = {
  promptMode: "latest",
  promptIds: ["p-ae-002", "p-ae-005"],
  promptCount: 2,
  pinnedVersions: {},
  channelIds: ["ch-gemini"],
  market: "AE",
  language: "en",
  frequency: { kind: "daily", runsPerMonth: 30 },
  timezone: "Asia/Dubai",
  localTime: "10:00",
  samples: 1,
  windowMinutes: 30,
  maxConcurrency: 2,
  retry: { maxAttempts: 2, backoffSeconds: 20 },
  usageCap: { jobsPerMonth: 80, costUsd: 5 },
  alerts: { ...rulesV2, categories: ["new_mention", "lost_mention", "owned_citation_gained", "owned_citation_lost", "provider_error_spike", "run_incomplete"] },
  notify: { inApp: true, email: [], webhook: null },
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
  "sch-ae-001": { createdAt: "2026-10-07T10:30:00Z", createdBy: SANA, statusReason: null, versions: schAeVersions },
  "sch-ae-002": {
    createdAt: "2026-11-14T09:30:00Z",
    createdBy: HIRA,
    statusReason: "Paused by Hira Malik on 16 Nov, before the first run, until the Gemini rate-limit failures of 4 Nov are reviewed.",
    versions: [{ version: 1, createdAt: "2026-11-14T09:30:00Z", createdBy: HIRA, changes: ["Created: 2 Dubai local prompts × Gemini × 1 sample", "Daily · 10:00 Asia/Dubai"], config: schAe002Config }],
  },
};

/** Which schedule version produced a run, by schedule id and run time. */
export function scheduleVersionAt(scheduleId: string, iso: string): number {
  if (scheduleId === "sch-001") return Date.parse(iso) >= Date.parse("2026-10-15T08:20:00Z") ? 2 : 1;
  if (scheduleId === "sch-ae-001") return Date.parse(iso) >= Date.parse("2026-10-30T07:45:00Z") ? 2 : 1;
  return 1;
}

/** Monthly monitoring budget per store (set on the schedules' usage caps). Per-provider request cap is per month. */
export const USAGE_CAPS: Record<string, UsageCaps & { providerRequests: number }> = {
  "runpro-pk": { requests: 600, samples: 450, searchCalls: 300, tokens: 150_000, costUsd: 20, providerRequests: 250 },
  "runpro-ae": { requests: 300, samples: 240, searchCalls: 160, tokens: 80_000, costUsd: 12, providerRequests: 150 },
};

/** Calendar periods used on the Usage tab, per store. Run ids per period (pk runs Tuesday, ae runs Wednesday). The first period is the current month. */
export const USAGE_PERIODS: Record<string, { id: string; label: string; runIds: string[] }[]> = {
  "runpro-pk": [
    { id: "2026-11", label: "Nov 2026 (to 19 Nov)", runIds: ["run-006", "run-007", "run-008"] },
    { id: "2026-10", label: "Oct 2026", runIds: ["run-002", "run-003", "run-004", "run-005"] },
    { id: "2026-09", label: "Sep 2026", runIds: ["run-001"] },
  ],
  "runpro-ae": [
    { id: "2026-11", label: "Nov 2026 (to 19 Nov)", runIds: ["run-ae-004", "run-ae-005", "run-ae-006"] },
    { id: "2026-10", label: "Oct 2026", runIds: ["run-ae-001", "run-ae-002", "run-ae-003"] },
  ],
};

/** Monitoring-relevant timeline markers on the trend chart (x = run date label is resolved by the service). */
export const TIMELINE_MARKERS: { runId: string; label: string }[] = [
  { runId: "run-004", label: "p-003 v3 in use" },
  { runId: "run-005", label: "Gemini timeouts" },
  { runId: "run-ae-002", label: "Gemini timeout" },
  { runId: "run-ae-004", label: "Schedule v2 in use" },
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
  /** Text of the "current" evidence card for connection events. */
  evidenceSummary?: string;
  /** Tone of the "current" evidence card for aggregate events (omitted keeps the older look). */
  currentTone?: "neutral" | "success" | "warning" | "danger" | "info";
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
  // ---------------------------------------------------------------------------
  // runpro-ae. Every slot below exists in the generated responses of its run.
  // The generated AE answers never drop a mention or recommendation in a slot
  // between runs, so there are no lost-mention events for this store.
  // ---------------------------------------------------------------------------
  {
    id: "ev-ae-007",
    storeId: "runpro-ae",
    type: "integration_attention",
    runId: "run-ae-006",
    at: "2026-11-19T06:00:00Z",
    headlineId: "al-006",
    metric: "integration",
    evidenceSummary: "Commerce connection: needs attention · product sync failed 3 times since 17 Nov",
    currentTone: "danger",
    summary: "The WooCommerce connection has failed its product sync three times. Monitoring is not affected, but applying fixes to the store may fail until the connection is repaired.",
    alert: {
      severity: "high",
      status: "new",
      delivery: [inApp("sent", "06:00 UTC"), email("sent", "06:01 UTC")],
      cooldown: "24 h per integration. 1 duplicate suppressed.",
      persistence: null,
      handledBy: null,
    },
  },
  {
    id: "ev-ae-002",
    storeId: "runpro-ae",
    type: "new_mention",
    runId: "run-ae-006",
    at: "2026-11-18T05:25:00Z",
    headlineId: "al-007",
    previous: { runId: "run-ae-005", promptId: "p-ae-002", channelId: "ch-openai", sample: 3 },
    current: { runId: "run-ae-006", promptId: "p-ae-002", channelId: "ch-openai", sample: 3 },
    summary: "A previously empty OpenAI sample now names the brand and cites the owned product page.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "new",
      delivery: [inApp("sent", "05:25 UTC"), email("sent", "Digest · 06:00 UTC")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: null,
    },
  },
  {
    id: "ev-ae-003",
    storeId: "runpro-ae",
    type: "owned_citation_gained",
    runId: "run-ae-006",
    at: "2026-11-18T05:26:00Z",
    headlineId: "al-008",
    previous: { runId: "run-ae-005", promptId: "p-ae-002", channelId: "ch-openai", sample: 3 },
    current: { runId: "run-ae-006", promptId: "p-ae-002", channelId: "ch-openai", sample: 3 },
    summary: "The owned product page is cited in an OpenAI sample for the Dubai buying prompt.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "low",
      status: "new",
      delivery: [inApp("sent", "05:26 UTC"), email("pending", "Queued for the weekly digest")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: null,
    },
  },
  {
    id: "ev-ae-004",
    storeId: "runpro-ae",
    type: "new_mention",
    runId: "run-ae-006",
    at: "2026-11-18T05:24:00Z",
    headlineId: null,
    title: "New mention: “What are the best running shoe brands in the UAE?” on OpenAI",
    previous: { runId: "run-ae-005", promptId: "p-ae-001", channelId: "ch-openai", sample: 3 },
    current: { runId: "run-ae-006", promptId: "p-ae-001", channelId: "ch-openai", sample: 3 },
    summary: "One sample of the category prompt names the brand for the first time in this store's runs. Samples 1 and 2 still do not.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-ae-005",
    storeId: "runpro-ae",
    type: "new_mention",
    runId: "run-ae-006",
    at: "2026-11-18T05:25:00Z",
    headlineId: null,
    title: "New mention: “Where can I buy running shoes in Dubai?” on OpenAI (sample 2)",
    previous: { runId: "run-ae-005", promptId: "p-ae-002", channelId: "ch-openai", sample: 2 },
    current: { runId: "run-ae-006", promptId: "p-ae-002", channelId: "ch-openai", sample: 2 },
    summary: "A second sample of the same prompt names the brand, without an owned citation.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-ae-006",
    storeId: "runpro-ae",
    type: "competitor_decrease",
    runId: "run-ae-006",
    at: "2026-11-18T05:27:00Z",
    headlineId: null,
    title: "Competitor decrease: competitor-domain citations 76.7% → 66.7%",
    metric: "competitor_citations",
    compare: { previousRunId: "run-ae-005" },
    currentTone: "success",
    summary: "Fewer answers cited a competitor domain. This is context for review, not a cause.",
    alert: null,
  },
  {
    id: "ev-ae-001",
    storeId: "runpro-ae",
    type: "integration_attention",
    runId: "run-ae-006",
    at: "2026-11-18T05:30:00Z",
    headlineId: "al-004",
    metric: "integration",
    evidenceSummary: "Commerce connection: needs attention",
    summary: "The commerce connection for this store needs attention. Monitoring itself is not affected.",
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "05:30 UTC"), email("sent", "05:31 UTC")],
      cooldown: "24 h per integration.",
      persistence: null,
      handledBy: "Resolved by Omar Farooq · superseded by the high-severity alert of 19 Nov",
    },
  },
  {
    id: "ev-ae-008",
    storeId: "runpro-ae",
    type: "new_recommendation",
    runId: "run-ae-005",
    at: "2026-11-11T05:24:00Z",
    headlineId: "al-009",
    previous: { runId: "run-ae-004", promptId: "p-ae-004", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-ae-005", promptId: "p-ae-004", channelId: "ch-gemini", sample: 1 },
    summary: "Gemini sample 1 moved from a plain mention to a recommendation on the comparison prompt.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "05:24 UTC"), email("sent", "05:25 UTC")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Hira Malik",
    },
  },
  {
    id: "ev-ae-009",
    storeId: "runpro-ae",
    type: "sentiment_shift",
    runId: "run-ae-005",
    at: "2026-11-11T05:24:00Z",
    headlineId: null,
    title: "Sentiment shift: mixed → positive on “RunPro vs Brand X running shoes in the UAE” (Gemini)",
    previous: { runId: "run-ae-004", promptId: "p-ae-004", channelId: "ch-gemini", sample: 1 },
    current: { runId: "run-ae-005", promptId: "p-ae-004", channelId: "ch-gemini", sample: 1 },
    summary: "Same slot as the new recommendation. Sentiment is classified per answer.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-ae-010",
    storeId: "runpro-ae",
    type: "rank_movement",
    runId: "run-ae-005",
    at: "2026-11-11T05:26:00Z",
    headlineId: null,
    title: "Rank movement: average list position 1.50 → 1.33",
    metric: "avg_position",
    compare: { previousRunId: "run-ae-004" },
    currentTone: "success",
    summary: "Average position in ordered lists moved up. Only 2 and 3 ordered lists are behind these averages, so treat it as directional.",
    alert: null,
  },
  {
    id: "ev-ae-011",
    storeId: "runpro-ae",
    type: "new_mention",
    runId: "run-ae-004",
    at: "2026-11-04T05:24:00Z",
    headlineId: "al-010",
    previous: { runId: "run-ae-003", promptId: "p-ae-004", channelId: "ch-gemini", sample: 3 },
    current: { runId: "run-ae-004", promptId: "p-ae-004", channelId: "ch-gemini", sample: 3 },
    summary: "A previously empty Gemini sample now names the brand and cites the owned product page. Sample 2 of this slot failed and is not counted.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "05:24 UTC"), email("sent", "05:25 UTC")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Hira Malik",
    },
  },
  {
    id: "ev-ae-012",
    storeId: "runpro-ae",
    type: "owned_citation_gained",
    runId: "run-ae-004",
    at: "2026-11-04T05:24:00Z",
    headlineId: null,
    title: "Owned citation gained: “RunPro vs Brand X running shoes in the UAE” on Gemini",
    previous: { runId: "run-ae-003", promptId: "p-ae-004", channelId: "ch-gemini", sample: 3 },
    current: { runId: "run-ae-004", promptId: "p-ae-004", channelId: "ch-gemini", sample: 3 },
    summary: "The owned page was cited in this Gemini sample. Muted while the Gemini rate-limit alert was open.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "low",
      status: "muted",
      delivery: [inApp("sent", "05:24 UTC")],
      cooldown: "24 h per prompt × provider. Muted until 11 Nov.",
      persistence: null,
      handledBy: "Muted by Hira Malik",
    },
  },
  {
    id: "ev-ae-013",
    storeId: "runpro-ae",
    type: "provider_error_spike",
    runId: "run-ae-004",
    at: "2026-11-04T05:25:00Z",
    headlineId: null,
    title: "Gemini errors: 1 job hit a rate limit in the 4 Nov run",
    metric: "error_spike",
    compare: { previousRunId: "run-ae-003", channelId: "ch-gemini" },
    currentTone: "warning",
    summary: "One Gemini job failed after retries (rate limit) where the previous run had none. Gemini stayed above the 90% healthy line, so this is a watch item, not an outage.",
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "05:25 UTC"), email("sent", "05:26 UTC")],
      cooldown: "24 h per provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Omar Farooq · no failures in the next two runs",
    },
  },
  {
    id: "ev-ae-014",
    storeId: "runpro-ae",
    type: "run_incomplete",
    runId: "run-ae-004",
    at: "2026-11-04T05:26:00Z",
    headlineId: "al-011",
    metric: "run_incomplete",
    compare: { previousRunId: "run-ae-003" },
    summary: "Two jobs (one OpenAI, one Gemini) failed after retries. They are excluded from rates and not treated as brand absent.",
    alert: {
      severity: "info",
      status: "resolved",
      delivery: [inApp("sent", "05:26 UTC")],
      cooldown: "1 per run.",
      persistence: null,
      handledBy: "Auto-resolved: failures below the 15% threshold",
    },
  },
  {
    id: "ev-ae-015",
    storeId: "runpro-ae",
    type: "competitor_decrease",
    runId: "run-ae-004",
    at: "2026-11-04T05:27:00Z",
    headlineId: null,
    title: "Competitor decrease: competitor-domain citations 83.3% → 78.6%",
    metric: "competitor_citations",
    compare: { previousRunId: "run-ae-003" },
    currentTone: "success",
    summary: "Fewer answers cited a competitor domain. The denominators differ because two jobs failed.",
    alert: null,
  },
  {
    id: "ev-ae-016",
    storeId: "runpro-ae",
    type: "competitor_increase",
    runId: "run-ae-003",
    at: "2026-10-28T05:27:00Z",
    headlineId: null,
    title: "Competitor increase: competitor-domain citations 82.8% → 83.3%",
    metric: "competitor_citations",
    compare: { previousRunId: "run-ae-002" },
    summary: "A very small change (24 / 29 → 25 / 30 answers). Read it as flat. Logged only, no alert.",
    alert: null,
  },
  {
    id: "ev-ae-017",
    storeId: "runpro-ae",
    type: "new_recommendation",
    runId: "run-ae-002",
    at: "2026-10-21T05:24:00Z",
    headlineId: null,
    title: "New recommendation: “RunPro vs Brand X running shoes in the UAE” on OpenAI",
    previous: { runId: "run-ae-001", promptId: "p-ae-004", channelId: "ch-openai", sample: 1 },
    current: { runId: "run-ae-002", promptId: "p-ae-004", channelId: "ch-openai", sample: 1 },
    summary: "Sample 1 moved from a plain mention to a recommendation.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "medium",
      status: "resolved",
      delivery: [inApp("sent", "05:24 UTC"), email("sent", "05:25 UTC")],
      cooldown: "12 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Sana Iqbal",
    },
  },
  {
    id: "ev-ae-018",
    storeId: "runpro-ae",
    type: "sentiment_shift",
    runId: "run-ae-002",
    at: "2026-10-21T05:24:00Z",
    headlineId: null,
    title: "Sentiment shift: mixed → positive on “RunPro vs Brand X running shoes in the UAE” (OpenAI)",
    previous: { runId: "run-ae-001", promptId: "p-ae-004", channelId: "ch-openai", sample: 1 },
    current: { runId: "run-ae-002", promptId: "p-ae-004", channelId: "ch-openai", sample: 1 },
    summary: "Same slot as the new recommendation. Sentiment is classified per answer.",
    note: SAMPLE_NOTE,
    alert: null,
  },
  {
    id: "ev-ae-019",
    storeId: "runpro-ae",
    type: "owned_citation_gained",
    runId: "run-ae-002",
    at: "2026-10-21T05:24:00Z",
    headlineId: null,
    title: "Owned citation gained: “RunPro vs Brand X running shoes in the UAE” on OpenAI",
    previous: { runId: "run-ae-001", promptId: "p-ae-004", channelId: "ch-openai", sample: 3 },
    current: { runId: "run-ae-002", promptId: "p-ae-004", channelId: "ch-openai", sample: 3 },
    summary: "Sample 3 named no brand the week before. It now mentions the brand and cites the owned page.",
    note: SAMPLE_NOTE,
    alert: {
      severity: "low",
      status: "resolved",
      delivery: [inApp("sent", "05:24 UTC")],
      cooldown: "24 h per prompt × provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Resolved by Sana Iqbal",
    },
  },
  {
    id: "ev-ae-020",
    storeId: "runpro-ae",
    type: "provider_error_spike",
    runId: "run-ae-002",
    at: "2026-10-21T05:25:00Z",
    headlineId: null,
    title: "Gemini errors: 1 job timed out in the 21 Oct run",
    metric: "error_spike",
    compare: { previousRunId: "run-ae-001", channelId: "ch-gemini" },
    currentTone: "warning",
    summary: "One Gemini job timed out after retries where the previous run had none. Rates for that run use only successful responses.",
    alert: {
      severity: "low",
      status: "resolved",
      delivery: [inApp("sent", "05:25 UTC")],
      cooldown: "24 h per provider. 0 duplicates suppressed.",
      persistence: null,
      handledBy: "Auto-resolved: Gemini healthy in the next run",
    },
  },
];
