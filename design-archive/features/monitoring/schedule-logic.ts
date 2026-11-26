/**
 * Pure schedule logic for the Monitoring module: time zones, next-run computation, estimates,
 * usage-cap checks and config diffs. No React, no clock reads (callers pass the reference time),
 * so it runs on the server, in the browser and in tests.
 */
import type { ChannelInfo, FrequencyKind, ScheduleConfig, ScheduleFrequency, ScheduleRec, ScheduleStatus, ScheduleVersion } from "@/types/monitoring";

const MIN = 60_000;
const DAY = 86_400_000;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

/** UTC offset of `timeZone` at the instant `atMs`, in minutes. Null for an unknown zone. */
export function offsetMinutes(timeZone: string, atMs: number): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).formatToParts(new Date(atMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - Math.floor(atMs / 1000) * 1000) / MIN);
  } catch {
    return null;
  }
}

export type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

/** Wall-clock parts of an instant in a zone. Weekday: 0 = Sunday. */
export function localParts(timeZone: string, atMs: number): LocalParts | null {
  const off = offsetMinutes(timeZone, atMs);
  if (off === null) return null;
  const d = new Date(atMs + off * MIN);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes(), weekday: d.getUTCDay() };
}

/** The instant at which the wall clock in `timeZone` reads the given date and time. DST gaps move forward. */
export function localToUtcMs(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): number | null {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off = offsetMinutes(timeZone, guess);
  if (off === null) return null;
  let utc = guess - off * MIN;
  const off2 = offsetMinutes(timeZone, utc);
  if (off2 !== null && off2 !== off) utc = guess - off2 * MIN;
  return utc;
}

export function parseHm(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h > 23 || m > 59 ? null : { h, m };
}

/** "09:00" in `timeZone` on a reference date, as UTC "HH:mm". Null when the zone or time is invalid. */
export function utcTimeFor(localTime: string, timeZone: string, referenceIso = "2026-11-19"): string | null {
  const hm = parseHm(localTime);
  const [y, mo, d] = referenceIso.slice(0, 10).split("-").map(Number);
  if (!hm) return null;
  const ms = localToUtcMs(timeZone, y, mo, d, hm.h, hm.m);
  if (ms === null) return null;
  const utc = new Date(ms);
  return `${String(utc.getUTCHours()).padStart(2, "0")}:${String(utc.getUTCMinutes()).padStart(2, "0")}`;
}

export function observesDst(timeZone: string): boolean {
  const winter = offsetMinutes(timeZone, Date.UTC(2026, 0, 15, 12));
  const summer = offsetMinutes(timeZone, Date.UTC(2026, 6, 15, 12));
  return winter !== null && summer !== null && winter !== summer;
}

// ---------------------------------------------------------------------------
// Cron (minute hour day-of-month month day-of-week), evaluated in the schedule time zone
// ---------------------------------------------------------------------------

function parseField(field: string, min: number, max: number): number[] | null {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim());
    if (!stepMatch) return null;
    const step = stepMatch[2] ? Number(stepMatch[2]) : 1;
    if (step < 1) return null;
    let lo = min;
    let hi = max;
    if (stepMatch[1] !== "*") {
      const [a, b] = stepMatch[1].split("-").map(Number);
      lo = a;
      hi = b ?? (stepMatch[2] ? max : a);
    }
    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return [...out].sort((a, b) => a - b);
}

export type CronSpec = { minutes: number[]; hours: number[]; days: number[] | null; months: number[]; weekdays: number[] | null };

/** Parses a 5-field cron. Day-of-week 7 counts as Sunday. Null when it is not valid. */
export function parseCron(expression: string): CronSpec | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const minutes = parseField(fields[0], 0, 59);
  const hours = parseField(fields[1], 0, 23);
  const days = parseField(fields[2], 1, 31);
  const months = parseField(fields[3], 1, 12);
  const weekdaysRaw = parseField(fields[4].replace(/\b7\b/g, "0"), 0, 6);
  if (!minutes || !hours || !days || !months || !weekdaysRaw) return null;
  return {
    minutes,
    hours,
    days: fields[2] === "*" ? null : days,
    months,
    weekdays: fields[4] === "*" ? null : weekdaysRaw,
  };
}

// ---------------------------------------------------------------------------
// Next run
// ---------------------------------------------------------------------------

function addLocalDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number; weekday: number } {
  const t = new Date(Date.UTC(y, m - 1, d) + days * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), weekday: t.getUTCDay() };
}

/**
 * The next scheduled instant strictly after `fromIso`, as an ISO string, or null when the timetable has none
 * (invalid cron or time zone). Missed occurrences are never replayed: this is also the answer after "Resume".
 * Rules: daily and weekly and monthly run at the local time in the schedule's time zone; "every N days" runs
 * today if the time is still ahead, otherwise N days later; custom uses the cron fields in the same zone.
 */
export function nextRunAfter(config: Pick<ScheduleConfig, "frequency" | "timezone" | "localTime">, fromIso: string): string | null {
  const fromMs = Date.parse(fromIso);
  const hm = parseHm(config.localTime);
  const start = localParts(config.timezone, fromMs);
  if (Number.isNaN(fromMs) || !start || !hm) return null;
  const f = config.frequency;
  const at = (day: { y: number; m: number; d: number }, h = hm.h, mi = hm.m) => localToUtcMs(config.timezone, day.y, day.m, day.d, h, mi);
  const today = { y: start.year, m: start.month, d: start.day };

  if (f.kind === "custom") {
    const cron = parseCron(f.cron ?? "");
    if (!cron) return null;
    for (let offset = 0; offset <= 400; offset += 1) {
      const day = addLocalDays(today.y, today.m, today.d, offset);
      if (!cron.months.includes(day.m)) continue;
      const domOk = cron.days === null || cron.days.includes(day.d);
      const dowOk = cron.weekdays === null || cron.weekdays.includes(day.weekday);
      // Standard cron: when both day fields are restricted, either may match.
      const dayOk = cron.days !== null && cron.weekdays !== null ? domOk || dowOk : domOk && dowOk;
      if (!dayOk) continue;
      for (const h of cron.hours) {
        for (const mi of cron.minutes) {
          const ms = at(day, h, mi);
          if (ms !== null && ms > fromMs) return new Date(ms).toISOString();
        }
      }
    }
    return null;
  }

  const firstAfter = (days: { y: number; m: number; d: number }[]) => {
    for (const day of days) {
      const ms = at(day);
      if (ms !== null && ms > fromMs) return new Date(ms).toISOString();
    }
    return null;
  };

  switch (f.kind) {
    case "daily":
      return firstAfter([0, 1, 2].map((n) => addLocalDays(today.y, today.m, today.d, n)));
    case "every_n_days": {
      const n = Math.max(2, f.everyDays ?? 2);
      const candidate = at(today);
      if (candidate !== null && candidate > fromMs) return new Date(candidate).toISOString();
      const next = at(addLocalDays(today.y, today.m, today.d, n));
      return next === null ? null : new Date(next).toISOString();
    }
    case "weekly": {
      const weekday = f.weekday ?? 1;
      return firstAfter(
        Array.from({ length: 8 }, (_, n) => addLocalDays(today.y, today.m, today.d, n)).filter((d) => d.weekday === weekday),
      );
    }
    case "monthly": {
      const dom = Math.min(28, Math.max(1, f.dayOfMonth ?? 1));
      const days: { y: number; m: number; d: number }[] = [];
      for (let k = 0; k < 3; k += 1) {
        const total = today.y * 12 + (today.m - 1) + k;
        days.push({ y: Math.floor(total / 12), m: (total % 12) + 1, d: dom });
      }
      return firstAfter(days);
    }
    default:
      return null;
  }
}

/** Runs per month implied by a frequency (used for estimates). */
export function runsPerMonthOf(kind: FrequencyKind, parts: { everyDays?: number; customRuns?: number }): number {
  switch (kind) {
    case "daily":
      return 30;
    case "every_n_days":
      return Math.round((30 / Math.max(1, parts.everyDays ?? 2)) * 100) / 100;
    case "weekly":
      return 4.33;
    case "monthly":
      return 1;
    default:
      return Math.max(0, parts.customRuns ?? 8);
  }
}

export function frequencyLabelOf(config: Pick<ScheduleConfig, "frequency" | "localTime">): string {
  const f: ScheduleFrequency = config.frequency;
  switch (f.kind) {
    case "daily":
      return `Daily · ${config.localTime}`;
    case "every_n_days":
      return `Every ${f.everyDays ?? 2} days · ${config.localTime}`;
    case "weekly":
      return `Weekly · ${WEEKDAYS_SHORT[f.weekday ?? 1]} ${config.localTime}`;
    case "monthly":
      return `Monthly · ${f.dayOfMonth ?? 1}${f.dayOfMonth === 1 ? "st" : "th"} ${config.localTime}`;
    default:
      return `Custom · ${f.cron ?? "cron"}`;
  }
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

export type ScheduleEstimate = {
  activePromptCount: number;
  jobsPerRun: number;
  runsPerMonth: number;
  jobsPerMonth: number;
  costPerMonthUsd: number;
};

/** Jobs per run = active prompts x providers x samples. Cost is an estimate from the recent cost per job. */
export function estimateSchedule(config: ScheduleConfig, activePromptIds: ReadonlySet<string>, costPerJobUsd: number): ScheduleEstimate {
  const activePromptCount = config.promptIds.filter((id) => activePromptIds.has(id)).length;
  const jobsPerRun = activePromptCount * config.channelIds.length * config.samples;
  const jobsPerMonth = Math.round(jobsPerRun * config.frequency.runsPerMonth);
  return { activePromptCount, jobsPerRun, runsPerMonth: config.frequency.runsPerMonth, jobsPerMonth, costPerMonthUsd: round(jobsPerMonth * costPerJobUsd) };
}

export function channelsOf(config: ScheduleConfig, all: readonly ChannelInfo[]): ChannelInfo[] {
  return all.filter((c) => config.channelIds.includes(c.id));
}

// ---------------------------------------------------------------------------
// Usage caps
// ---------------------------------------------------------------------------

export type CapCheckInput = {
  /** Jobs and estimated cost already used this month by the schedule. */
  usedJobs: number;
  usedCostUsd: number;
  /** Jobs and estimated cost the new run would add. */
  runJobs: number;
  runCostUsd: number;
  capJobs: number;
  capCostUsd: number;
};

export type CapCheck = { ok: true } | { ok: false; reason: string; metric: "jobs" | "cost" };

/** A run that would pass a monthly cap is refused (the real product would stop it and finish it as partial). */
export function checkRunCap(input: CapCheckInput): CapCheck {
  if (input.usedJobs + input.runJobs > input.capJobs) {
    return { ok: false, metric: "jobs", reason: `This run adds ${input.runJobs} jobs to ${input.usedJobs} used this month, over the cap of ${input.capJobs}.` };
  }
  if (input.usedCostUsd + input.runCostUsd > input.capCostUsd + 1e-9) {
    return { ok: false, metric: "cost", reason: `This run would raise the estimated cost to $${(input.usedCostUsd + input.runCostUsd).toFixed(2)}, over the cap of $${input.capCostUsd.toFixed(2)}.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Config diff (for the version history)
// ---------------------------------------------------------------------------

/** Short human-readable list of what changed between two configs. */
export function configChanges(prev: ScheduleConfig, next: ScheduleConfig): string[] {
  const out: string[] = [];
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!eq(prev.promptIds, next.promptIds) || prev.promptMode !== next.promptMode) out.push(`Prompts: ${prev.promptIds.length} → ${next.promptIds.length}${prev.promptMode !== next.promptMode ? `, ${next.promptMode === "pinned" ? "versions pinned" : "latest version"}` : ""}`);
  if (!eq(prev.channelIds, next.channelIds)) out.push(`Providers: ${prev.channelIds.length} → ${next.channelIds.length}`);
  if (prev.market !== next.market || prev.language !== next.language) out.push(`Locale ${prev.market} · ${prev.language.toUpperCase()} → ${next.market} · ${next.language.toUpperCase()}`);
  if (!eq(prev.frequency, next.frequency) || prev.timezone !== next.timezone || prev.localTime !== next.localTime) out.push(`Timetable: ${frequencyLabelOf(prev)} → ${frequencyLabelOf(next)}${prev.timezone !== next.timezone ? ` (${next.timezone})` : ""}`);
  if (prev.samples !== next.samples) out.push(`Samples ${prev.samples} → ${next.samples}`);
  if (prev.windowMinutes !== next.windowMinutes) out.push(`Run window ${prev.windowMinutes} → ${next.windowMinutes} min`);
  if (prev.maxConcurrency !== next.maxConcurrency) out.push(`Max concurrency ${prev.maxConcurrency} → ${next.maxConcurrency}`);
  if (!eq(prev.retry, next.retry)) out.push(`Retry ${prev.retry.maxAttempts} → ${next.retry.maxAttempts} attempts, backoff ${prev.retry.backoffSeconds} → ${next.retry.backoffSeconds}s`);
  if (!eq(prev.usageCap, next.usageCap)) out.push(`Usage cap ${prev.usageCap.jobsPerMonth} → ${next.usageCap.jobsPerMonth} jobs, $${prev.usageCap.costUsd} → $${next.usageCap.costUsd}`);
  if (!eq(prev.alerts, next.alerts)) out.push("Alert rules");
  if (!eq(prev.notify, next.notify)) out.push("Notifications");
  return out;
}

// ---------------------------------------------------------------------------
// Building and editing schedule records
// ---------------------------------------------------------------------------


export type RecContext = { channels: readonly ChannelInfo[]; activePromptIds: ReadonlySet<string>; costPerJobUsd: number };

/** Row fields that depend on the config: recomputed whenever a schedule is created or edited. */
export function derivedFields(config: ScheduleConfig, rc: RecContext): Pick<ScheduleRec, "frequencyLabel" | "timezone" | "promptCount" | "activePromptCount" | "channels" | "samples" | "jobsPerRun" | "runsPerMonth" | "jobsPerMonth" | "costPerMonthUsd" | "config"> {
  const e = estimateSchedule(config, rc.activePromptIds, rc.costPerJobUsd);
  return {
    frequencyLabel: frequencyLabelOf(config),
    timezone: config.timezone,
    promptCount: config.promptIds.length,
    activePromptCount: e.activePromptCount,
    channels: channelsOf(config, rc.channels),
    samples: config.samples,
    jobsPerRun: e.jobsPerRun,
    runsPerMonth: e.runsPerMonth,
    jobsPerMonth: e.jobsPerMonth,
    costPerMonthUsd: e.costPerMonthUsd,
    config,
  };
}

export type NewScheduleInput = {
  id: string;
  storeId: string;
  name: string;
  status: Extract<ScheduleStatus, "draft" | "active">;
  config: ScheduleConfig;
  rc: RecContext;
  nowIso: string;
  createdBy: string;
  duplicateOf?: string;
};

/** A new schedule at version 1. Active schedules get a next run; drafts have none until activated. */
export function newScheduleRec(input: NewScheduleInput): ScheduleRec {
  const { config } = input;
  const first: ScheduleVersion = {
    version: 1,
    createdAt: input.nowIso,
    createdBy: input.createdBy,
    changes: [input.duplicateOf ? `Copied from ${input.duplicateOf}` : `Created: ${config.promptIds.length} prompts × ${config.channelIds.length} providers × ${config.samples} samples`, frequencyLabelOf(config) + ` ${config.timezone}`],
    config,
  };
  return {
    id: input.id,
    storeId: input.storeId,
    name: input.name,
    status: input.status,
    statusReason: input.status === "draft" ? "Draft. Activate it to start the timetable." : null,
    createdAt: input.nowIso,
    createdBy: input.createdBy,
    nextRunAt: input.status === "active" ? nextRunAfter(config, input.nowIso) : null,
    lastRunAt: null,
    currentVersion: 1,
    versions: [first],
    editable: true,
    duplicateOf: input.duplicateOf,
    ...derivedFields(config, input.rc),
  };
}

/** Patch for saving an edit: a new version on top of the history, derived fields and next run recomputed. */
export function editSchedulePatch(rec: ScheduleRec, name: string, config: ScheduleConfig, rc: RecContext, nowIso: string, by: string): Partial<ScheduleRec> {
  const changes = [...(name !== rec.name ? [`Renamed to “${name}”`] : []), ...configChanges(rec.config, config)];
  const version = rec.currentVersion + 1;
  const versions: ScheduleVersion[] = [{ version, createdAt: nowIso, createdBy: by, changes: changes.length ? changes : ["Saved without changes"], config }, ...rec.versions];
  return {
    name,
    currentVersion: version,
    versions,
    nextRunAt: rec.status === "active" || rec.status === "needs_attention" ? nextRunAfter(config, nowIso) : rec.nextRunAt,
    ...derivedFields(config, rc),
  };
}
