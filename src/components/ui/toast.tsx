"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

export type ToastTone = "success" | "danger" | "warning" | "info" | "simulated";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Optional action button, e.g. "View task". Runs, then the toast closes. */
  action?: { label: string; onClick: () => void };
  /** Shorthand for an "Undo" action. */
  undo?: () => void;
  /** Auto-dismiss time in ms. Default 4500 (5000 when there is an action or an error). */
  duration?: number;
};
type ToastItem = ToastInput & { id: number };
type ToastApi = {
  push: (toast: ToastInput) => void;
  success: (title: string, extra?: Omit<ToastInput, "title" | "tone">) => void;
  error: (title: string, extra?: Omit<ToastInput, "title" | "tone">) => void;
  info: (title: string, extra?: Omit<ToastInput, "title" | "tone">) => void;
  /** For frontend-only actions that did not reach a real service. */
  simulated: (title: string, extra?: Omit<ToastInput, "title" | "tone">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;

const toneIcon: Record<ToastTone, IconName> = {
  success: "check-circle",
  danger: "alert-circle",
  warning: "alert-triangle",
  info: "info",
  simulated: "layers",
};
const toneText: Record<ToastTone, string> = {
  success: "text-success-text",
  danger: "text-danger-text",
  warning: "text-warning-text",
  info: "text-info-text",
  simulated: "text-accent-text",
};

/** Default time on screen: long enough to read, short enough to stay out of the way. */
export function toastDuration(toast: Pick<ToastInput, "duration" | "tone" | "action" | "undo">): number {
  if (toast.duration !== undefined) return toast.duration;
  return toast.tone === "danger" || toast.action || toast.undo ? 5000 : 4500;
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const tone = item.tone ?? "success";
  const timer = useRef(0);
  const remaining = useRef(toastDuration(item));
  const startedAt = useRef(0);
  const hovering = useRef(false);
  const focusing = useRef(false);

  const start = useCallback(() => {
    window.clearTimeout(timer.current);
    startedAt.current = performance.now();
    timer.current = window.setTimeout(() => onDismiss(item.id), remaining.current);
  }, [item.id, onDismiss]);

  const pause = useCallback(() => {
    if (!startedAt.current) return;
    window.clearTimeout(timer.current);
    remaining.current = Math.max(1000, remaining.current - (performance.now() - startedAt.current));
    startedAt.current = 0;
  }, []);

  const maybeResume = useCallback(() => {
    if (!hovering.current && !focusing.current && !startedAt.current) start();
  }, [start]);

  useEffect(() => {
    start();
    return () => window.clearTimeout(timer.current);
  }, [start]);

  const action = item.action ?? (item.undo ? { label: "Undo", onClick: item.undo } : undefined);

  return (
    <div
      onMouseEnter={() => {
        hovering.current = true;
        pause();
      }}
      onMouseLeave={() => {
        hovering.current = false;
        maybeResume();
      }}
      onFocus={() => {
        focusing.current = true;
        pause();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        focusing.current = false;
        maybeResume();
      }}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-line bg-surface p-3 shadow-pop [animation:ui-pop_var(--dur)_var(--ease)]"
    >
      <Icon name={toneIcon[tone]} size={18} className={cn("mt-0.5 shrink-0", toneText[tone])} />
      <div className="min-w-0 flex-1">
        {tone === "simulated" ? <p className="mb-0.5 text-xs font-medium text-accent-text">Simulated</p> : null}
        <p className="text-sm font-medium text-fg">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-[13px] text-fg-muted">{item.description}</p> : null}
        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss(item.id);
            }}
            className="-ml-1 mt-1.5 inline-flex h-7 cursor-pointer items-center rounded-control px-1 text-[13px] font-medium text-accent-text hover:bg-accent-soft pointer-coarse:min-h-11 pointer-coarse:px-2"
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
        className="-mr-1 -mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg pointer-coarse:size-11"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const push = useCallback((toast: ToastInput) => {
    counter.current += 1;
    const id = counter.current;
    // Stack of at most three: the oldest makes room.
    setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { ...toast, id }]);
  }, []);

  const value = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, extra) => push({ ...extra, title, tone: "success" }),
      error: (title, extra) => push({ ...extra, title, tone: "danger" }),
      info: (title, extra) => push({ ...extra, title, tone: "info" }),
      simulated: (title, extra) => push({ ...extra, title, tone: "simulated" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* polite live region: announces without stealing focus; timers pause while a toast is hovered or focused */}
      <div aria-live="polite" aria-atomic="false" role="status" className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
