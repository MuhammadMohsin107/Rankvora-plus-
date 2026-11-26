"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Page chrome: the two things a page can feed into the global header.
 *
 *   <HeaderAction>...</HeaderAction>   the page's ONE primary action, shown in the header action area.
 *                                       Render it anywhere in the page (server or client component);
 *                                       it is portalled into the header and removed when the page unmounts.
 *                                       Pages without one render nothing there. Use one per page.
 *                                       Below 640px the header has no room for a labelled button next to the
 *                                       website selector, search, alerts and account, so the action moves under
 *                                       the page title (PageHeader renders the target) instead.
 *   <BreadcrumbLabel>Title</BreadcrumbLabel>
 *                                       replaces a trailing record id in the breadcrumb ("Task" -> the task
 *                                       title). Only applies to pages whose last URL segment is a record id.
 *                                       PageHeader already does this with its title.
 *
 * Implementation: a tiny external store (no context re-renders of the whole tree).
 */

type Chrome = { slot: HTMLElement | null; mobileSlot: HTMLElement | null; label: { path: string; text: string } | null };

let state: Chrome = { slot: null, mobileSlot: null, label: null };
const listeners = new Set<() => void>();
const SERVER_STATE: Chrome = { slot: null, mobileSlot: null, label: null };

function setState(next: Partial<Chrome>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

function useChrome(): Chrome {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Header-only: callback ref for the element that receives the page action. */
export function registerActionSlot(element: HTMLElement | null) {
  if (state.slot !== element) setState({ slot: element });
}

/** Below `sm` the action leaves the header (see the note at the top). */
const NARROW_QUERY = "(max-width: 639.98px)";
function subscribeNarrow(listener: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const getNarrow = () => window.matchMedia(NARROW_QUERY).matches;
const getNarrowServer = () => false;
/** True below `sm`, where the header has less room. False on the server and until React has loaded. */
export function useIsNarrow() {
  return useSyncExternalStore(subscribeNarrow, getNarrow, getNarrowServer);
}

/** The page's single primary action: the global header on wide screens, under the page title on narrow ones. */
export function HeaderAction({ children, hideWhenNarrow = false }: { children: ReactNode; /** For pages that put the action somewhere else on narrow screens (a long form with its own submit button at the end). */ hideWhenNarrow?: boolean }) {
  const { slot, mobileSlot } = useChrome();
  const narrow = useIsNarrow();
  if (narrow && hideWhenNarrow) return null;
  const target = narrow && mobileSlot ? mobileSlot : slot;
  return target ? createPortal(children, target) : null;
}

/** Ref callback for the narrow-screen slot. The returned cleanup clears it only if it is still this element. */
function registerMobileSlot(element: HTMLElement | null) {
  if (!element) return;
  setState({ mobileSlot: element });
  return () => {
    if (state.mobileSlot === element) setState({ mobileSlot: null });
  };
}

/**
 * Narrow-screen home of the page action. `PageHeader` renders it under the title: on its own row (empty and hidden when the
 * page has no action) or, with `inline`, as the first item of the row of secondary actions so both sit side by side.
 */
export function MobileActionSlot({ inline = false }: { inline?: boolean }) {
  return <div ref={registerMobileSlot} className={inline ? "contents sm:hidden" : "flex flex-wrap items-center gap-2 empty:hidden sm:hidden"} />;
}

/** Real title for the last breadcrumb when the URL ends in a record id. */
export function BreadcrumbLabel({ children }: { children: string }) {
  const pathname = usePathname();
  useEffect(() => {
    setState({ label: { path: pathname, text: children } });
    return () => {
      if (state.label?.path === pathname) setState({ label: null });
    };
  }, [pathname, children]);
  return null;
}

/** The breadcrumb title registered for this path, if any. */
export function useBreadcrumbLabel(pathname: string): string | null {
  const { label } = useChrome();
  return label && label.path === pathname ? label.text : null;
}
