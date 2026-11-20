import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import type { LastResult, ResultState } from "@/types/prompts";

import type { DuplicateMatch } from "./text";

const MARK: Record<ResultState, { icon: IconName; text: string; label: string }> = {
  recommended: { icon: "check-circle", text: "text-success-icon", label: "Recommended" },
  mentioned: { icon: "circle-dot", text: "text-info-icon", label: "Mentioned" },
  absent: { icon: "minus-circle", text: "text-fg-muted", label: "Not mentioned" },
  failed: { icon: "x-circle", text: "text-danger-icon", label: "Failed" },
  na: { icon: "minus", text: "text-fg-subtle", label: "N/A" },
};

/** One provider's latest result: a small chip with icon, provider name and a screen-reader state. Detail in the tooltip. */
export function ResultMark({ result }: { result: LastResult }) {
  const mark = MARK[result.state];
  const detail =
    result.state === "na"
      ? "No response in the latest run"
      : result.state === "failed"
        ? `${result.failed} failed, not counted as absent`
        : `${result.mentioned} of ${result.samples} samples mention the brand${result.failed ? ` · ${result.failed} failed` : ""}`;
  return (
    <li title={`${result.label}: ${mark.label}. ${detail}`} className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2 text-helper text-fg">
      <Icon name={mark.icon} size={12} className={cn("shrink-0", mark.text)} />
      <span className="max-w-20 truncate">{result.label}</span>
      <span className="sr-only">: {mark.label}. {detail}</span>
    </li>
  );
}

/** Latest result per provider on one line of chips. `reason` explains an empty list. Never shown as 0%. */
export function LastResults({ results, reason }: { results: LastResult[]; reason?: string }) {
  if (results.length === 0) {
    return (
      <span className="text-helper text-fg-muted" title={reason}>
        {reason ?? "Not run yet"}
      </span>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Latest result by provider">
      {results.map((r) => (
        <ResultMark key={r.channelId} result={r} />
      ))}
    </ul>
  );
}

/** Brand-specific or neutral, from the wording. */
export function PromptKind({ mentionsBrand }: { mentionsBrand: boolean }) {
  return mentionsBrand ? (
    <Badge tone="neutral" icon="building" title="Names the brand: usually scores higher on mentions">
      Names brand
    </Badge>
  ) : (
    <Badge tone="info" icon="search" title="Does not name the brand: tests whether AI brings it up">
      Neutral
    </Badge>
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
        <Link href={`/stores/${storeId}/prompts/${match.id}`} className="text-body-sm font-medium text-accent-text hover:underline">
          Open
        </Link>
      }
    >
      <span className="[overflow-wrap:anywhere]">“{match.text}”{exact ? "" : " You can still add it as a variant."}</span>
    </Callout>
  );
}

/** Labelled group of controls (radios, checkboxes) with a visible legend. */
export function FieldGroup({ legend, hint, children, className }: { legend: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <legend className="mb-1.5 text-body-sm font-medium text-fg">{legend}</legend>
      {children}
      {hint ? <p className="text-helper text-fg-muted">{hint}</p> : null}
    </fieldset>
  );
}

/** Live "n / max" character counter. */
export function CharCount({ value, max }: { value: number; max: number }) {
  const over = value > max;
  return (
    <span className={cn("tnum text-helper", over ? "font-medium text-danger-text" : "text-fg-muted")} aria-live="polite">
      {value} / {max}
    </span>
  );
}
