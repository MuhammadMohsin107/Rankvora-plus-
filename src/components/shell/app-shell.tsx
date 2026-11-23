"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { SyncIndicator, useDemoCollection, useDemoEvents, useDemoUi, useUnreadAlertCount } from "@/demo-state";
import { cn } from "@/lib/cn";
import { OPEN_TASK_STATUSES } from "@/lib/record-status";
import type { AlertHeadline, Member, Organization, Store } from "@/types/core";

import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { navGroups, storeIdFromPath } from "./nav";
import { Notifications } from "./notifications";
import { registerActionSlot } from "./page-chrome";
import { normalizeRoute } from "./route-titles";
import { buildWebsiteLookup, rowWebsite } from "./row-website";
import type { SearchIndex, SearchTask } from "./search-types";
import { Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { WebsiteSelector } from "./website-selector";

type ShellProps = {
  org: Organization;
  user: Member;
  /** Seeded websites. Websites created in the browser are merged in on the client. */
  stores: Store[];
  alerts: AlertHeadline[];
  searchIndex: SearchIndex;
  children: ReactNode;
};

const RAIL_WIDTH = "72px";

function OrgSelector({ org }: { org: Organization }) {
  return (
    <Menu
      align="start"
      width={264}
      label="Organization"
      header={<p className="text-helper font-semibold text-fg-muted">Organization</p>}
      items={[
        { label: org.name, icon: "building", meta: <Icon name="check" size={16} className="text-accent-text" label="Current organization" /> },
        { type: "separator" },
        { label: "Websites & Brands", href: "/stores", icon: "globe" },
        { label: "Organization settings", href: "/settings", icon: "settings" },
      ]}
      trigger={
        <button
          type="button"
          aria-label={`Organization: ${org.name}`}
          className="flex h-11 max-w-[12rem] shrink-0 cursor-pointer items-center gap-2 rounded-control px-2 text-body-sm font-medium text-fg transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 aria-expanded:bg-surface-2"
        >
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fg text-xs font-semibold text-canvas">{org.name.charAt(0)}</span>
          <span className="hidden min-w-0 truncate xl:inline">{org.name}</span>
          <Icon name="chevrons-up-down" size={14} className="hidden shrink-0 text-fg-subtle xl:block" />
        </button>
      }
    />
  );
}

export function AppShell({ org, user, stores, alerts, searchIndex, children }: ShellProps) {
  const pathname = normalizeRoute(usePathname());
  const { ui, toggleSidebar, setLastWebsite } = useDemoUi();
  const { rows: allWebsites } = useDemoCollection<Store>("websites", stores);
  const { rows: tasks } = useDemoCollection<SearchTask>("tasks", searchIndex.tasks);
  const events = useDemoEvents();

  const websites = useMemo(() => allWebsites.filter((w) => w.status !== "archived"), [allWebsites]);
  const routeId = storeIdFromPath(pathname);
  const routeWebsite = routeId ? (allWebsites.find((w) => w.id === routeId) ?? null) : null;
  // Website in context: the one in the URL; in the organization area, the last one used (else the first).
  const contextWebsite = routeWebsite ?? (routeId ? null : (websites.find((w) => w.id === ui.lastWebsiteId) ?? websites[0] ?? null));
  const navWebsiteId = routeId ?? contextWebsite?.id ?? null;

  const routeWebsiteId = routeWebsite?.id ?? null;
  useEffect(() => {
    if (routeWebsiteId && ui.lastWebsiteId !== routeWebsiteId) setLastWebsite(routeWebsiteId);
  }, [routeWebsiteId, ui.lastWebsiteId, setLastWebsite]);

  const groups = useMemo(() => navGroups(navWebsiteId), [navWebsiteId]);
  const unreadAlerts = useUnreadAlertCount(alerts, navWebsiteId ?? undefined);
  const pendingTasks = useMemo(() => {
    if (!navWebsiteId) return 0;
    const lookup = buildWebsiteLookup(events);
    return tasks.filter((t) => OPEN_TASK_STATUSES.has(t.status) && rowWebsite(t, lookup) === navWebsiteId).length;
  }, [tasks, events, navWebsiteId]);
  const counts = { pendingTasks, unreadAlerts };

  // Mobile drawer: open only for the path it was opened on, so navigating closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const drawerOpen = openFor === pathname;
  const drawerRef = useRef<HTMLDialogElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    const node = drawerRef.current;
    if (!node) return;
    if (drawerOpen && !node.open) node.showModal();
    if (!drawerOpen && node.open) node.close();
  }, [drawerOpen]);

  // Ctrl/Cmd+K toggles the command palette from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // After a route change, focus moves to the main region so keyboard and screen reader users start at the new page.
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const collapsed = ui.sidebarCollapsed;

  return (
    <div className="min-h-dvh min-w-0 lg:pl-[var(--shell-w)]" style={{ "--shell-w": collapsed ? RAIL_WIDTH : "var(--sidebar-w)" } as CSSProperties}>
      <a href="#main" className="sr-only z-[80] rounded-control bg-accent px-3 py-2 text-body font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>

      <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-w)] border-r border-line bg-sidebar transition-[width] duration-[var(--dur)] ease-[var(--ease)] lg:block">
        <Sidebar groups={groups} pathname={pathname} counts={counts} collapsed={collapsed} onToggleCollapsed={toggleSidebar} />
      </aside>

      <dialog
        ref={drawerRef}
        aria-label="Navigation"
        onClose={() => setOpenFor(null)}
        onClick={(event) => {
          if (event.target === drawerRef.current) setOpenFor(null);
        }}
        className="ui-drawer m-0 mr-auto h-dvh max-h-dvh w-[min(var(--sidebar-w),88vw)] max-w-none overflow-hidden rounded-none border-r border-line bg-sidebar p-0 shadow-pop lg:hidden"
      >
        {drawerOpen ? (
          <div className="relative h-full">
            <Sidebar
              groups={groups}
              pathname={pathname}
              counts={counts}
              onSearch={() => {
                setOpenFor(null);
                setSearchOpen(true);
              }}
            />
            <IconButton icon="x" label="Close navigation" className="absolute right-2 top-2.5" onClick={() => setOpenFor(null)} />
          </div>
        ) : null}
      </dialog>

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <div className="flex h-header items-center gap-2 px-page">
          <IconButton icon="menu" label="Open navigation" className="-ml-1 shrink-0 lg:hidden" onClick={() => setOpenFor(pathname)} />
          <div className="hidden lg:block"><OrgSelector org={org} /></div>
          <div className="flex min-w-0 shrink items-center">
            <WebsiteSelector websites={websites} active={contextWebsite} pathname={pathname} />
          </div>
          <div className="@container hidden min-w-0 flex-1 pl-1 md:block">
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="min-w-0 flex-1 md:hidden" />
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {/* The page's ONE primary action lands here (see HeaderAction in page-chrome). */}
            <div ref={registerActionSlot} className="flex shrink-0 items-center gap-2 empty:hidden" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              title="Search (Ctrl K)"
              aria-keyshortcuts="Control+K Meta+K"
              className={cn(
                "hidden h-10 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-body-sm text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-fg sm:inline-flex",
                "2xl:w-52 2xl:justify-start",
              )}
            >
              <Icon name="search" size={16} />
              <span className="hidden 2xl:inline">Search</span>
              <kbd className="ml-auto hidden font-sans text-xs text-fg-subtle 2xl:inline">Ctrl K</kbd>
            </button>
            <Tooltip content="Demo data. Nothing here is real." side="bottom">
              <span tabIndex={0} className="hidden h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-1.5 text-xs font-medium text-fg-muted sm:inline-flex lg:px-2">
                <Icon name="database" size={14} />
                <span className="hidden lg:inline">Demo data</span>
                <span className="sr-only lg:hidden">Demo data</span>
              </span>
            </Tooltip>
            <SyncIndicator className="hidden lg:inline-flex" />
            <Notifications alerts={alerts} websites={websites} contextWebsiteId={navWebsiteId} />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1360px] px-page py-6 outline-none sm:py-8">
        {children}
      </main>

      {searchOpen ? <CommandPalette index={searchIndex} websites={websites} contextWebsiteId={navWebsiteId} onClose={closeSearch} /> : null}
    </div>
  );
}
