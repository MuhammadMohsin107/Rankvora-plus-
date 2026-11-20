"use client";

/**
 * ONE shared client state for Monitoring: schedules, runs and alerts of the current website, layered over the
 * static data with demo-state. Every list, detail page, header badge and the Overview read from here, so a change
 * made in one place shows everywhere. Nothing reaches a provider: runs are simulated and labelled so.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useToast } from "@/components/ui/toast";
import { usePromptGroups, usePrompts } from "@/features/prompts/use-prompts";
import { demoNow, demoStore, simulatedToast, useDemoAlerts, useDemoCollection, type DemoAlerts } from "@/demo-state";
import type { DemoEventKind } from "@/demo-state";
import { DEMO_NOW } from "@/lib/format";
import type { PromptBase } from "@/types/core";
import type {
  AlertRow,
  FormPrompt,
  MonitoringShellData,
  MonitoringTaskLite,
  RunDetail,
  RunPurpose,
  RunRec,
  RunSummary,
  ScheduleConfig,
  ScheduleRec,
} from "@/types/monitoring";

import { advanceRun, buildRunCatalog, buildRunRec, cancelRunPatch, isActiveRun, pickBasisRun, planSimulatedRun, scheduleMonthUsage, simulateRunDetail } from "./run-sim";
import { checkRunCap, editSchedulePatch, newScheduleRec, nextRunAfter, type RecContext } from "./schedule-logic";

const INITIATOR = "You";
const TICK_MS = 900;

/** "Now" for Monitoring: the real clock, but never earlier than the demo reference date so new runs sort after seeded ones. */
export function monitoringNow(): string {
  const real = Date.parse(demoNow());
  const ref = Date.parse(DEMO_NOW);
  return new Date(Number.isNaN(real) ? ref : Math.max(real, ref)).toISOString();
}

/** `sch-demo-12` / `run-demo-12`: keeps the `sch-` / `run-` prefix the rest of the app recognises. */
function newId(prefix: "sch" | "run"): string {
  const raw = demoStore.nextId(prefix);
  return `${prefix}-demo-${raw.split("-").pop()}`;
}

export type RunNowInput = {
  scheduleId: string;
  reason: string;
  purpose?: RunPurpose;
  taskId?: string;
  findingId?: string;
};

/** What the Run now dialog opens with. */
export type RunNowRequest = { open: boolean; scheduleId?: string; purpose?: RunPurpose; taskId?: string; findingId?: string };

export type ActionResult<T = { id: string }> = ({ ok: true } & T) | { ok: false; reason: string };

export type MonitoringApi = {
  data: MonitoringShellData;
  base: string;
  schedules: ScheduleRec[];
  runs: RunSummary[];
  /** Runs created locally (simulated), newest first. */
  simulatedRuns: RunRec[];
  prompts: FormPrompt[];
  tasks: MonitoringTaskLite[];
  alerts: DemoAlerts<AlertRow>;
  ctxFor: () => RecContext | null;
  createSchedule(input: { name: string; config: ScheduleConfig; status: "draft" | "active" }): ScheduleRec;
  saveSchedule(id: string, name: string, config: ScheduleConfig): void;
  activateSchedule(id: string): void;
  pauseSchedule(id: string): void;
  resumeSchedule(id: string): void;
  cancelSchedule(id: string): void;
  duplicateSchedule(id: string): ScheduleRec | null;
  runNow(input: RunNowInput): Promise<ActionResult>;
  retryFailed(run: RunSummary, detail: RunDetail): Promise<ActionResult>;
  cancelRun(id: string): void;
  loadRunDetail(run: RunRec): Promise<RunDetail | null>;
  runDialog: RunNowRequest;
  openRunNow(request?: Omit<RunNowRequest, "open">): void;
  closeRunNow(): void;
};

const Ctx = createContext<MonitoringApi | null>(null);

export function useMonitoring(): MonitoringApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useMonitoring must be used inside MonitoringProvider");
  return api;
}

/** Earlier runs are immutable, so their job detail is loaded once per browser session. */
const BASIS_CACHE = new Map<string, Promise<RunDetail | null>>();

const byNewest = (a: RunSummary, b: RunSummary) => b.scheduledFor.localeCompare(a.scheduledFor);

export function MonitoringProvider({ data, children }: { data: MonitoringShellData; children: ReactNode }) {
  const toast = useToast();
  const push = toast.push;
  const storeId = data.storeId;
  const base = `/stores/${storeId}/monitoring`;

  const scheduleColl = useDemoCollection<ScheduleRec>("schedules", data.schedules);
  const runColl = useDemoCollection<RunSummary>("runs", data.runs);
  const { prompts: storePrompts } = usePrompts<PromptBase>(storeId, data.promptBase);
  const { groups } = usePromptGroups(storeId, data.groups);
  const taskColl = useDemoCollection<MonitoringTaskLite>("tasks", data.tasks);
  const alerts = useDemoAlerts<AlertRow>(data.alerts, storeId);

  const schedules = useMemo(() => scheduleColl.rows.filter((s) => s.storeId === storeId), [scheduleColl.rows, storeId]);
  const runs = useMemo(() => runColl.rows.filter((r) => r.storeId === storeId).sort(byNewest), [runColl.rows, storeId]);
  const simulatedRuns = useMemo(() => runs.filter((r): r is RunRec => (r as RunRec).simulated === true), [runs]);

  const prompts = useMemo<FormPrompt[]>(() => {
    const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name ?? "Ungrouped";
    return storePrompts.map((p) => ({ id: p.id, text: p.text, group: groupName(p.groupId), status: p.status, version: p.version, isCore: p.isCore }));
  }, [storePrompts, groups]);

  const tasks = useMemo(
    () =>
      taskColl.rows
        .filter((t) => {
          const owner = (t as { storeId?: string; websiteId?: string }).storeId ?? (t as { websiteId?: string }).websiteId;
          return !owner || owner === storeId;
        })
        .map((t) => ({ id: t.id, title: t.title ?? t.id, findingId: t.findingId, status: t.status })),
    [taskColl.rows, storeId],
  );

  // Latest values for the timer and async actions, without re-subscribing every render.
  const live = useRef({ schedules, runs, prompts });
  useEffect(() => {
    live.current = { schedules, runs, prompts };
  });

  const ctxFor = useCallback((): RecContext | null => {
    if (!data.ctx) return null;
    return {
      channels: data.ctx.channels,
      activePromptIds: new Set(live.current.prompts.filter((p) => p.status === "active").map((p) => p.id)),
      costPerJobUsd: data.ctx.costPerJobUsd,
    };
  }, [data.ctx]);

  const ref = (id: string) => ({ scheduleId: id, websiteId: storeId });
  const say = useCallback((kind: DemoEventKind | (string & {}), label?: string) => push(simulatedToast(label ?? kind)), [push]);

  const createSchedule = useCallback<MonitoringApi["createSchedule"]>(
    ({ name, config, status }) => {
      const rc = ctxFor() ?? { channels: [], activePromptIds: new Set<string>(), costPerJobUsd: 0.06 };
      const rec = newScheduleRec({ id: newId("sch"), storeId, name, status, config, rc, nowIso: monitoringNow(), createdBy: INITIATOR });
      scheduleColl.create(rec, (r) => ({ kind: "schedule.created", label: status === "draft" ? "Draft saved" : "Schedule created", refs: ref(r.id) }));
      say(status === "draft" ? "Draft saved" : "schedule.created");
      return rec;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [ctxFor, scheduleColl, storeId, say],
  );

  const saveSchedule = useCallback<MonitoringApi["saveSchedule"]>(
    (id, name, config) => {
      const rec = live.current.schedules.find((s) => s.id === id);
      const rc = ctxFor();
      if (!rec || !rc) return;
      scheduleColl.update(id, editSchedulePatch(rec, name, config, rc, monitoringNow(), INITIATOR), { kind: "schedule.updated", label: `Schedule saved as version ${rec.currentVersion + 1}`, refs: ref(id) });
      say("schedule.updated", `Saved as version ${rec.currentVersion + 1}`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [ctxFor, scheduleColl, say],
  );

  const activateSchedule = useCallback<MonitoringApi["activateSchedule"]>(
    (id) => {
      const rec = live.current.schedules.find((s) => s.id === id);
      if (!rec) return;
      scheduleColl.update(id, { status: "active", statusReason: null, nextRunAt: nextRunAfter(rec.config, monitoringNow()) }, { kind: "schedule.updated", label: "Schedule activated", refs: ref(id) });
      say("Schedule activated");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [scheduleColl, say],
  );

  const pauseSchedule = useCallback<MonitoringApi["pauseSchedule"]>(
    (id) => {
      scheduleColl.update(id, { status: "paused", nextRunAt: null, statusReason: "Paused by you. No runs until resumed." }, { kind: "schedule.paused", label: "Schedule paused", refs: ref(id) });
      say("schedule.paused");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [scheduleColl, say],
  );

  const resumeSchedule = useCallback<MonitoringApi["resumeSchedule"]>(
    (id) => {
      const rec = live.current.schedules.find((s) => s.id === id);
      if (!rec) return;
      // Resume never replays missed runs: the next run is the next occurrence after now.
      scheduleColl.update(id, { status: "active", statusReason: null, nextRunAt: nextRunAfter(rec.config, monitoringNow()) }, { kind: "schedule.resumed", label: "Schedule resumed", refs: ref(id) });
      say("schedule.resumed");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [scheduleColl, say],
  );

  const cancelSchedule = useCallback<MonitoringApi["cancelSchedule"]>(
    (id) => {
      scheduleColl.update(id, { status: "cancelled", nextRunAt: null, statusReason: "Cancelled by you. Past runs are kept." }, { kind: "schedule.cancelled", label: "Schedule cancelled", refs: ref(id) });
      say("schedule.cancelled");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [scheduleColl, say],
  );

  const duplicateSchedule = useCallback<MonitoringApi["duplicateSchedule"]>(
    (id) => {
      const rec = live.current.schedules.find((s) => s.id === id);
      const rc = ctxFor();
      if (!rec || !rc) return null;
      const copy = newScheduleRec({ id: newId("sch"), storeId, name: `Copy of ${rec.name}`, status: "draft", config: rec.config, rc, nowIso: monitoringNow(), createdBy: INITIATOR, duplicateOf: rec.id });
      scheduleColl.create(copy, (r) => ({ kind: "schedule.duplicated", label: "Schedule duplicated", refs: { ...ref(r.id) } }));
      say("schedule.duplicated");
      return copy;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() only reads storeId
    [ctxFor, scheduleColl, storeId, say],
  );

  /** Loads the job-level answers of an earlier run. Dynamic import: the demo data only loads when a run is simulated or opened. */
  const loadBasis = useCallback(
    (runId: string): Promise<RunDetail | null> => {
      const key = `${storeId}|${runId}`;
      let pending = BASIS_CACHE.get(key);
      if (!pending) {
        pending = import("@/services/monitoring").then(({ getRunDetail }) => getRunDetail(storeId, runId));
        BASIS_CACHE.set(key, pending);
      }
      return pending;
    },
    [storeId],
  );

  const startRun = useCallback(
    async (args: {
      schedule: ScheduleRec;
      basis: RunDetail;
      select: RunRec["select"];
      purpose: RunPurpose;
      reason: string;
      taskId?: string;
      findingId?: string;
      retryOf?: string;
    }): Promise<ActionResult> => {
      const { schedule, basis } = args;
      const nowIso = monitoringNow();
      const costPerJob = data.ctx?.costPerJobUsd ?? 0.06;
      const plan = planSimulatedRun(basis.jobs, args.select, costPerJob, nowIso);
      if (plan.planned === 0) return { ok: false, reason: args.select.promptIds.length === 0 && !args.select.retry ? "None of the schedule's prompts is active. Activate a prompt in the library or edit the schedule." : "Nothing to run: the schedule selects no prompts and providers." };
      // Caps: jobs and estimated cost this month for the schedule, from runs that really counted.
      const used = scheduleMonthUsage(live.current.runs, schedule.id, nowIso);
      const check = checkRunCap({
        usedJobs: used.jobs,
        usedCostUsd: used.costUsd,
        runJobs: plan.planned,
        runCostUsd: plan.costUsd,
        capJobs: schedule.config.usageCap.jobsPerMonth,
        capCostUsd: schedule.config.usageCap.costUsd,
      });
      if (!check.ok) return { ok: false, reason: `${check.reason} Raise the cap in the schedule's advanced settings, or wait for the next month.` };

      const id = newId("run");
      const rec = buildRunRec({
        id,
        snapshotId: `snap-mon-demo-${id.split("-").pop()}`,
        schedule,
        basisRunId: basis.run.id,
        plan,
        select: args.select,
        purpose: args.purpose,
        reason: args.reason,
        initiator: INITIATOR,
        nowIso,
        taskId: args.taskId,
        findingId: args.findingId,
        retryOf: args.retryOf,
      });
      runColl.create(rec as unknown as RunSummary, { kind: "run.started", label: args.retryOf ? "Retry run started" : "Run started", refs: { runId: id, scheduleId: schedule.id, websiteId: storeId, taskId: args.taskId, findingId: args.findingId } });
      say("run.started");
      return { ok: true, id };
    },
    [data.ctx?.costPerJobUsd, runColl, storeId, say],
  );

  const runNow = useCallback<MonitoringApi["runNow"]>(
    async (input) => {
      const schedule = live.current.schedules.find((s) => s.id === input.scheduleId);
      if (!schedule) return { ok: false, reason: "This schedule no longer exists." };
      if (schedule.status === "cancelled" || schedule.status === "draft") return { ok: false, reason: schedule.status === "draft" ? "Activate the schedule before running it." : "Cancelled schedules cannot run." };
      if (live.current.runs.some((r) => r.scheduleId === schedule.id && isActiveRun(r.status))) return { ok: false, reason: "A run of this schedule is still going. Runs never overlap." };
      const basisSummary = pickBasisRun(live.current.runs, schedule.id);
      if (!basisSummary) return { ok: false, reason: "There is no earlier run to base the simulated answers on." };
      const basis = await loadBasis(basisSummary.id);
      if (!basis) return { ok: false, reason: "The earlier run could not be loaded." };
      const active = new Set(live.current.prompts.filter((p) => p.status === "active").map((p) => p.id));
      const promptIds = schedule.config.promptIds.filter((id) => active.size === 0 || active.has(id));
      const select: RunRec["select"] = {
        promptIds,
        channelIds: schedule.config.channelIds,
        maxSample: schedule.config.samples,
        catalog: buildRunCatalog({ config: schedule.config, promptIds, prompts: live.current.prompts, channelIds: schedule.config.channelIds, channels: data.ctx?.channels ?? [] }),
      };
      return startRun({ schedule, basis, select, purpose: input.purpose ?? "manual", reason: input.reason, taskId: input.taskId, findingId: input.findingId });
    },
    [loadBasis, startRun, data.ctx?.channels],
  );

  const retryFailed = useCallback<MonitoringApi["retryFailed"]>(
    async (run, detail) => {
      const schedule = live.current.schedules.find((s) => s.id === run.scheduleId);
      if (!schedule) return { ok: false, reason: "The schedule of this run no longer exists." };
      const failed = detail.jobs.filter((j) => j.status === "failed");
      if (failed.length === 0) return { ok: false, reason: "No failed jobs to retry." };
      if (live.current.runs.some((r) => r.scheduleId === schedule.id && isActiveRun(r.status))) return { ok: false, reason: "A run of this schedule is still going. Runs never overlap." };
      // A simulated run only replays its basis run, so a retry of it replays that same basis (the simulated run itself holds no answers).
      const simulatedRun = run as Partial<RunRec>;
      const basis = simulatedRun.simulated && simulatedRun.basisRunId ? await loadBasis(simulatedRun.basisRunId) : detail;
      if (!basis) return { ok: false, reason: "The earlier run could not be loaded." };
      const failedPromptIds = [...new Set(failed.map((j) => j.promptId))];
      const catalog = buildRunCatalog({
        // "latest": the text and version below are those of the failed jobs themselves, so a retry keeps the version that failed.
        config: { ...schedule.config, promptMode: "latest" },
        promptIds: failedPromptIds,
        prompts: failedPromptIds.map((id) => {
          const j = failed.find((x) => x.promptId === id)!;
          return { id, text: j.promptText, version: j.promptVersion };
        }),
        channelIds: [...new Set(failed.map((j) => j.channelId))],
        channels: data.ctx?.channels ?? [],
      });
      const select: RunRec["select"] = { promptIds: [], channelIds: [], maxSample: 99, onlyPairs: failed.map((j) => `${j.promptId}|${j.channelId}`), retry: true, catalog };
      return startRun({ schedule, basis, select, purpose: "retry", reason: `Retry of ${failed.length} failed job${failed.length === 1 ? "" : "s"} from ${run.id}`, retryOf: run.id });
    },
    [startRun, loadBasis, data.ctx?.channels],
  );

  const cancelRun = useCallback<MonitoringApi["cancelRun"]>(
    (id) => {
      runColl.update(id, cancelRunPatch(monitoringNow()) as Partial<RunSummary>, { kind: "run.completed", label: "Run cancelled", refs: { runId: id, websiteId: storeId } });
      say("Run cancelled");
    },
    [runColl, storeId, say],
  );

  const loadRunDetail = useCallback(
    async (run: RunRec): Promise<RunDetail | null> => {
      const basis = await loadBasis(run.basisRunId);
      return basis ? simulateRunDetail(run, basis, data.ctx?.costPerJobUsd ?? 0.06) : null;
    },
    [loadBasis, data.ctx?.costPerJobUsd],
  );

  // Simulated lifecycle: one tick moves every active run forward. Resumes where it stopped after a reload.
  const hasActive = simulatedRuns.some((r) => isActiveRun(r.status));
  const updateRun = runColl.update;
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      const nowIso = monitoringNow();
      for (const run of live.current.runs) {
        if (!(run as RunRec).simulated || !isActiveRun(run.status)) continue;
        const patch = advanceRun(run as RunRec, nowIso);
        if (!patch) continue;
        const finished = patch.status !== undefined && patch.status !== "running";
        updateRun(
          run.id,
          patch as Partial<RunSummary>,
          finished
            ? { kind: "run.completed", label: (run as RunRec).purpose === "verification" ? "Verification run completed" : "Run completed", refs: { runId: run.id, scheduleId: run.scheduleId, websiteId: storeId, taskId: (run as RunRec).taskId, findingId: (run as RunRec).findingId } }
            : undefined,
        );
        if (finished) push(simulatedToast("run.completed"));
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, updateRun, storeId, push]);

  const [runDialog, setRunDialog] = useState<RunNowRequest>({ open: false });
  const openRunNow = useCallback<MonitoringApi["openRunNow"]>((request) => setRunDialog({ ...request, open: true }), []);
  const closeRunNow = useCallback(() => setRunDialog((current) => ({ ...current, open: false })), []);

  const api = useMemo<MonitoringApi>(
    () => ({ data, base, schedules, runs, simulatedRuns, prompts, tasks, alerts, ctxFor, createSchedule, saveSchedule, activateSchedule, pauseSchedule, resumeSchedule, cancelSchedule, duplicateSchedule, runNow, retryFailed, cancelRun, loadRunDetail, runDialog, openRunNow, closeRunNow }),
    // `alerts` is a new object each render; its rows and count are what consumers read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, base, schedules, runs, simulatedRuns, prompts, tasks, alerts.rows, alerts.unreadCount, ctxFor, createSchedule, saveSchedule, activateSchedule, pauseSchedule, resumeSchedule, cancelSchedule, duplicateSchedule, runNow, retryFailed, cancelRun, loadRunDetail, runDialog, openRunNow, closeRunNow],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
