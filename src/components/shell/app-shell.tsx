"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { STATUS } from "@/lib/status";
import type { AlertHeadline, Member, Organization, Store } from "@/types/core";

import { ORG_NAV, storeIdFromPath, storeNav, switchStoreHref, type NavItem } from "./nav";

type ShellProps = {
  org: Organization;
  user: Member;
  stores: Store[];
  alerts: AlertHeadline[];
  children: ReactNode;
};

const roleLabel = { owner: "Owner", admin: "Admin", editor: "Editor", auditor: "Auditor", viewer: "Viewer" } as const;

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md px-1 py-0.5" aria-label="Rankvora Plus home">
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-[8px] bg-accent text-accent-fg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19V5h7a4 4 0 0 1 0 8H5M12 13l6 6" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">Rankvora <span className="text-fg-subtle">Plus</span></span>
    </Link>
  );
}

function NavLink({ item, pathname, count }: { item: NavItem; pathname: string; count?: number }) {
  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-2.5 rounded-control px-2.5 text-[13px] font-medium transition-colors duration-[var(--dur-fast)] pointer-coarse:h-11",
        active ? "bg-surface text-fg shadow-card ring-1 ring-line" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon name={item.icon} size={17} className={active ? "text-accent-text" : "text-fg-subtle group-hover:text-fg-muted"} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {count ? (
        <span className="tnum rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-text" aria-label={`${count} pending`}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function Sidebar({ activeStore, pathname }: { activeStore: Store | null; pathname: string }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3 ui-scroll">
      <div className="px-1 pt-1">
        <Logo />
      </div>

      <nav aria-label="Organization" className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          <Icon name="building" size={12} /> Organization
        </p>
        {ORG_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {activeStore ? (
        <nav aria-label={`${activeStore.name} navigation`} className="flex flex-col gap-0.5 rounded-card border border-accent/25 bg-accent-soft/50 p-2">
          <p className="flex items-center justify-between gap-2 px-1.5 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-text">
            <span className="flex items-center gap-1.5"><Icon name="store" size={12} /> Store</span>
            {activeStore.status !== "active" ? <Badge tone={STATUS.store[activeStore.status].tone} icon={STATUS.store[activeStore.status].icon}>{STATUS.store[activeStore.status].label}</Badge> : null}
          </p>
          {storeNav(activeStore.id).map((item) => {
            const key = item.badgeKey;
            const count = key && activeStore.summary ? activeStore.summary[key] : undefined;
            return <NavLink key={item.href} item={item} pathname={pathname} count={count} />;
          })}
        </nav>
      ) : null}

      <p className="mt-auto flex items-center gap-1.5 px-2.5 pb-1 text-[11px] text-fg-subtle">
        <Icon name="database" size={12} /> Demonstration data
      </p>
    </div>
  );
}

function StoreSelector({ stores, activeStore, pathname }: { stores: Store[]; activeStore: Store | null; pathname: string }) {
  const items: MenuItem[] = [
    { type: "label", label: "Stores" },
    ...stores.map<MenuItem>((store) => ({
      label: store.name,
      href: switchStoreHref(pathname, store.id),
      meta: (
        <span className="flex items-center gap-1.5">
          {store.id === activeStore?.id ? <Icon name="check" size={14} className="text-accent-text" /> : null}
          <Badge tone={STATUS.store[store.status].tone}>{STATUS.store[store.status].label}</Badge>
        </span>
      ),
    })),
    { type: "separator" },
    { label: "All stores", href: "/stores", icon: "store" },
    { label: "Add store", href: "/stores/new", icon: "plus" },
  ];
  return (
    <Menu
      align="start"
      width={300}
      items={items}
      trigger={
        <button
          type="button"
          className={cn(
            "flex h-9 min-w-0 max-w-[16rem] cursor-pointer items-center gap-2 rounded-control border px-2.5 text-[13px] font-medium transition-colors aria-expanded:ring-2 aria-expanded:ring-accent/30 pointer-coarse:h-11",
            activeStore ? "border-accent/40 bg-accent-soft text-accent-text" : "border-line-strong bg-surface text-fg-muted hover:bg-surface-2",
          )}
        >
          <Icon name="store" size={15} />
          <span className="min-w-0 truncate">{activeStore ? activeStore.name : "Select store"}</span>
          <Icon name="chevron-down" size={14} className="shrink-0" />
        </button>
      }
    />
  );
}

function OrgSelector({ org }: { org: Organization }) {
  return (
    <Menu
      align="start"
      width={260}
      header={<p className="text-xs text-fg-subtle">Organization</p>}
      items={[
        { label: org.name, icon: "building", meta: <Icon name="check" size={14} className="text-accent-text" /> },
        { type: "separator" },
        { label: "Organization settings", href: "/settings", icon: "settings" },
        { label: "Portfolio overview", href: "/", icon: "dashboard" },
      ]}
      trigger={
        <button
          type="button"
          className="flex h-9 max-w-[14rem] shrink-0 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2 aria-expanded:ring-2 aria-expanded:ring-accent/30 pointer-coarse:h-11"
        >
          <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded bg-fg text-[10px] font-bold text-canvas">{org.name.charAt(0)}</span>
          <span className="hidden min-w-0 truncate sm:inline">{org.name}</span>
          <Icon name="chevron-down" size={14} className="shrink-0 text-fg-subtle" />
        </button>
      }
    />
  );
}

function NotificationsMenu({ alerts, stores }: { alerts: AlertHeadline[]; stores: Store[] }) {
  const unread = alerts.filter((a) => !a.read).length;
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;
  const items: MenuItem[] = alerts.map((alert) => ({
    label: alert.title,
    href: `/stores/${alert.storeId}/monitoring/alerts`,
    meta: (
      <span className="shrink-0 text-[11px] text-fg-subtle">{formatRelative(alert.at)}</span>
    ),
    icon: alert.read ? "bell" : "circle-dot",
    disabledReason: storeName(alert.storeId),
  }));
  return (
    <Menu
      align="end"
      width={380}
      header={<p className="flex items-center justify-between text-[13px] font-semibold text-fg">Alerts <span className="tnum text-xs font-normal text-fg-subtle">{unread} unread</span></p>}
      items={[...items, { type: "separator" }, { label: "Open alerts for RunPro Pakistan", href: "/stores/runpro-pk/monitoring/alerts", icon: "arrow-right" }]}
      trigger={
        <IconButton
          icon="bell"
          label={unread ? `Alerts, ${unread} unread` : "Alerts"}
          badge={unread ? <span aria-hidden="true" className="tnum absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">{unread}</span> : null}
        />
      }
    />
  );
}

function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const isDark = root.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rv-theme", next);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  };
  return (
    <Tooltip content="Toggle light / dark" side="bottom">
      <button type="button" onClick={toggle} aria-label="Toggle light or dark theme" className="relative flex size-9 cursor-pointer items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg pointer-coarse:size-11">
        <Icon name="moon" size={18} className="rv-moon" />
        <Icon name="sun" size={18} className="rv-sun" />
      </button>
    </Tooltip>
  );
}

function UserMenu({ user }: { user: Member }) {
  return (
    <Menu
      align="end"
      width={248}
      header={
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{user.name}</p>
          <p className="truncate text-xs text-fg-subtle">{user.email}</p>
          <Badge tone="accent" className="mt-1.5">{roleLabel[user.role]}</Badge>
        </div>
      }
      items={[
        { label: "Members & roles", href: "/settings/members", icon: "users" },
        { label: "Usage & billing", href: "/settings/billing", icon: "credit-card" },
      ]}
      trigger={
        <button type="button" aria-label={`Account menu, ${user.name}`} className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-fg text-[12px] font-semibold text-canvas ring-offset-2 transition-opacity hover:opacity-90 pointer-coarse:size-11">
          {user.initials}
        </button>
      }
    />
  );
}

export function AppShell({ org, user, stores, alerts, children }: ShellProps) {
  const pathname = usePathname();
  const storeId = storeIdFromPath(pathname);
  const activeStore = stores.find((s) => s.id === storeId) ?? null;
  // Mobile drawer is open only for the path it was opened on, so navigating closes it.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const navOpen = openFor === pathname;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (navOpen && !node.open) node.showModal();
    if (!navOpen && node.open) node.close();
  }, [navOpen]);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onClose = () => setOpenFor(null);
    node.addEventListener("close", onClose);
    return () => node.removeEventListener("close", onClose);
  }, []);

  return (
    <div className="min-h-dvh lg:pl-[260px]">
      <a href="#main" className="sr-only z-[80] rounded-control bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-line bg-sidebar lg:block">
        <Sidebar activeStore={activeStore} pathname={pathname} />
      </aside>

      <dialog
        ref={dialogRef}
        aria-label="Navigation"
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenFor(null);
        }}
        className="ui-drawer m-0 mr-auto h-dvh max-h-dvh w-[min(300px,88vw)] rounded-none border-r border-line bg-sidebar p-0 shadow-pop lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex justify-end px-2 pt-2">
            <IconButton icon="x" label="Close navigation" size="sm" onClick={() => setOpenFor(null)} />
          </div>
          <div className="min-h-0 flex-1">
            <Sidebar activeStore={activeStore} pathname={pathname} />
          </div>
        </div>
      </dialog>

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
          <IconButton icon="menu" label="Open navigation" className="lg:hidden" onClick={() => setOpenFor(pathname)} />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <OrgSelector org={org} />
            <span aria-hidden="true" className="hidden text-line-strong sm:inline">/</span>
            <StoreSelector stores={stores} activeStore={activeStore} pathname={pathname} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="hidden md:block"><Tooltip content="All data shown is sample data" side="bottom">
              <span tabIndex={0} className="mr-1 inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-line-strong px-2 text-[11px] font-medium text-fg-subtle">
                <Icon name="database" size={12} /> Demo data
              </span>
            </Tooltip></div>
            <ThemeToggle />
            <NotificationsMenu alerts={alerts} stores={stores} />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1360px] px-3 py-5 outline-none sm:px-5 sm:py-6">
        {children}
      </main>
    </div>
  );
}
