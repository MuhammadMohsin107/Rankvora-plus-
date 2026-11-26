"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useDemoCollection, type EventArg } from "@/demo-state";
import type { ReportRow, ReportState } from "@/types/shared-records";

/** How long a simulated generation takes. Nothing is computed server-side: the report is built in the browser from demo data. */
export const GENERATE_MS = 4000;

/** Pure: progress 0-1 of a simulated generation at `now` (ms). Seeded reports without a window have no progress (null). */
export function generationProgress(row: Pick<ReportRow, "startedAt" | "readyAt">, now: number): number | null {
  if (!row.startedAt || !row.readyAt) return null;
  const start = Date.parse(row.startedAt);
  const end = Date.parse(row.readyAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/** Pure: milliseconds until a generating local row is ready (0 when due). null when the row is not simulated. */
export function msUntilReady(row: Pick<ReportRow, "status" | "readyAt">, now: number): number | null {
  if (row.status !== "generating" || !row.readyAt) return null;
  const end = Date.parse(row.readyAt);
  return Number.isFinite(end) ? Math.max(0, end - now) : null;
}

/** Source chosen in the generate dialog (see `ReportSource` in services/reports). */
export type NewReport = Pick<ReportRow, "type" | "sourceId" | "title" | "period" | "version" | "sourceHref">;

/** The generation window for a report that starts now. */
export function generationWindow(now: number): { startedAt: string; readyAt: string } {
  return { startedAt: new Date(now).toISOString(), readyAt: new Date(now + GENERATE_MS).toISOString() };
}

export type ReportsApi = {
  /** Seeded rows plus rows created or changed in this browser, for this website only. */
  rows: ReportRow[];
  /** Starts a simulated generation: the row is `generating` and becomes `ready` after a few seconds. */
  generate(source: NewReport): ReportRow;
  /** failed -> generating -> ready. */
  retry(id: string): void;
  setArchived(id: string, archived: boolean): void;
};

/**
 * Report rows for one website, merged with the local demo-state. Also resolves simulated generations:
 * a local row that is `generating` turns `ready` when its window ends, even if the page was closed meanwhile.
 */
export function useReports(storeId: string, baseRows: ReportRow[]): ReportsApi {
  const { rows: all, create, update } = useDemoCollection<ReportRow>("reports", baseRows);
  const rows = useMemo(() => all.filter((r) => r.storeId === storeId), [all, storeId]);

  const ready = useCallback(
    (row: ReportRow) => {
      const event: EventArg<string> = { kind: "report.generated", label: `Report ready: ${row.title}`, refs: { reportId: row.id, websiteId: storeId } };
      update(row.id, { status: "ready" satisfies ReportState }, event);
    },
    [update, storeId],
  );

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const now = Date.now();
    for (const row of rows) {
      const wait = msUntilReady(row, now);
      if (wait !== null) timers.push(setTimeout(() => ready(row), wait));
    }
    return () => timers.forEach(clearTimeout);
  }, [rows, ready]);

  const generate = useCallback(
    (source: NewReport) =>
      create({
        ...source,
        storeId,
        sourceLabel: source.sourceId,
        createdAt: new Date().toISOString(),
        status: "generating",
        ...generationWindow(Date.now()),
      }),
    [create, storeId],
  );

  const retry = useCallback((id: string) => update(id, { status: "generating", ...generationWindow(Date.now()) }), [update]);
  const setArchived = useCallback((id: string, archived: boolean) => update(id, { archived }), [update]);
  return { rows, generate, retry, setArchived };
}

/** Re-renders about twice a second while `active`, returning the current time in ms (for progress bars). */
export function useNow(active: boolean, everyMs = 400): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, everyMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active, everyMs]);
  return now;
}
