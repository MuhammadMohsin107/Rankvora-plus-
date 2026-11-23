"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useDemoCollection, useDemoEvents, useDemoUi, useUnreadAlertCount } from "@/demo-state";
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

/** First step of the header trail: home is the Websites & Brands list. */
function HomeLink() {
  return (
    <Link href="/stores" aria-label="Home: Websites & Brands" title="Home" className="-mr-1 flex h-9 w-8 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-fg lg:-ml-1.5 pointer-coarse:size-11">
      <Icon name="home" size={18} />
    </Link>
  );
}

export function AppShell({ user, stores, alerts, searchIndex, children }: ShellProps) {
  const pathname = normalizeRoute(usePathname());
  const { ui, setLastWebsite } = useDemoUi();
  const { rows: allWebsites } = useDemoCollection<Store>("websites", stores);
  const { rows: tasks } = useDemoCollection<SearchTask>("tasks", searchIndex.tasks);
  const events = useDemoEvents();

  const websites = useMemo(() => allWebsites.filter((w) => w.status !== "archived"), [allWebsites]);
  const routeId = storeIdFromPath(pathname);
  const routeWebsite = routeId ? (allWebsites.find((w) => w.id === routeId) ?? null) : null;
  // Organization pages have no website in context: the header and the sidebar show the organization only.
  // Website pages show the website from the URL.
  const contextWebsite = routeWebsite;
  const navWebsiteId = routeId;

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

  return (
    <div className="min-h-dvh min-w-0 lg:pl-[var(--sidebar-w)]">
      <a href="#main" className="sr-only z-[80] rounded-control bg-accent px-3 py-2 text-body font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>

      <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] border-r border-line bg-sidebar lg:block">
        <Sidebar groups={groups} pathname={pathname} counts={counts} />
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

      {/* Every control in the bar is 36px high (--btn-h), and the bar content lines up with the page content below it. */}
      <header className="sticky top-0 z-20 border-b border-line bg-surface" style={{ "--btn-h": "36px", "--btn-h-sm": "32px" } as CSSProperties}>
        <div className="mx-auto flex h-header w-full max-w-[1360px] items-center gap-1 px-page">
          <IconButton icon="menu" label="Open navigation" className="-ml-1 shrink-0 lg:hidden" onClick={() => setOpenFor(pathname)} />
          <HomeLink />
          {routeId ? (
            <>
              <Icon name="chevron-right" size={14} aria-hidden="true" className="shrink-0 text-fg-faint" />
              <div className="flex min-w-0 shrink items-center">
                <WebsiteSelector websites={websites} active={contextWebsite} pathname={pathname} />
              </div>
            </>
          ) : null}
          <div className="@container hidden min-w-0 flex-1 md:block">
            <Breadcrumbs pathname={pathname} />
          </div>
          <div className="min-w-0 flex-1 md:hidden" />
          <div className="flex shrink-0 items-center gap-2">
            {/* The page's ONE primary action lands here (see HeaderAction in page-chrome). */}
            <div ref={registerActionSlot} className="flex shrink-0 items-center gap-2 empty:hidden" />
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              title="Search (Ctrl K)"
              aria-keyshortcuts="Control+K Meta+K"
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-control px-2.5 text-body-sm text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-3 hover:text-fg md:w-52 md:border md:border-line-strong md:bg-surface-2 md:px-3"
            >
              <Icon name="search" size={16} className="shrink-0" />
              <span className="hidden md:inline">Search</span>
              <kbd className="ml-auto hidden rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-2xs leading-none text-fg-subtle lg:inline">Ctrl K</kbd>
            </button>
            <Link href="/help" className="hidden h-9 items-center gap-1.5 rounded-control px-2.5 text-body-sm font-medium text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-3 hover:text-fg sm:inline-flex">
              <Icon name="help" size={16} />
              Support
            </Link>
            <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-line sm:block" />
            <div className="flex items-center gap-1">
              <Notifications alerts={alerts} websites={websites} contextWebsiteId={navWebsiteId} />
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1360px] px-page py-4 outline-none sm:py-5">
        {children}
      </main>

      {searchOpen ? <CommandPalette index={searchIndex} websites={websites} contextWebsiteId={navWebsiteId} onClose={closeSearch} /> : null}
    </div>
  );
}
