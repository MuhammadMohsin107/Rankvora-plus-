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
 *   <BreadcrumbLabel>Title</BreadcrumbLabel>
 *                                       replaces a trailing record id in the breadcrumb ("Task" -> the task
 *                                       title). Only applies to pages whose last URL segment is a record id.
 *                                       PageHeader already does this with its title.
 *
 * Implementation: a tiny external store (no context re-renders of the whole tree).
 */

type Chrome = { slot: HTMLElement | null; label: { path: string; text: string } | null };

let state: Chrome = { slot: null, label: null };
const listeners = new Set<() => void>();
const SERVER_STATE: Chrome = { slot: null, label: null };

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

/** The page's single primary action, rendered in the global header. */
export function HeaderAction({ children }: { children: ReactNode }) {
  const { slot } = useChrome();
  return slot ? createPortal(children, slot) : null;
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
