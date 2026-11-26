"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { Icon } from "@/components/ui/icon";
import { useSession, type Organization, type SessionUser } from "@/features/session/session";
import { useWebsites, WebsitesProvider } from "@/features/websites/websites-data";

import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { navGroups, storeIdFromPath } from "./nav";
import { registerActionSlot } from "./page-chrome";
import { isAccountRoute, normalizeRoute } from "./route-titles";
import { Logo, Sidebar } from "./sidebar";
import { UserMenu } from "./user-menu";
import { WebsiteSelector, type ShellWebsite } from "./website-selector";

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 px-page py-10">
      <Logo />
      <main id="main" className="flex w-full flex-1 flex-col items-center">{children}</main>
    </div>
  );
}

/** Account pages stand alone. Every other page needs a signed-in person with an organization. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isAccountRoute(pathname)) return <FullPage>{children}</FullPage>;
  return <SignedIn>{children}</SignedIn>;
}

function SignedIn({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { state, refresh } = useSession();
  const needsSignIn = state.status === "signed-out";
  const needsOrganization = state.status === "ready" && !state.organization;

  useEffect(() => {
    if (needsSignIn) router.replace(`/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    else if (needsOrganization) router.replace("/welcome");
  }, [needsSignIn, needsOrganization, router]);

  if (state.status === "unavailable") {
    return (
      <FullPage>
        <EmptyState icon="lock" title="Accounts are not set up on this server yet" className="w-full max-w-md" />
      </FullPage>
    );
  }
  if (state.status === "error") {
    return (
      <FullPage>
        <ErrorState detail={state.message} className="w-full max-w-md" action={<Button onClick={() => void refresh()}>Try again</Button>} />
      </FullPage>
    );
  }
  if (state.status !== "ready" || !state.organization) {
    return (
      <FullPage>
        <p role="status" className="text-fg-subtle">
          <Spinner />
          <span className="sr-only">Loading</span>
        </p>
      </FullPage>
    );
  }
  return (
    <WebsitesProvider organizationId={state.organization.id}>
      <Frame user={state.user} organizations={state.organizations} organization={state.organization}>
        {children}
      </Frame>
    </WebsitesProvider>
  );
}

/** First step of the header trail: home is the Websites & Brands list. */
function HomeLink() {
  return (
    <Link href="/stores" aria-label="Home: Websites & Brands" title="Home" className="-mr-1 flex h-btn w-8 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 hover:text-fg lg:-ml-1.5 pointer-coarse:size-11">
      <Icon name="home" size={18} />
    </Link>
  );
}

function Frame({ user, organizations, organization, children }: { user: SessionUser; organizations: Organization[]; organization: Organization; children: ReactNode }) {
  const router = useRouter();
  const pathname = normalizeRoute(usePathname());
  const { selectOrganization, signOut } = useSession();
  const { websites: records } = useWebsites();
  const websites = useMemo<ShellWebsite[]>(
    () => records.map((site) => ({ id: site.id, name: site.name, domain: site.domain?.host ?? "", market: site.market, status: site.status })),
    [records],
  );
  const routeId = storeIdFromPath(pathname);
  // Only a website that exists in this organization gets a website menu, so nothing links to pages that are not there.
  const routeWebsite = routeId ? (websites.find((site) => site.id === routeId) ?? null) : null;
  const websiteId = routeWebsite?.id ?? null;
  const groups = useMemo(() => navGroups(websiteId), [websiteId]);
  const selectable = useMemo(() => websites.filter((site) => site.status !== "archived"), [websites]);

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
        <Sidebar groups={groups} pathname={pathname} />
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
                <WebsiteSelector websites={selectable} active={routeWebsite} pathname={pathname} />
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
              aria-label="Search, Ctrl K"
              title="Search (Ctrl K)"
              aria-keyshortcuts="Control+K Meta+K"
              className="inline-flex h-btn cursor-pointer items-center gap-2 rounded-full px-2.5 text-body-sm text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-3 hover:text-fg md:w-60 md:border md:border-line-strong md:bg-surface md:px-4 md:hover:border-fg-subtle md:hover:bg-surface"
            >
              <Icon name="search" size={16} className="shrink-0" />
              <span className="hidden text-fg-subtle md:inline">Search</span>{" "}
              <span aria-hidden="true" className="tnum ml-auto hidden text-helper text-fg-subtle lg:inline">Ctrl K</span>
            </button>
            <Link href="/help" className="hidden h-btn items-center gap-1.5 rounded-control px-2.5 text-body-sm font-medium text-fg-muted transition-colors duration-[var(--dur-fast)] hover:bg-surface-3 hover:text-fg sm:inline-flex">
              <Icon name="help" size={16} />
              Support
            </Link>
            <span aria-hidden="true" className="mx-0.5 hidden h-5 w-px bg-line sm:block" />
            <UserMenu
              user={user}
              organization={organization}
              organizations={organizations}
              onSelectOrganization={(id) => {
                selectOrganization(id);
                router.push("/stores");
              }}
              onSignOut={() => void signOut()}
            />
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1360px] px-page py-4 outline-none sm:py-5">
        {children}
      </main>

      {searchOpen ? <CommandPalette websites={selectable} contextWebsiteId={websiteId} onClose={closeSearch} /> : null}
    </div>
  );
}
