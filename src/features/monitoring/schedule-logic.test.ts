import { describe, expect, it } from "vitest";

import type { ScheduleConfig } from "@/types/monitoring";

import { checkRunCap, configChanges, estimateSchedule, frequencyLabelOf, nextRunAfter, observesDst, parseCron, utcTimeFor } from "./schedule-logic";

const FROM = "2026-11-19T09:00:00Z";
const cfg = (frequency: ScheduleConfig["frequency"], timezone: string, localTime: string) => ({ frequency, timezone, localTime });

describe("nextRunAfter", () => {
  it("weekly in Karachi and Dubai matches the seeded schedules", () => {
    expect(nextRunAfter(cfg({ kind: "weekly", weekday: 2, runsPerMonth: 4.33 }, "Asia/Karachi", "09:00"), FROM)).toBe("2026-11-24T04:00:00.000Z");
    expect(nextRunAfter(cfg({ kind: "weekly", weekday: 3, runsPerMonth: 4.33 }, "Asia/Dubai", "09:00"), FROM)).toBe("2026-11-25T05:00:00.000Z");
  });

  it("daily and monthly follow the local time of the zone", () => {
    expect(nextRunAfter(cfg({ kind: "daily", runsPerMonth: 30 }, "Asia/Karachi", "08:00"), FROM)).toBe("2026-11-20T03:00:00.000Z");
    expect(nextRunAfter(cfg({ kind: "monthly", dayOfMonth: 1, runsPerMonth: 1 }, "Asia/Karachi", "10:00"), FROM)).toBe("2026-12-01T05:00:00.000Z");
  });

  it("is strictly after the reference time, so resume never replays a missed run", () => {
    const resumed = nextRunAfter(cfg({ kind: "daily", runsPerMonth: 30 }, "UTC", "09:00"), FROM);
    expect(resumed).toBe("2026-11-20T09:00:00.000Z");
    expect(Date.parse(resumed as string)).toBeGreaterThan(Date.parse(FROM));
  });

  it("every N days runs today when the time is ahead, else N days later", () => {
    expect(nextRunAfter(cfg({ kind: "every_n_days", everyDays: 3, runsPerMonth: 10 }, "Asia/Karachi", "20:00"), FROM)).toBe("2026-11-19T15:00:00.000Z");
    expect(nextRunAfter(cfg({ kind: "every_n_days", everyDays: 3, runsPerMonth: 10 }, "Asia/Karachi", "08:00"), FROM)).toBe("2026-11-22T03:00:00.000Z");
  });

  it("keeps the local time across a daylight-saving change (UTC time shifts)", () => {
    const ny = cfg({ kind: "daily", runsPerMonth: 30 }, "America/New_York", "09:00");
    expect(nextRunAfter(ny, "2026-10-30T13:30:00Z")).toBe("2026-10-31T13:00:00.000Z"); // EDT, UTC-4
    expect(nextRunAfter(ny, "2026-10-31T13:30:00Z")).toBe("2026-11-01T14:00:00.000Z"); // EST after the change, UTC-5
    const london = cfg({ kind: "daily", runsPerMonth: 30 }, "Europe/London", "09:00");
    expect(nextRunAfter(london, "2026-03-28T10:00:00Z")).toBe("2026-03-29T08:00:00.000Z"); // BST starts
  });

  it("handles cron in the schedule time zone and rejects bad input", () => {
    expect(nextRunAfter(cfg({ kind: "custom", cron: "0 9 * * 1,4", runsPerMonth: 8 }, "Asia/Karachi", "09:00"), FROM)).toBe("2026-11-23T04:00:00.000Z");
    expect(nextRunAfter(cfg({ kind: "custom", cron: "not a cron", runsPerMonth: 8 }, "UTC", "09:00"), FROM)).toBeNull();
    expect(nextRunAfter(cfg({ kind: "daily", runsPerMonth: 30 }, "Mars/Olympus", "09:00"), FROM)).toBeNull();
    expect(nextRunAfter(cfg({ kind: "daily", runsPerMonth: 30 }, "UTC", "25:00"), FROM)).toBeNull();
  });
});

describe("time zone helpers", () => {
  it("converts a local time to UTC and detects daylight saving", () => {
    expect(utcTimeFor("09:00", "Asia/Karachi")).toBe("04:00");
    expect(utcTimeFor("09:00", "UTC")).toBe("09:00");
    expect(utcTimeFor("09:00", "Nowhere/Land")).toBeNull();
    expect(observesDst("Europe/London")).toBe(true);
    expect(observesDst("Asia/Dubai")).toBe(false);
  });

  it("parses cron fields", () => {
    expect(parseCron("*/15 9-10 * * 1-5")?.minutes).toEqual([0, 15, 30, 45]);
    expect(parseCron("0 9 * *")).toBeNull();
  });
});

describe("estimates and caps", () => {
  const config = { promptIds: ["a", "b", "c"], channelIds: ["x", "y"], samples: 2, frequency: { kind: "weekly", runsPerMonth: 4 } } as unknown as ScheduleConfig;

  it("counts only active prompts", () => {
    const e = estimateSchedule(config, new Set(["a", "b"]), 0.1);
    expect(e).toMatchObject({ activePromptCount: 2, jobsPerRun: 8, jobsPerMonth: 32, costPerMonthUsd: 3.2 });
  });

  it("refuses a run that would pass the jobs or cost cap", () => {
    expect(checkRunCap({ usedJobs: 100, usedCostUsd: 2, runJobs: 30, runCostUsd: 0.5, capJobs: 160, capCostUsd: 12 })).toEqual({ ok: true });
    const jobs = checkRunCap({ usedJobs: 150, usedCostUsd: 2, runJobs: 30, runCostUsd: 0.5, capJobs: 160, capCostUsd: 12 });
    expect(jobs.ok).toBe(false);
    expect(!jobs.ok && jobs.metric).toBe("jobs");
    const cost = checkRunCap({ usedJobs: 10, usedCostUsd: 11.8, runJobs: 30, runCostUsd: 0.5, capJobs: 160, capCostUsd: 12 });
    expect(!cost.ok && cost.metric).toBe("cost");
  });
});

describe("labels and diffs", () => {
  it("labels frequencies", () => {
    expect(frequencyLabelOf({ frequency: { kind: "weekly", weekday: 2, runsPerMonth: 4.33 }, localTime: "09:00" })).toBe("Weekly · Tue 09:00");
  });

  it("lists what changed between two configs", () => {
    const a = { promptIds: ["a"], promptMode: "latest", channelIds: ["x"], market: "PK", language: "en", frequency: { kind: "daily", runsPerMonth: 30 }, timezone: "UTC", localTime: "09:00", samples: 1, windowMinutes: 60, maxConcurrency: 2, retry: { maxAttempts: 2, backoffSeconds: 20 }, usageCap: { jobsPerMonth: 100, costUsd: 5 }, alerts: {}, notify: {} } as unknown as ScheduleConfig;
    const b = { ...a, windowMinutes: 90, samples: 2 } as ScheduleConfig;
    expect(configChanges(a, b)).toEqual(["Samples 1 → 2", "Run window 60 → 90 min"]);
    expect(configChanges(a, a)).toEqual([]);
  });
});
