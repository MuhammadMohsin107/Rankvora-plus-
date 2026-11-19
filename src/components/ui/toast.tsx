"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/status";

import { Icon, type IconName } from "./icon";

type ToastInput = { title: string; description?: string; tone?: Extract<Tone, "success" | "danger" | "warning" | "info"> };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ push: (toast: ToastInput) => void } | null>(null);

const toneIcon: Record<NonNullable<ToastInput["tone"]>, IconName> = {
  success: "check-circle",
  danger: "alert-circle",
  warning: "alert-triangle",
  info: "info",
};
const toneText = { success: "text-success", danger: "text-danger", warning: "text-warning", info: "text-info" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const push = useCallback(
    (toast: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setItems((current) => [...current.slice(-3), { ...toast, id }]);
      // Auto-dismiss (3–5s guidance); errors stay a little longer.
      setTimeout(() => dismiss(id), toast.tone === "danger" ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* polite live region: announces without stealing focus */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((item) => {
          const tone = item.tone ?? "success";
          return (
            <div key={item.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-card border border-line bg-surface p-3 shadow-pop [animation:ui-pop_var(--dur)_var(--ease)]">
              <Icon name={toneIcon[tone]} size={18} className={cn("mt-0.5 shrink-0", toneText[tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{item.title}</p>
                {item.description ? <p className="mt-0.5 text-[13px] text-fg-muted">{item.description}</p> : null}
              </div>
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(item.id)} className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg">
                <Icon name="x" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
