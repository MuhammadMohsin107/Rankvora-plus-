"use client";

import { cn } from "@/lib/cn";

import { useDemoSync } from "./provider";
import type { SyncStatus } from "./sync";

const COPY: Record<SyncStatus, { label: string; dot: string; hint: string }> = {
  local: { label: "On this device", dot: "bg-fg-faint", hint: "Demo changes are stored in this browser." },
  syncing: { label: "Saving…", dot: "bg-info-icon", hint: "Saving demo changes to the server." },
  synced: { label: "Saved", dot: "bg-success-icon", hint: "Demo changes are saved to the server." },
  offline: { label: "Saved on this device", dot: "bg-warning-icon", hint: "The server is not reachable. Changes stay in this browser and are retried." },
};

/**
 * Tiny sync status for the demo workspace: a dot and two or three words.
 * Mount it once in the shell (for example next to the profile menu or in the sidebar footer).
 */
/** `className` replaces the default display (`inline-flex`), so a caller can pass e.g. "hidden lg:inline-flex". */
export function SyncIndicator({ className }: { className?: string }) {
  const { status, lastSyncedAt } = useDemoSync();
  const { label, dot, hint } = COPY[status];
  const when = status === "synced" && lastSyncedAt ? ` Last saved ${new Date(lastSyncedAt).toLocaleTimeString()}.` : "";
  return (
    <span role="status" aria-live="polite" title={hint + when} className={cn("items-center gap-1.5 whitespace-nowrap text-xs text-fg-muted", className ?? "inline-flex")}>
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {label}
    </span>
  );
}
