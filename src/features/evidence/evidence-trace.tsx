"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { useDemoEvents } from "@/demo-state";

import { EVIDENCE_KIND_LABEL, buildEvidenceChain, mergeEvidenceEvents, type EvidenceIds, type EvidenceKind, type EvidenceNode } from "./chain";

const KIND_ICON: Record<EvidenceKind, IconName> = {
  metric: "trend-up",
  prompt: "prompts",
  response: "sparkles",
  citation: "link",
  finding: "flag",
  fix: "fixes",
  verification: "shield-check",
  observation: "monitoring",
  comparison: "compare",
};

export type EvidenceTraceProps = {
  /** Shared ids. Chips appear for the ids that exist, in the order Metric, Prompt, Response, Citation, Finding, Fix, Verification, Observation, Comparison. */
  ids: EvidenceIds;
  /** `full` shows the type and the record id in each chip. `compact` shows an icon and a short id, for table cells and drawers. */
  variant?: "full" | "compact";
  /** Fold locally recorded demo events (task created, verified, comparison annotated) into the chain. Default true. */
  live?: boolean;
  /** When set, Response and Citation chips call this with the response id instead of navigating (open a ResponseDrawer). */
  onOpenResponse?: (responseId: string) => void;
  /** Accessible name of the list. Default "Evidence trace". */
  label?: string;
  className?: string;
};

function Chip({ node, compact, responseId, onOpenResponse }: { node: EvidenceNode; compact: boolean; responseId?: string; onOpenResponse?: (responseId: string) => void }) {
  const kind = EVIDENCE_KIND_LABEL[node.kind];
  const showId = node.label !== kind;
  const opensDrawer = onOpenResponse && responseId && (node.kind === "response" || node.kind === "citation");
  const classes = cn(
    "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-line bg-surface text-fg transition-colors duration-[var(--dur-fast)] hover:border-line-strong hover:bg-surface-2",
    compact ? "h-6 px-1.5 text-helper" : "h-7 px-2.5 text-label pointer-coarse:h-9",
  );
  const body = (
    <>
      <Icon name={KIND_ICON[node.kind]} size={compact ? 12 : 14} className="shrink-0 text-fg-subtle" />
      {compact ? null : <span className="shrink-0 font-medium">{kind}</span>}
      {showId || compact ? <span className={cn("truncate text-fg-muted", "max-w-40")}>{node.label}</span> : null}
    </>
  );
  const title = `${kind}: ${node.label}`;
  if (opensDrawer) {
    return (
      <button type="button" className={cn(classes, "cursor-pointer")} title={title} aria-label={title} onClick={() => onOpenResponse(responseId)}>
        {body}
      </button>
    );
  }
  return (
    <Link href={node.href} className={classes} title={title} aria-label={title}>
      {body}
    </Link>
  );
}

const nodeResponseId = (node: EvidenceNode, ids: EvidenceIds) => (node.kind === "response" ? node.id : node.kind === "citation" ? ids.responseId : undefined);

/**
 * The evidence chain for one record as linked chips: Metric > Prompt > Response > Citation > Finding > Fix
 * (> Verification > Observation > Comparison). Built from shared ids by `buildEvidenceChain`;
 * every chip links to the real page. Renders nothing when no id is known.
 */
export function EvidenceTrace({ ids, variant = "full", live = true, onOpenResponse, label = "Evidence trace", className }: EvidenceTraceProps) {
  const events = useDemoEvents();
  const nodes = useMemo(() => buildEvidenceChain(live ? mergeEvidenceEvents(ids, events).ids : ids), [ids, events, live]);
  if (nodes.length === 0) return null;
  const compact = variant === "compact";
  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className={cn("flex min-w-0 flex-wrap items-center", compact ? "gap-x-0.5 gap-y-1" : "gap-x-1 gap-y-1.5")}>
        {nodes.map((node, index) => (
          <li key={node.kind} className="flex min-w-0 items-center">
            {index > 0 ? <Icon name="chevron-right" size={compact ? 12 : 14} className="mr-0.5 shrink-0 text-fg-faint" /> : null}
            <Chip node={node} compact={compact} responseId={nodeResponseId(node, ids)} onOpenResponse={onOpenResponse} />
          </li>
        ))}
      </ol>
    </nav>
  );
}
