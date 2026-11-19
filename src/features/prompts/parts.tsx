import Link from "next/link";
import type { ReactNode } from "react";

import { Callout } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { LastResult, ResultState } from "@/types/prompts";

import type { DuplicateMatch } from "./text";

const MARK: Record<ResultState, { icon: IconName; text: string; label: string }> = {
  recommended: { icon: "check-circle", text: "text-success", label: "Recommended" },
  mentioned: { icon: "circle-dot", text: "text-info", label: "Mentioned" },
  absent: { icon: "minus-circle", text: "text-fg-muted", label: "Not mentioned" },
  failed: { icon: "x-circle", text: "text-danger", label: "Failed" },
  na: { icon: "minus", text: "text-fg-subtle", label: "N/A" },
};

/** One provider's latest result as icon + text, never colour alone. */
export function ResultMark({ result }: { result: LastResult }) {
  const mark = MARK[result.state];
  const detail =
    result.state === "na"
      ? "No response in the latest run"
      : result.state === "failed"
        ? `${result.failed} failed, not counted as absent`
        : `${result.mentioned} of ${result.samples} samples mention the brand${result.failed ? ` · ${result.failed} failed` : ""}`;
  return (
    <li className="flex items-center gap-1.5 text-xs" title={`${result.label}: ${mark.label}. ${detail}`}>
      <span className="w-[4.5rem] shrink-0 truncate text-fg-muted">{result.label}</span>
      <Icon name={mark.icon} size={13} className={cn("shrink-0", mark.text)} />
      <span className={cn("truncate", result.state === "na" ? "text-fg-subtle" : "text-fg")}>{mark.label}</span>
      {result.samples > 0 && result.state !== "na" ? <span className="tnum text-fg-subtle">{result.mentioned}/{result.samples}</span> : null}
    </li>
  );
}

/** `reason` explains an empty list, for example a store with no AI channel. Never shown as 0%. */
export function LastResults({ results, reason }: { results: LastResult[]; reason?: string }) {
  if (results.length === 0) {
    return (
      <span className="text-xs text-fg-subtle" title={reason}>
        N/A
        {reason ? <span className="block">{reason}</span> : null}
      </span>
    );
  }
  return (
    <ul className="flex min-w-[10.5rem] flex-col gap-0.5" aria-label="Latest result by provider">
      {results.map((r) => (
        <ResultMark key={r.channelId} result={r} />
      ))}
    </ul>
  );
}

/** Exact or near-duplicate notice. Near-duplicates never block saving. */
export function DuplicateNotice({ match, storeId }: { match: DuplicateMatch; storeId: string }) {
  const exact = match.kind === "exact";
  return (
    <Callout
      tone="warning"
      title={exact ? "This prompt already exists" : "A very similar prompt exists"}
      actions={
        <Link href={`/stores/${storeId}/prompts/${match.id}`} className="text-[13px] font-medium text-accent-text hover:underline">
          Open
        </Link>
      }
    >
      <span className="[overflow-wrap:anywhere]">“{match.text}”{exact ? "" : " You can still add this as a variant."}</span>
    </Callout>
  );
}

/** Labelled group of controls (radios, checkboxes) with a visible legend. */
export function FieldGroup({ legend, hint, children, className }: { legend: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-[13px] font-medium text-fg">{legend}</legend>
      {children}
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </fieldset>
  );
}

/** Live "n / max" character counter. */
export function CharCount({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span className={cn("tnum text-xs", over ? "font-medium text-danger" : "text-fg-subtle")} aria-live="polite">
      {value} / {max}
    </span>
  );
}
