/** Monitoring module types: schedules, runs, observations, events/alerts, usage. */
import type { AlertSeverity, Rate } from "@/types/core";
import type { ResponseSample } from "@/types/shared-records";

export type ScheduleStatus = "draft" | "validating" | "active" | "paused" | "needs_attention" | "cancelled";
export type RunStatus = "queued" | "running" | "completed" | "completed_with_warnings" | "partially_completed" | "failed" | "cancelled" | "skipped";
export type FrequencyKind = "daily" | "every_n_days" | "weekly" | "monthly" | "custom";
export type FailureClass = "timeout" | "rate_limit" | "provider_error" | "refusal";

export type EventType =
  | "new_mention"
  | "lost_mention"
  | "new_recommendation"
  | "lost_recommendation"
  | "owned_citation_gained"
  | "owned_citation_lost"
  | "sentiment_shift"
  | "competitor_increase"
  | "competitor_decrease"
  | "rank_movement"
  | "provider_error_spike"
  | "run_incomplete"
  | "run_late"
  | "integration_attention";

export type EventCategory = "visibility" | "data_quality";

export type AlertStatus = "new" | "read" | "acknowledged" | "resolved" | "muted";
export type DeliveryStatus = "pending" | "sent" | "failed" | "retrying";
export type DeliveryChannel = "in_app" | "email" | "webhook";

export type ScheduleFrequency = {
  kind: FrequencyKind;
  /** every_n_days */
  everyDays?: number;
  /** weekly: 0 = Sunday … 6 = Saturday */
  weekday?: number;
  /** monthly */
  dayOfMonth?: number;
  /** custom */
  cron?: string;
  runsPerMonth: number;
};

export type AlertRules = {
  categories: EventType[];
  /** Minimum change before an event becomes an alert, in words (kept short). */
  threshold: string;
  persistence: { required: number; window: number };
  cooldownHours: number;
  quietHours: { enabled: boolean; from: string; to: string };
};

export type ScheduleConfig = {
  promptMode: "latest" | "pinned";
  /** Selected prompt ids. */
  promptIds: string[];
  /** Number of prompts when the library is not available in the demo. */
  promptCount: number;
  pinnedVersions: Record<string, number>;
  channelIds: string[];
  market: string;
  language: string;
  frequency: ScheduleFrequency;
  timezone: string;
  /** HH:mm in the schedule time zone. */
  localTime: string;
  samples: number;
  windowMinutes: number;
  maxConcurrency: number;
  retry: { maxAttempts: number; backoffSeconds: number };
  usageCap: { jobsPerMonth: number; costUsd: number };
  alerts: AlertRules;
  notify: { inApp: boolean; email: string[]; webhook: string | null };
};

export type ScheduleVersion = {
  version: number;
  createdAt: string;
  createdBy: string;
  changes: string[];
  config: ScheduleConfig;
};

export type MonitoringSchedule = {
  id: string;
  storeId: string;
  name: string;
  status: ScheduleStatus;
  statusReason: string | null;
  createdAt: string;
  createdBy: string;
  nextRunAt: string | null;
  currentVersion: number;
  versions: ScheduleVersion[];
};

export type ChannelInfo = {
  id: string;
  providerLabel: string;
  model: string;
  /** Honest label: provider API · model · search mode. */
  label: string;
  short: string;
  searchMode: string;
  supportsCitations: boolean;
  tone: 1 | 2 | 3 | 4 | 5;
};

export type ScheduleRow = {
  id: string;
  name: string;
  status: ScheduleStatus;
  statusReason: string | null;
  frequencyLabel: string;
  timezone: string;
  promptCount: number;
  /** Selected prompts that are currently active (paused / archived ones are skipped). */
  activePromptCount: number;
  channels: ChannelInfo[];
  samples: number;
  jobsPerRun: number;
  runsPerMonth: number;
  jobsPerMonth: number;
  costPerMonthUsd: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  currentVersion: number;
  config: ScheduleConfig;
  /** Prompt library is available for editing (false for stores without prompt data). */
  editable: boolean;
};

export type RunSummary = {
  id: string;
  storeId: string;
  scheduleId: string;
  scheduleName: string;
  scheduleVersion: number;
  trigger: "schedule" | "manual";
  scheduledFor: string;
  durationSeconds: number | null;
  status: RunStatus;
  mention: Rate;
  recommendation: Rate;
  planned: number;
  succeeded: number;
  failed: number;
  requests: number;
  costUsd: number;
  snapshotId: string;
  hasJobDetail: boolean;
};

export type RunJob = {
  id: string;
  promptId: string;
  promptText: string;
  promptVersion: number;
  channelId: string;
  provider: string;
  providerShort: string;
  sample: number;
  status: "succeeded" | "failed";
  attempts: number;
  errorClass: FailureClass | null;
  errorMessage: string | null;
  /** brand mention outcome for succeeded jobs */
  outcome: ResponseSample["outcome"];
  response: ResponseSample;
};

export type ProviderSplit = {
  channelId: string;
  label: string;
  short: string;
  planned: number;
  succeeded: number;
  failed: number;
  mention: Rate;
  recommendation: Rate;
  previousMention: Rate | null;
  failureClasses: Partial<Record<FailureClass, number>>;
  requests: number;
  tokens: number;
  searchCalls: number;
  costUsd: number;
};

export type RunFailureGroup = { cls: FailureClass; count: number; examples: { jobId: string; prompt: string; provider: string; message: string; attempts: number }[] };

export type RunDetail = {
  run: RunSummary;
  previousRunId: string | null;
  totals: { planned: number; attempted: number; succeeded: number; failed: number; retried: number; analysed: number };
  providers: ProviderSplit[];
  jobs: RunJob[];
  failures: RunFailureGroup[];
  usage: { requests: number; inputTokens: number; outputTokens: number; searchCalls: number; costUsd: number };
  snapshot: {
    id: string;
    scheduleVersion: number;
    analysisVersion: string;
    locale: string;
    samples: number;
    windowMinutes: number;
    maxConcurrency: number;
    retry: string;
    prompts: { id: string; text: string; version: number }[];
    channels: ChannelInfo[];
  };
  reportId: string | null;
  provisional: boolean;
};

export type TimelinePoint = {
  runId: string;
  label: string;
  scheduledFor: string;
  status: RunStatus;
  overall: Rate;
  byProvider: { channelId: string; rate: Rate }[];
  failed: number;
  planned: number;
};

export type ProviderHealth = {
  channelId: string;
  label: string;
  short: string;
  /** latest run */
  succeeded: number;
  planned: number;
  failed: number;
  failureClasses: Partial<Record<FailureClass, number>>;
  state: "healthy" | "degraded" | "outage";
  credentials: "tested" | "needs_test";
};

export type EvidenceSide = {
  label: string;
  runId: string;
  at: string;
  summary: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
  excerpt: string | null;
  response: ResponseSample | null;
};

export type DeliveryRow = { channel: DeliveryChannel; status: DeliveryStatus; detail: string };

export type AlertState = {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  delivery: DeliveryRow[];
  cooldown: string;
  persistence: { rule: string; progress: string } | null;
  handledBy: string | null;
};

export type MonitoringEvent = {
  id: string;
  storeId: string;
  type: EventType;
  category: EventCategory;
  runId: string;
  at: string;
  promptId: string | null;
  promptText: string | null;
  channelId: string | null;
  providerShort: string | null;
  title: string;
  summary: string;
  previous: EvidenceSide | null;
  current: EvidenceSide;
  note: string | null;
  alert: AlertState | null;
};

export type ObservationSample = { sample: number; response: ResponseSample };

export type ObservationRun = { runId: string; label: string; n: number; d: number; failed: number };

export type ObservationRow = {
  id: string;
  /** Market and language of the run, e.g. "AE · EN". */
  locale: string;
  promptId: string;
  promptText: string;
  groupName: string;
  channelId: string;
  providerShort: string;
  channelLabel: string;
  history: ObservationRun[];
  /** mention % per run, null when no successful sample */
  series: (number | null)[];
  latestRunId: string;
  latestAt: string;
  latest: { n: number; d: number; failed: number; recommended: number; ownedCitations: number; best: ResponseSample["outcome"] };
  eventTypes: EventType[];
  samples: ObservationSample[];
};

export type UsageMetricKey = "requests" | "samples" | "searchCalls" | "tokens" | "costUsd";

export type UsageNumbers = Record<UsageMetricKey, number>;

export type UsagePeriod = {
  id: string;
  label: string;
  runCount: number;
  total: UsageNumbers;
  byProvider: { channelId: string; label: string; numbers: UsageNumbers; requestCap: number }[];
};

export type UsageCaps = Record<UsageMetricKey, number>;

export type UsageSummary = {
  /** Token and search-call counts are estimated (no job-level records). */
  estimated: boolean;
  currentPeriodId: string;
  periods: UsagePeriod[];
  caps: UsageCaps;
  /** Projected month-end totals for the current period (scheduled runs still to come). */
  projected: UsageNumbers;
  projectedNote: string;
  storeRequests: { used: number; cap: number } | null;
  schedules: {
    id: string;
    name: string;
    status: ScheduleStatus;
    jobsPerRun: number;
    runsPerMonth: number;
    jobsPerMonth: number;
    costPerMonthUsd: number;
  }[];
  costPerJobUsd: number;
};

export type MonitoringHeaderData = {
  storeId: string;
  canSchedule: boolean;
  openAlerts: number;
  schedules: { id: string; name: string; jobsPerRun: number; windowMinutes: number; maxConcurrency: number; usageCap: string }[];
};

export type FormPrompt = { id: string; text: string; group: string; status: "draft" | "active" | "paused" | "archived"; version: number; isCore: boolean };

export type ScheduleFormContext = {
  storeId: string;
  storeTimezone: string;
  market: string;
  language: string;
  prompts: FormPrompt[];
  channels: (ChannelInfo & { credentials: "tested" | "needs_test" })[];
  timezones: { value: string; label: string }[];
  costPerJobUsd: number;
  plan: { requestCap: number; used: number };
  /** Monthly monitoring budget of the store (the caps shown on the Usage tab). */
  budget: UsageCaps;
  /** Starting values for a new schedule's usage cap. */
  defaultCap: { jobsPerMonth: number; costUsd: number };
  emails: string[];
  otherJobsPerMonth: number;
};
