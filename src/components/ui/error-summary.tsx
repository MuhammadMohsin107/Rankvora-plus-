"use client";

import { useId, type Ref } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";

export type ErrorSummaryItem = {
  /** Short name of the field or problem. The specific message stays next to the field. */
  label: string;
  /** The exact message, shown as a tooltip. */
  detail?: string;
  /** Id of the control to focus: renders a link to it. */
  targetId?: string;
  /** Alternative to `targetId` when the id is generated: renders a button that runs this. */
  onSelect?: () => void;
};

type ErrorSummaryProps = {
  items: ErrorSummaryItem[];
  /** "Fix 3 fields to continue". */
  noun?: string;
  /** Give the summary focus after a failed submit. */
  ref?: Ref<HTMLDivElement>;
  className?: string;
};

const chip =
  "inline-flex h-target cursor-pointer items-center rounded-full border border-danger/30 bg-surface px-2.5 text-label font-medium text-danger-text transition-colors duration-[var(--dur-fast)] hover:bg-danger-soft pointer-coarse:h-9";

/**
 * Failed-submit summary for a form. One quiet line: a danger icon, what to do, and one chip per field that jumps
 * to it. The specific message stays at the field (inline), so nothing is said twice. Focusable, announced as an alert.
 */
export function ErrorSummary({ items, noun = "field", ref, className }: ErrorSummaryProps) {
  const titleId = useId();
  const count = items.length;
  if (count === 0) return null;
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-l-[3px] border-line border-l-danger bg-surface-2 px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-danger",
        className,
      )}
    >
      <p id={titleId} className="flex items-center gap-1.5 text-body-sm font-medium text-fg">
        <Icon name="alert-circle" size={16} className="shrink-0 text-danger-icon" />
        {`Fix ${count} ${count === 1 ? noun : `${noun}s`} to continue`}
      </p>
      <ul className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <li key={`${item.targetId ?? ""}${item.label}`}>
            {item.targetId ? (
              <a
                href={`#${item.targetId}`}
                title={item.detail}
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById(item.targetId as string)?.focus();
                }}
                className={chip}
              >
                {item.label}
              </a>
            ) : item.onSelect ? (
              <button type="button" title={item.detail} onClick={item.onSelect} className={chip}>
                {item.label}
              </button>
            ) : (
              <span className="text-label text-fg">{item.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
