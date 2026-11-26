"use client";

import Link from "next/link";
import { useId } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

import type { NavGroup, NavItem } from "./nav";

type SidebarProps = {
  groups: NavGroup[];
  pathname: string;
  /** Present in the mobile drawer: shows a search button. */
  onSearch?: () => void;
};

export function Logo() {
  return (
    <Link href="/stores" aria-label="Rankvora AI, websites" className="flex items-center gap-2.5 rounded-control px-1 py-1">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19V5h7a4 4 0 0 1 0 8H5M12 13l6 6" />
        </svg>
      </span>
      <span className="text-card-title font-semibold tracking-tight text-sidebar-fg">Rankvora <span className="text-sidebar-fg-muted">AI</span></span>
    </Link>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.isActive(pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center rounded-control text-body-sm font-medium transition-colors duration-[var(--dur-fast)] pointer-coarse:h-11",
        "gap-2.5 px-2.5",
        active ? "bg-surface text-sidebar-fg shadow-card ring-1 ring-line" : "text-sidebar-fg-muted hover:bg-surface/70 hover:text-sidebar-fg",
      )}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" /> : null}
      <Icon name={item.icon} size={18} className={cn("shrink-0", active ? "text-accent-text" : "text-sidebar-fg-muted group-hover:text-sidebar-fg")} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </Link>
  );
}

/** Sidebar content, shared by the desktop rail and the mobile drawer. Landmark and heading wiring lives here. */
export function Sidebar({ groups, pathname, onSearch }: SidebarProps) {
  const uid = useId();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-header shrink-0 items-center border-b border-line px-4">
        <Logo />
      </div>

      <nav aria-label="Primary" className="ui-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {onSearch ? (
          <button
            type="button"
            onClick={onSearch}
            className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-control border border-line-strong bg-surface px-2.5 text-body-sm text-sidebar-fg-muted hover:text-sidebar-fg"
          >
            <Icon name="search" size={18} /> Search
          </button>
        ) : null}
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`${uid}-${group.id}`} className="flex flex-col gap-0.5">
            <p id={`${uid}-${group.id}`} className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-fg-muted">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.id} className="w-full">
                  <NavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
