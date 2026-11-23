"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { useDemoCollection, useDemoEvents } from "@/demo-state";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/format";
import type { Store } from "@/types/core";

import { buildWebsiteLookup, rowText, rowWebsite } from "./row-website";
import type { SearchFinding, SearchIndex, SearchPrompt, SearchReport, SearchRun, SearchTask } from "./search-types";

type EntryType = "Website" | "Page" | "Prompt" | "Finding" | "Task" | "Run" | "Report";

type Entry = {
  key: string;
  type: EntryType;
  label: string;
  hint: string;
  href: string;
  websiteId: string | null;
  haystack: string;
};

const TYPE_ORDER: EntryType[] = ["Website", "Page", "Prompt", "Finding", "Task", "Run", "Report"];
const TYPE_ICON: Record<EntryType, IconName> = {
  Website: "globe",
  Page: "file-text",
  Prompt: "prompts",
  Finding: "flag",
  Task: "fixes",
  Run: "monitoring",
  Report: "reports",
};
const PER_TYPE_LIMIT = 6;
const TOTAL_LIMIT = 24;

const ORG_PAGES: { label: string; href: string }[] = [
  { label: "Websites & Brands", href: "/stores" },
  { label: "Add website", href: "/stores/new" },
  { label: "Team", href: "/settings/members" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Integrations", href: "/integrations" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Help & Support", href: "/help" },
];

const WEBSITE_PAGES: { label: string; path: string }[] = [
  { label: "Dashboard", path: "" },
  { label: "Prompt Library", path: "/prompts" },
  { label: "Audit", path: "/audits" },
  { label: "Fixes", path: "/fixes" },
  { label: "Fix tasks", path: "/fixes/tasks" },
  { label: "Monitoring", path: "/monitoring" },
  { label: "Alerts", path: "/monitoring/alerts" },
  { label: "Runs", path: "/monitoring/runs" },
  { label: "Schedules", path: "/monitoring/schedules" },
  { label: "Usage", path: "/monitoring/usage" },
  { label: "Comparison", path: "/comparisons" },
  { label: "Reports", path: "/reports" },
  { label: "Website settings", path: "/settings" },
];

function useEntries(index: SearchIndex, websites: Store[], contextWebsiteId: string | null): Entry[] {
  const prompts = useDemoCollection<SearchPrompt>("prompts", index.prompts).rows;
  const findings = useDemoCollection<SearchFinding>("findings", index.findings).rows;
  const tasks = useDemoCollection<SearchTask>("tasks", index.tasks).rows;
  const runs = useDemoCollection<SearchRun>("runs", index.runs).rows;
  const reports = useDemoCollection<SearchReport>("reports", index.reports).rows;
  const events = useDemoEvents();

  return useMemo(() => {
    const lookup = buildWebsiteLookup(events);
    const nameOf = (id: string | null) => websites.find((w) => w.id === id)?.name ?? "";
    const out: Entry[] = [];
    const add = (type: EntryType, key: string, label: string, hint: string, href: string, websiteId: string | null) =>
      out.push({ key: `${type}:${key}`, type, label, hint, href, websiteId, haystack: `${label} ${hint} ${type}`.toLowerCase() });

    for (const w of websites) {
      add("Website", w.id, w.name, `${w.domain} · ${w.market}`, `/stores/${w.id}`, w.id);
    }
    for (const p of ORG_PAGES) add("Page", p.href, p.label, "Organization", p.href, null);
    for (const w of websites) {
      for (const p of WEBSITE_PAGES) add("Page", `${w.id}${p.path}`, p.label, w.name, `/stores/${w.id}${p.path}`, w.id);
    }
    for (const row of prompts) {
      const site = rowWebsite(row, lookup) ?? contextWebsiteId;
      const text = rowText(row, "text", "title", "name");
      if (site && text) add("Prompt", row.id, text, nameOf(site), `/stores/${site}/prompts/${row.id}`, site);
    }
    for (const row of findings) {
      const site = rowWebsite(row, lookup) ?? contextWebsiteId;
      const title = rowText(row, "title", "name");
      if (site && title) add("Finding", row.id, title, nameOf(site), `/stores/${site}/fixes/findings/${row.id}`, site);
    }
    for (const row of tasks) {
      const site = rowWebsite(row, lookup) ?? contextWebsiteId;
      const title = rowText(row, "title", "name");
      if (site && title) add("Task", row.id, title, nameOf(site), `/stores/${site}/fixes/tasks/${row.id}`, site);
    }
    for (const row of runs) {
      const site = rowWebsite(row, lookup) ?? contextWebsiteId;
      if (!site) continue;
      const schedule = rowText(row, "scheduleName");
      const when = rowText(row, "scheduledFor");
      add("Run", row.id, schedule ? `${schedule} (${row.id})` : `Run ${row.id}`, [nameOf(site), when ? formatShortDate(when) : ""].filter(Boolean).join(" · "), `/stores/${site}/monitoring/runs/${row.id}`, site);
    }
    for (const row of reports) {
      const site = rowWebsite(row, lookup) ?? contextWebsiteId;
      const title = rowText(row, "title", "name");
      if (site && title) add("Report", row.id, title, nameOf(site), `/stores/${site}/reports/${row.id}`, site);
    }
    return out;
  }, [prompts, findings, tasks, runs, reports, events, websites, contextWebsiteId]);
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
  index: SearchIndex;
  websites: Store[];
  contextWebsiteId: string | null;
  onClose: () => void;
};

/** Mount only while open: the dialog, input and merged index exist just for that time. */
export function CommandPalette({ index, websites, contextWebsiteId, onClose }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const entries = useEntries(index, websites, contextWebsiteId);
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
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Icon name="search" size={18} className="shrink-0 text-fg-subtle" />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search websites, pages, prompts, findings, tasks, runs and reports"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search websites, prompts, findings…"
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
            <p className="px-3 py-8 text-center text-body-sm text-fg-muted">No results for “{query.trim()}”. Try a website, prompt or page name.</p>
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
