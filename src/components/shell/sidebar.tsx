"use client";

import Link from "next/link";
import { useId } from "react";

import { Icon } from "@/components/ui/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

import type { NavGroup, NavItem } from "./nav";

export type NavCounts = { pendingTasks: number; unreadAlerts: number };

type SidebarProps = {
  groups: NavGroup[];
  pathname: string;
  counts: NavCounts;
  /** Icon rail (desktop only). */
  collapsed?: boolean;
  /** Present on desktop: shows the collapse / expand control. */
  onToggleCollapsed?: () => void;
  /** Present in the mobile drawer: shows a search button. */
  onSearch?: () => void;
};

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/stores" aria-label="Rankvora AI, websites" className="flex items-center gap-2.5 rounded-control px-1 py-1">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent text-accent-fg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19V5h7a4 4 0 0 1 0 8H5M12 13l6 6" />
        </svg>
      </span>
      {compact ? null : <span className="text-card-title font-semibold tracking-tight text-sidebar-fg">Rankvora <span className="text-sidebar-fg-muted">AI</span></span>}
    </Link>
  );
}

function NavLink({ item, pathname, count, collapsed }: { item: NavItem; pathname: string; count: number; collapsed: boolean }) {
  const active = item.isActive(pathname);
  const countLabel = count > 0 ? `${count} ${item.badge === "pendingTasks" ? "pending" : "unread"}` : undefined;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? (countLabel ? `${item.label}, ${countLabel}` : item.label) : undefined}
      className={cn(
        "group relative flex h-10 items-center rounded-control text-body-sm font-medium transition-colors duration-[var(--dur-fast)] pointer-coarse:h-11",
        collapsed ? "w-10 justify-center" : "gap-2.5 px-2.5",
        active ? "bg-surface text-sidebar-fg shadow-card ring-1 ring-line" : "text-sidebar-fg-muted hover:bg-surface/70 hover:text-sidebar-fg",
      )}
    >
      {active && !collapsed ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" /> : null}
      <Icon name={item.icon} size={18} className={cn("shrink-0", active ? "text-accent-text" : "text-sidebar-fg-muted group-hover:text-sidebar-fg")} />
      {collapsed ? (
        count > 0 ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 size-2 rounded-full bg-accent ring-2 ring-sidebar" /> : null
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {count > 0 ? (
            <span aria-label={countLabel} className="tnum rounded-full bg-accent-soft px-1.5 text-2xs font-semibold leading-5 text-accent-text">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
  return collapsed ? <Tooltip content={item.label} side="bottom">{link}</Tooltip> : link;
}

/** Sidebar content, shared by the desktop rail and the mobile drawer. Landmark and heading wiring lives here. */
export function Sidebar({ groups, pathname, counts, collapsed = false, onToggleCollapsed, onSearch }: SidebarProps) {
  const uid = useId();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-header shrink-0 items-center border-b border-line", collapsed ? "justify-center px-2" : "px-4")}>
        <Logo compact={collapsed} />
      </div>

      <nav aria-label="Primary" className="ui-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
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
          <section key={group.id} aria-labelledby={`${uid}-${group.id}`} className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
            {collapsed ? (
              <>
                <h2 id={`${uid}-${group.id}`} className="sr-only">{group.label}</h2>
                <span aria-hidden="true" className="mb-1 h-px w-6 bg-line-strong" />
              </>
            ) : (
              <h2 id={`${uid}-${group.id}`} className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-fg-muted">{group.label}</h2>
            )}
            <ul className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
              {group.items.map((item) => (
                <li key={item.id} className={collapsed ? undefined : "w-full"}>
                  <NavLink item={item} pathname={pathname} count={item.badge ? counts[item.badge] : 0} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      {onToggleCollapsed ? (
        <div className={cn("shrink-0 border-t border-line p-3", collapsed && "flex justify-center")}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className={cn(
              "flex h-10 cursor-pointer items-center rounded-control text-body-sm text-sidebar-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface/70 hover:text-sidebar-fg",
              collapsed ? "w-10 justify-center" : "w-full gap-2.5 px-2.5",
            )}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
            {collapsed ? null : "Collapse"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
