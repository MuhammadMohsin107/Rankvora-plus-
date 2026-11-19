import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { diffWords } from "@/lib/diff";
import type { Tone } from "@/lib/status";

import { Icon, type IconName } from "./icon";

export function Breadcrumb({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-fg-subtle">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="rounded px-0.5 hover:text-fg hover:underline">{item.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={last ? "text-fg-muted" : undefined}>{item.label}</span>
              )}
              {!last ? <Icon name="chevron-right" size={13} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type TimelineItem = {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  time?: string;
  icon?: IconName;
  tone?: Tone;
};

const dotTone: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-subtle border-line",
  accent: "bg-accent-soft text-accent-text border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  info: "bg-info-soft text-info border-transparent",
};

/** Vertical timeline for activity, version history, fixes. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
          {index < items.length - 1 ? <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-line" /> : null}
          <span className={cn("relative z-[1] mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border", dotTone[item.tone ?? "neutral"])}>
            <Icon name={item.icon ?? "circle"} size={12} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-medium text-fg">{item.title}</p>
              {item.time ? <time className="tnum shrink-0 text-xs text-fg-subtle">{item.time}</time> : null}
            </div>
            {item.meta ? <div className="mt-0.5 text-xs text-fg-muted">{item.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Side-by-side before/after with word-level highlights (not colour alone: strike / underline too). */
export function DiffView({ before, after, beforeLabel = "Before", afterLabel = "After", className }: { before: string; after: string; beforeLabel?: string; afterLabel?: string; className?: string }) {
  const parts = diffWords(before, after);
  const unchanged = before === after;
  return (
    <div className={cn("grid gap-3 md:grid-cols-2", className)}>
      <figure className="min-w-0 rounded-control border border-line bg-surface">
        <figcaption className="border-b border-line bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-fg-muted">{beforeLabel}</figcaption>
        <p className="whitespace-pre-wrap break-words p-3 text-[13px] leading-relaxed text-fg [overflow-wrap:anywhere]">
          {before === "" ? <span className="text-fg-subtle">(empty)</span> : parts.filter((p) => p.kind !== "added").map((p, i) => (
            <span key={i} className={p.kind === "removed" ? "rounded-sm bg-danger-soft text-danger line-through decoration-1" : undefined}>{p.text}</span>
          ))}
        </p>
      </figure>
      <figure className="min-w-0 rounded-control border border-line bg-surface">
        <figcaption className="border-b border-line bg-surface-2/70 px-3 py-1.5 text-xs font-medium text-fg-muted">{afterLabel}{unchanged ? " · no change" : ""}</figcaption>
        <p className="whitespace-pre-wrap break-words p-3 text-[13px] leading-relaxed text-fg [overflow-wrap:anywhere]">
          {after === "" ? <span className="text-fg-subtle">(empty)</span> : parts.filter((p) => p.kind !== "removed").map((p, i) => (
            <span key={i} className={p.kind === "added" ? "rounded-sm bg-success-soft text-success underline decoration-1 underline-offset-2" : undefined}>{p.text}</span>
          ))}
        </p>
      </figure>
    </div>
  );
}

/** Marks text with the provider's mention spans, e.g. in an original AI answer. */
export function HighlightedText({ text, spans, className }: { text: string; spans: { start: number; end: number; kind?: "brand" | "competitor" }[]; className?: string }) {
  const ordered = [...spans].sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((span, index) => {
    if (span.start < cursor) return;
    if (span.start > cursor) out.push(<span key={`t${index}`}>{text.slice(cursor, span.start)}</span>);
    out.push(
      <mark
        key={`m${index}`}
        className={cn("rounded-sm px-0.5 font-medium", span.kind === "competitor" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent-text")}
        title={span.kind === "competitor" ? "Competitor mention" : "Brand mention"}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  return <p className={cn("whitespace-pre-wrap text-[13px] leading-relaxed text-fg", className)}>{out}</p>;
}

/** Mono-spaced identifier / URL chip with copy-friendly wrapping. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cn("break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-fg-muted", className)}>{children}</code>;
}
