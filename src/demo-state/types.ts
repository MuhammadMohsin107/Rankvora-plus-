/** Types for the local demo-state overlay. Framework-free: no React, no Next, no Node APIs. */

export const DEMO_STATE_VERSION = 1 as const;
export const DEMO_STATE_KEY = "rankvora-demo-state:v1";

/** Collections that can be overlaid on the static demo data. */
export const COLLECTION_KINDS = [
  "websites",
  "prompts",
  "findings",
  "tasks",
  "schedules",
  "runs",
  "alerts",
  "comparisons",
  "reports",
  "members",
  "audits",
] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

/** Every overlay row is a plain JSON object with a string id. */
export type DemoRow = { id: string } & Record<string, unknown>;

/** Marker stamped on every record created locally. */
export type DemoMarker = { simulated: true; origin: "local-demo" };

/** Per-collection changes layered on top of the static rows. */
export type CollectionOverlay<T = DemoRow> = {
  /** Rows created locally, appended after the base rows. */
  created: T[];
  /** Field changes by row id (applies to base rows and created rows). */
  patched: Record<string, Partial<T>>;
  /** Base row ids hidden from the merged list. */
  removed: string[];
};

export const EVENT_KINDS = [
  "finding.created",
  "finding.updated",
  "task.created",
  "task.approved",
  "task.rejected",
  "task.applied",
  "task.published",
  "task.verified",
  "task.rolled_back",
  "task.updated",
  "run.started",
  "run.completed",
  "alert.read",
  "alert.acknowledged",
  "alert.muted",
  "alert.resolved",
  "alert.dismissed",
  "comparison.created",
  "comparison.archived",
  "comparison.annotated",
  "schedule.created",
  "schedule.updated",
  "schedule.paused",
  "schedule.resumed",
  "schedule.cancelled",
  "schedule.duplicated",
  "prompt.created",
  "prompt.updated",
  "report.generated",
  "website.created",
  "website.updated",
  "audit.started",
  "audit.paused",
  "audit.resumed",
  "audit.completed",
  "audit.cancelled",
  "member.invited",
  "member.updated",
  "settings.saved",
] as const;
export type DemoEventKind = (typeof EVENT_KINDS)[number];

/** Ids that tie an event to the evidence chain: finding -> task -> run -> alert -> comparison. */
export type DemoEventRefs = {
  findingId?: string;
  taskId?: string;
  runId?: string;
  alertId?: string;
  comparisonId?: string;
  promptId?: string;
  websiteId?: string;
  scheduleId?: string;
  auditId?: string;
  reportId?: string;
};

export type DemoEvent = {
  id: string;
  /** ISO timestamp taken when the action happened. */
  at: string;
  kind: DemoEventKind;
  /** Short human label, for example "Task approved". */
  label: string;
  refs: DemoEventRefs;
  /** Always true: nothing reached a real external system. */
  simulated: true;
};

/** What a caller passes to emit(); id, time and the simulated flag are added by the store. */
export type DemoEventInput = {
  kind: DemoEventKind;
  label: string;
  refs?: DemoEventRefs;
  /** Overrides the store clock. */
  at?: string;
};

export type DemoUi = {
  sidebarCollapsed: boolean;
  lastWebsiteId: string | null;
  dismissedBanners: string[];
};

export type DemoStateV1 = {
  v: typeof DEMO_STATE_VERSION;
  /** Monotonic counter behind `demo-<kind>-<n>` ids. Never reused until reset. */
  seq: number;
  websites: CollectionOverlay;
  prompts: CollectionOverlay;
  findings: CollectionOverlay;
  tasks: CollectionOverlay;
  schedules: CollectionOverlay;
  runs: CollectionOverlay;
  alerts: CollectionOverlay;
  comparisons: CollectionOverlay;
  reports: CollectionOverlay;
  members: CollectionOverlay;
  audits: CollectionOverlay;
  settings: Record<string, unknown>;
  events: DemoEvent[];
  ui: DemoUi;
};
