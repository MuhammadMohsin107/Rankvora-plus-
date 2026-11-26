import { OPEN_FINDING_STATUSES, OPEN_TASK_STATUSES } from "@/lib/record-status";
import type { Rate } from "@/types/core";

export type TrendRun = { runId: string; date: string; mention: Rate; recommendation: Rate };

const day = (iso: string) => iso.slice(0, 10);

/** Runs whose day falls inside the inclusive `YYYY-MM-DD` range, oldest first. */
export function runsInWindow<T extends Pick<TrendRun, "date">>(runs: readonly T[], from: string, to: string): T[] {
  return runs.filter((r) => day(r.date) >= from && day(r.date) <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export type WindowChange = {
  baseline: TrendRun;
  current: TrendRun;
  /** "before": the last run before the window. "first": the first run inside it (no earlier run exists). */
  basis: "before" | "first";
  /** Runs inside the window. */
  runCount: number;
};

/**
 * What changed across the selected window: the latest run in the window against the last run before it
 * (or the first run inside it when nothing came earlier). Null when the window holds no run or only one run
 * with nothing to compare against.
 */
export function changeInWindow(runs: readonly TrendRun[], from: string, to: string): WindowChange | null {
  const inside = runsInWindow(runs, from, to);
  if (inside.length === 0) return null;
  const current = inside[inside.length - 1];
  const before = [...runs].filter((r) => day(r.date) < from).sort((a, b) => a.date.localeCompare(b.date));
  if (before.length > 0) return { baseline: before[before.length - 1], current, basis: "before", runCount: inside.length };
  if (inside.length < 2) return null;
  return { baseline: inside[0], current, basis: "first", runCount: inside.length };
}

const PRIORITY = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
const SEVERITY = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as const;

export type FindingLike = { id: string; title: string; priority: keyof typeof PRIORITY; severity: keyof typeof SEVERITY; status: string };
export type TaskLike = { id: string; title: string; status: string; findingId?: string; priority?: keyof typeof PRIORITY };

/** Open findings, most urgent first (priority, then severity, then id for a stable order). */
export function openFindings<T extends FindingLike>(findings: readonly T[]): T[] {
  return findings
    .filter((f) => OPEN_FINDING_STATUSES.has(f.status as never))
    .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || SEVERITY[a.severity] - SEVERITY[b.severity] || a.id.localeCompare(b.id));
}

export function biggestProblem<T extends FindingLike>(findings: readonly T[]): T | null {
  return openFindings(findings)[0] ?? null;
}

export type NextAction =
  | { kind: "approve"; label: string; detail: string; href: string }
  | { kind: "failed"; label: string; detail: string; href: string }
  | { kind: "finding"; label: string; detail: string; href: string }
  | { kind: "audit"; label: string; detail: string; href: string }
  | { kind: "none"; label: string; detail: string; href: string };

type NextInput = {
  base: string;
  findings: readonly FindingLike[];
  tasks: readonly TaskLike[];
  auditInProgress: { id: string; title: string } | null;
};

const byPriority = <T extends { priority?: keyof typeof PRIORITY }>(a: T, b: T) => (PRIORITY[a.priority ?? "P3"] ?? 3) - (PRIORITY[b.priority ?? "P3"] ?? 3);

/** The single next step: approve a waiting fix, retry a failed one, plan a fix for the top finding, follow a running audit, else start one. */
export function nextAction({ base, findings, tasks, auditInProgress }: NextInput): NextAction {
  const waiting = tasks.filter((t) => t.status === "pending_approval").sort(byPriority)[0];
  if (waiting) return { kind: "approve", label: "Review a fix", detail: waiting.title, href: `${base}/fixes/tasks/${waiting.id}` };
  const failed = tasks.filter((t) => t.status === "failed").sort(byPriority)[0];
  if (failed) return { kind: "failed", label: "Resolve a failed fix", detail: failed.title, href: `${base}/fixes/tasks/${failed.id}` };
  const covered = new Set(tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status) && t.findingId).map((t) => t.findingId as string));
  const uncovered = openFindings(findings).find((f) => !covered.has(f.id));
  if (uncovered) return { kind: "finding", label: "Plan a fix", detail: uncovered.title, href: `${base}/fixes/findings/${uncovered.id}` };
  if (auditInProgress) return { kind: "audit", label: "Follow the audit", detail: auditInProgress.title, href: `${base}/audits/${auditInProgress.id}` };
  return { kind: "none", label: "Run a new audit", detail: "No open fixes. A new audit refreshes the findings.", href: `${base}/audits/new` };
}
