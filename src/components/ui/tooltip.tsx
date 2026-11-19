import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * CSS-only tooltip: shown on hover and keyboard focus of the wrapped control.
 * Keep content to one short sentence; use a drawer for anything longer.
 */
export function Tooltip({ content, children, side = "top", className }: { content: string; children: ReactNode; side?: "top" | "bottom"; className?: string }) {
  const id = useId();
  return (
    <span className={cn("group/tip relative inline-flex", className)} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-[70] w-max max-w-[260px] -translate-x-1/2 rounded-md bg-fg px-2 py-1 text-xs font-normal leading-snug text-canvas opacity-0 shadow-pop transition-opacity duration-[var(--dur-fast)] group-focus-within/tip:opacity-100 group-hover/tip:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
