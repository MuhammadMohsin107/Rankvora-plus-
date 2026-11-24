"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type LinkTab = { href: string; label: string; count?: number; exact?: boolean };

/** Route-based tabs (deep-linkable). Active tab follows the URL. */
export function LinkTabs({ items, label, className }: { items: LinkTab[]; label: string; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className={cn("ui-scroll -mb-px flex gap-1 overflow-x-auto border-b border-line", className)}>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-body font-medium transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring pointer-coarse:h-11",
              active ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined ? <span className="tnum rounded-full bg-surface-3 px-1.5 text-helper text-fg">{item.count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

type Tab = { id: string; label: string; count?: number; content: ReactNode };

/** In-page tabs with roving tabindex and arrow-key navigation. */
export function Tabs({
  tabs,
  label,
  defaultId,
  value,
  onValueChange,
  className,
  panelClassName,
}: {
  tabs: Tab[];
  label: string;
  defaultId?: string;
  /** Controlled mode: the open tab. Pair with onValueChange so other code can open a tab (for example an evidence link). */
  value?: string;
  onValueChange?: (id: string) => void;
  className?: string;
  panelClassName?: string;
}) {
  const [inner, setInner] = useState(defaultId ?? tabs[0]?.id);
  const active = value ?? inner;
  const setActive = (id: string) => {
    setInner(id);
    onValueChange?.(id);
  };
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setActive(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="ui-scroll -mb-px flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((tab, index) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              id={`${base}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 text-body font-medium transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring pointer-coarse:h-11",
                selected ? "text-fg after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent" : "text-fg-muted hover:text-fg",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? <span className="tnum rounded-full bg-surface-3 px-1.5 text-helper text-fg">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${base}-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tab.id}`}
          hidden={tab.id !== active}
          tabIndex={0}
          className={cn("pt-3 outline-offset-4", panelClassName)}
        >
          {tab.id === active ? tab.content : null}
        </div>
      ))}
    </div>
  );
}
