"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

import type { ShellWebsite } from "./website-selector";

type EntryType = "Website" | "Page";

type Entry = {
  key: string;
  type: EntryType;
  label: string;
  hint: string;
  href: string;
  websiteId: string | null;
  haystack: string;
};

const TYPE_ORDER: EntryType[] = ["Website", "Page"];
const TYPE_ICON: Record<EntryType, IconName> = { Website: "globe", Page: "file-text" };
const PER_TYPE_LIMIT = 8;
const TOTAL_LIMIT = 16;

const ORG_PAGES: { label: string; href: string }[] = [
  { label: "Websites & Brands", href: "/stores" },
  { label: "Add website", href: "/stores/new" },
  { label: "Help & Support", href: "/help" },
];

const WEBSITE_PAGES: { label: string; path: string }[] = [
  { label: "Dashboard", path: "" },
  { label: "Prompt Library", path: "/prompts" },
  { label: "Website settings", path: "/settings" },
];

function buildEntries(websites: ShellWebsite[]): Entry[] {
  const out: Entry[] = [];
  const add = (type: EntryType, key: string, label: string, hint: string, href: string, websiteId: string | null) =>
    out.push({ key: `${type}:${key}`, type, label, hint, href, websiteId, haystack: `${label} ${hint} ${type}`.toLowerCase() });
  for (const w of websites) add("Website", w.id, w.name, `${w.domain} · ${w.market}`, `/stores/${w.id}`, w.id);
  for (const p of ORG_PAGES) add("Page", p.href, p.label, "Organization", p.href, null);
  for (const w of websites) for (const p of WEBSITE_PAGES) add("Page", `${w.id}${p.path}`, p.label, w.name, `/stores/${w.id}${p.path}`, w.id);
  return out;
}

/** Results for a query, grouped by type. Matches every word; label matches rank first, the current website next. */
function search(entries: Entry[], query: string, contextWebsiteId: string | null): Entry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const sites = entries.filter((e) => e.type === "Website").slice(0, 5);
    const pages = entries.filter((e) => e.type === "Page" && (contextWebsiteId ? e.websiteId === contextWebsiteId : e.websiteId === null)).slice(0, 7);
    return [...sites, ...pages];
  }
  const words = q.split(/\s+/);
  const scored = entries
    .filter((e) => words.every((word) => e.haystack.includes(word)))
    .map((e) => {
      const label = e.label.toLowerCase();
      const score = (label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2) + (contextWebsiteId && e.websiteId === contextWebsiteId ? -0.5 : 0);
      return { e, score };
    });
  const counts = new Map<EntryType, number>();
  const kept: Entry[] = [];
  for (const type of TYPE_ORDER) {
    for (const { e } of scored.filter((s) => s.e.type === type).sort((a, b) => a.score - b.score)) {
      const n = counts.get(type) ?? 0;
      if (n >= PER_TYPE_LIMIT || kept.length >= TOTAL_LIMIT) break;
      counts.set(type, n + 1);
      kept.push(e);
    }
  }
  return kept;
}

type Props = {
  websites: ShellWebsite[];
  contextWebsiteId: string | null;
  onClose: () => void;
};

/** Mount only while open: the dialog, input and entries exist just for that time. */
export function CommandPalette({ websites, contextWebsiteId, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const entries = useMemo(() => buildEntries(websites), [websites]);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState({ query: "", index: 0 });

  const results = useMemo(() => search(entries, query, contextWebsiteId), [entries, query, contextWebsiteId]);
  const active = cursor.query === query ? Math.min(cursor.index, Math.max(0, results.length - 1)) : 0;
  const move = (next: number) => setCursor({ query, index: results.length ? (next + results.length) % results.length : 0 });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(active + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(active - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  };

  // Group headings: print one when the type changes.
  let lastType: EntryType | null = null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-dvw max-w-none bg-transparent p-3 pt-[10dvh] sm:pt-[14dvh]"
    >
      <div className="mx-auto flex max-h-[min(34rem,76dvh)] w-full max-w-xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-3 transition-colors duration-[var(--dur-fast)] focus-within:border-accent">
          <Icon name="search" size={18} className="shrink-0 text-fg-subtle" />
          <input
            type="text"
            data-bare
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search websites and pages"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search websites and pages…"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle md:text-body"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg pointer-coarse:size-11"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div id={listId} role="listbox" aria-label="Results" className="ui-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-body-sm text-fg-muted">No results for “{query.trim()}”.</p>
          ) : (
            results.map((entry, i) => {
              const heading = entry.type !== lastType ? entry.type : null;
              lastType = entry.type;
              return (
                <div key={entry.key} role="presentation">
                  {heading ? (
                    <p role="presentation" className="px-2.5 pb-1 pt-2 text-helper font-semibold text-fg-muted">
                      {query.trim() ? heading : heading === "Website" ? "Websites" : "Pages"}
                    </p>
                  ) : null}
                  <div
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onClick={() => go(entry)}
                    onMouseMove={() => i !== active && setCursor({ query, index: i })}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-2.5 py-1.5 pointer-coarse:min-h-11",
                      i === active ? "bg-accent-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <Icon name={TYPE_ICON[entry.type]} size={16} className={cn("shrink-0", i === active ? "text-accent-text" : "text-fg-subtle")} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-sm font-medium text-fg">{entry.label}</span>
                      {entry.hint ? <span className="truncate text-helper text-fg-muted">{entry.hint}</span> : null}
                    </span>
                    <span className="shrink-0 text-helper text-fg-muted">{entry.type}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p aria-live="polite" className="sr-only">{query.trim() ? `${results.length} results` : ""}</p>
        <p className="hidden border-t border-line px-3 py-2 text-helper text-fg-muted md:block pointer-coarse:hidden">
          <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd> move · <kbd className="font-sans">Enter</kbd> open · <kbd className="font-sans">Esc</kbd> close
        </p>
      </div>
    </dialog>
  );
}
