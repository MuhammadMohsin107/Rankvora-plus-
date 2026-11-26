import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

import { Badge } from "./badge";

/** Marks screens and records that use demonstration data. Tiny, neutral, never alarming. */
export function DemoBadge({ className, children = "Demo data" }: { className?: string; children?: ReactNode }) {
  return (
    <span
      title="Demonstration data. Nothing here comes from a real account."
      className={cn("inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border border-dashed border-line-strong px-2 text-xs font-medium leading-none text-fg-muted", className)}
    >
      {children}
    </span>
  );
}

/** Marks a result produced by a local, simulated action (no request left the browser). */
export function SimulatedBadge({ className, children = "Simulated" }: { className?: string; children?: ReactNode }) {
  return (
    <Badge tone="info" icon="layers" className={className} title="Simulated in this demo. No real request was sent.">
      {children}
    </Badge>
  );
}

type TrustLabelProps = {
  /** Number of AI response samples behind the figure. */
  samples?: number;
  /** Prompts included in the figure, and how many exist in scope. */
  promptsIncluded?: number;
  promptsTotal?: number;
  /** Extra short fact, e.g. "Run 18 Nov". Shown after the rest. */
  extra?: string;
  /** Replaces the generated text entirely. */
  children?: ReactNode;
  className?: string;
};

/** Pure text for the label, used by TrustLabel and unit-tested: "Based on 36 samples · 12 of 15 prompts". */
export function trustText({ samples, promptsIncluded, promptsTotal, extra }: Pick<TrustLabelProps, "samples" | "promptsIncluded" | "promptsTotal" | "extra">): string {
  const parts: string[] = [];
  if (samples !== undefined) parts.push(`Based on ${formatNumber(samples)} ${samples === 1 ? "sample" : "samples"}`);
  if (promptsIncluded !== undefined && promptsTotal !== undefined) parts.push(`${formatNumber(promptsIncluded)} of ${formatNumber(promptsTotal)} prompts`);
  if (extra) parts.push(extra);
  return parts.join(" · ");
}

/** Coverage line under a metric or chart: how much data the number rests on. */
export function TrustLabel({ children, className, ...rest }: TrustLabelProps) {
  const text = children ?? trustText(rest);
  if (!text) return null;
  return <p className={cn("tnum text-xs text-fg-muted", className)}>{text}</p>;
}
