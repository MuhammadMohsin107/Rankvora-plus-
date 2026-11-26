"use client";

/**
 * Audits in this browser: the seeded audits plus the simulated ones created from the wizard, with the actions
 * that move them (start, pause, resume, cancel, discard) and the runner that records a finished run.
 * A run is driven by a stored clock, so it keeps going across navigation and reloads.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import { useToast } from "@/components/ui/toast";
import { demoNow, demoStore, simulatedToast, useDemoCollection } from "@/demo-state";
import type { AuditRow } from "@/types/audit";

import { OUTCOME_LABEL, buildAuditRow, cancelPatch, finalizePatch, liveRow, pausePatch, resumePatch, startDraftPatch, type NewAuditInput } from "./rows";
import { isTerminal } from "./simulation";

// ---------------------------------------------------------------------------
// Shared clock (one interval for every subscriber)
// ---------------------------------------------------------------------------

let nowValue = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    nowValue = Date.now();
    timer = setInterval(() => {
      nowValue = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
const getNow = () => {
  if (nowValue === 0) nowValue = Date.now();
  return nowValue;
};

/** Milliseconds since the epoch, refreshed every second while something is subscribed. 0 on the server. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getNow, () => 0);
}

const NOOP = () => () => {};
/** False on the server and during hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(NOOP, () => true, () => false);
}

const idOfAudit = (row: AuditRow) => row.id;

function storedRow(id: string): AuditRow | null {
  const overlay = demoStore.getSnapshot().audits;
  const created = overlay.created.find((r) => r.id === id) as unknown as AuditRow | undefined;
  if (!created) return null;
  return { ...created, ...(overlay.patched[id] as Partial<AuditRow> | undefined) };
}

export function useAudits(storeId: string, seeded: AuditRow[]) {
  const { rows, create, update, remove, isDemoCreated } = useDemoCollection<AuditRow>("audits", seeded, idOfAudit);
  const toast = useToast();
  const push = toast.push;
  const now = useNow();

  const forStore = useMemo(() => rows.filter((r) => r.storeId === storeId), [rows, storeId]);
  const live = useMemo(() => (now === 0 ? forStore : forStore.map((r) => liveRow(r, now))), [forStore, now]);
  const find = useCallback((id: string) => forStore.find((r) => r.id === id), [forStore]);

  const createAudit = useCallback(
    (input: Omit<NewAuditInput, "nowMs" | "stamp" | "storeId">) => {
      const nowMs = Date.parse(demoNow());
      const stamp = new Date(nowMs).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
      const draft = buildAuditRow({ ...input, storeId, nowMs, stamp });
      const created = create(draft, (r) => ({
        kind: "audit.started",
        label: input.asDraft ? "Audit draft saved" : "Audit started",
        refs: { auditId: r.id, websiteId: storeId },
      }));
      push(simulatedToast(input.asDraft ? "Audit draft saved" : "Audit started"));
      return created;
    },
    [create, push, storeId],
  );

  const pause = useCallback(
    (id: string) => {
      const row = storedRow(id) ?? find(id);
      if (!row) return;
      const patch = pausePatch(row, Date.parse(demoNow())) ?? (!row.plan && row.status === "in_progress" ? { paused: true } : null);
      if (!patch) return;
      update(id, patch, { kind: "audit.paused", label: "Audit paused", refs: { auditId: id, websiteId: row.storeId } });
      push({ title: "Audit paused (simulated)", description: "The clock is stopped. Resume to continue.", tone: "info" });
    },
    [find, push, update],
  );

  const resume = useCallback(
    (id: string) => {
      const row = storedRow(id) ?? find(id);
      if (!row) return;
      const patch = resumePatch(row, Date.parse(demoNow())) ?? (!row.plan && row.paused ? { paused: false } : null);
      if (!patch) return;
      update(id, patch, { kind: "audit.resumed", label: "Audit resumed", refs: { auditId: id, websiteId: row.storeId } });
      push(simulatedToast("Audit resumed", "info"));
    },
    [find, push, update],
  );

  const cancel = useCallback(
    (id: string) => {
      const row = storedRow(id) ?? find(id);
      if (!row) return;
      const nowMs = Date.parse(demoNow());
      const patch = cancelPatch(row, nowMs) ?? (!row.plan && !isTerminal(row.status) ? { status: "cancelled" as const, paused: false, provisional: false, endedAt: new Date(nowMs).toISOString() } : null);
      if (!patch) return;
      update(id, patch, { kind: "audit.cancelled", label: "Audit cancelled", refs: { auditId: id, websiteId: row.storeId } });
      push(simulatedToast("audit.cancelled", "info"));
    },
    [find, push, update],
  );

  const start = useCallback(
    (id: string) => {
      const row = storedRow(id);
      const patch = row ? startDraftPatch(row, Date.parse(demoNow())) : null;
      if (!patch) return;
      update(id, patch, { kind: "audit.started", label: "Audit started", refs: { auditId: id, websiteId: storeId } });
      push(simulatedToast("audit.started"));
    },
    [push, storeId, update],
  );

  const discard = useCallback(
    (id: string) => {
      remove(id);
      push({ title: "Draft discarded", tone: "info" });
    },
    [push, remove],
  );

  // Records a run that reached its end, once, whichever page is open.
  useEffect(() => {
    if (now === 0) return;
    for (const row of forStore) {
      if (!row.plan || !row.run || isTerminal(row.status) || row.status === "draft") continue;
      const fresh = storedRow(row.id);
      if (!fresh) continue;
      const patch = finalizePatch(fresh, now);
      if (!patch) continue;
      const status = patch.status ?? fresh.status;
      update(row.id, patch, { kind: "audit.completed", label: `Audit ${OUTCOME_LABEL[status].toLowerCase()}`, refs: { auditId: row.id, websiteId: row.storeId } });
      push({
        title: `Audit ${OUTCOME_LABEL[status].toLowerCase()} (simulated)`,
        description: row.title,
        tone: status === "failed" || status === "blocked" ? "warning" : "success",
      });
    }
  }, [now, forStore, update, push]);

  return { rows: forStore, live, now, createAudit, pause, resume, cancel, start, discard, isDemoCreated };
}
