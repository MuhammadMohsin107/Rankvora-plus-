"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

export type MenuAction = {
  type?: "item";
  label: string;
  icon?: IconName;
  onSelect?: () => void;
  href?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Why it is disabled (shown as the item title). */
  disabledReason?: string;
  meta?: ReactNode;
  /** One short line under the label. */
  description?: string;
  /** Shortcut hint shown at the end of the row, e.g. "Ctrl K". Display only. */
  shortcut?: string;
};

export type MenuItem = MenuAction | { type: "separator" } | { type: "label"; label: string };

/* ------------------------------------------------------------------ */
/* Shared floating helpers (also used by Popover and Tooltip)          */
/* ------------------------------------------------------------------ */

export type AnchorRect = { top: number; bottom: number; left: number; right: number };
export type FloatingPosition = {
  left: number;
  width: number;
  maxHeight: number;
  /** Set when the panel opens downwards. */
  top?: number;
  /** Set when the panel opens upwards (anchored to the trigger so there is never a gap). */
  bottom?: number;
  placement: "down" | "up";
};

type FloatingOptions = {
  width: number;
  align?: "start" | "end";
  gap?: number;
  maxHeight?: number;
  /** Open upwards only when less than this fits below and more fits above. */
  minSpace?: number;
};

/**
 * Pure positioning for fixed panels: never wider than the viewport minus an 8px gutter,
 * clamped horizontally, flips upwards when space below is short. Unit-tested.
 */
export function computeFloatingPosition(anchor: AnchorRect, viewport: { width: number; height: number }, options: FloatingOptions): FloatingPosition {
  const { width, align = "end", gap = 6, maxHeight = 360, minSpace = 220 } = options;
  const panelWidth = Math.max(0, Math.min(width, viewport.width - 16));
  const edge = viewport.width - panelWidth - 8;
  const wanted = align === "end" ? anchor.right - panelWidth : anchor.left;
  const left = Math.max(8, Math.min(edge, wanted));
  const below = viewport.height - anchor.bottom - 12;
  const above = anchor.top - 12;
  const openUp = below < minSpace && above > below;
  if (openUp) {
    return { left, width: panelWidth, bottom: viewport.height - anchor.top + gap, maxHeight: Math.min(above, maxHeight), placement: "up" };
  }
  return { left, width: panelWidth, top: anchor.bottom + gap, maxHeight: Math.min(below, maxHeight), placement: "down" };
}

/**
 * Where to portal a floating panel. A modal <dialog> lives in the top layer, so a panel portalled to <body>
 * would render underneath it; inside an open dialog we portal into the dialog instead.
 */
export function getPortalHost(from: Element | null): HTMLElement {
  return (from?.closest("dialog[open]") as HTMLElement | null) ?? document.body;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Focusable descendants of a container, in DOM order. */
export function focusableIn(container: HTMLElement | null): HTMLElement[] {
  return Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((node) => !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
}

/* ------------------------------------------------------------------ */

type MenuProps = {
  /** The control that opens the menu (a button). Menu injects onClick and aria-* props; style the open state with `aria-expanded:`. */
  trigger: ReactElement<Record<string, unknown>>;
  items: MenuItem[];
  align?: "start" | "end";
  width?: number;
  className?: string;
  /** Optional header node shown above the items. */
  header?: ReactNode;
  /** Accessible name of the menu. */
  label?: string;
  /** Jump to an item by typing its first letters (default on). */
  typeahead?: boolean;
};

const ITEM_SELECTOR = '[role="menuitem"]:not([aria-disabled="true"])';

/**
 * Accessible dropdown menu: fixed positioning (escapes clipped tables), portal (into an open dialog when inside one),
 * roving focus with arrow keys / Home / End / typeahead, Esc and outside-click to close, focus returns to the trigger.
 */
export function Menu({ trigger, items, align = "end", width = 224, header, className, label, typeahead = true }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ box: FloatingPosition; host: HTMLElement } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const typed = useRef({ text: "", timer: 0 });
  const id = useId();

  const triggerEl = () => wrapperRef.current?.firstElementChild as HTMLElement | null;

  const hide = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const close = useCallback(() => {
    hide();
    (wrapperRef.current?.firstElementChild as HTMLElement | null)?.focus();
  }, [hide]);

  const openFor = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const box = computeFloatingPosition(rect, { width: document.documentElement.clientWidth, height: window.innerHeight }, { width, align });
    setPos({ box, host: getPortalHost(element) });
    setOpen(true);
  };

  const toggle = (event: MouseEvent<HTMLElement>) => {
    (trigger.props.onClick as ((e: MouseEvent<HTMLElement>) => void) | undefined)?.(event);
    if (open) hide();
    else {
      initialFocus.current = "first";
      openFor(event.currentTarget);
    }
  };

  useEffect(() => {
    if (!open) return;
    const nodes = panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
    if (nodes && nodes.length > 0) (initialFocus.current === "last" ? nodes[nodes.length - 1] : nodes[0]).focus();
    else panelRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !wrapperRef.current?.contains(target)) hide();
    };
    // Any scroll outside the panel moves the trigger away from the panel, so close instead of floating loose.
    const onScroll = (event: Event) => {
      if (panelRef.current && event.target instanceof Node && panelRef.current.contains(event.target)) return;
      hide();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, hide]);

  useEffect(() => {
    const state = typed.current;
    return () => window.clearTimeout(state.timer);
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const focusAt = (next: number) => nodes[(next + nodes.length) % nodes.length]?.focus();
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(nodes.length - 1);
    } else if (event.key === "Tab") {
      // Return focus to the trigger so Tab continues from where the menu was opened.
      hide();
      triggerEl()?.focus();
    } else if (typeahead && event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const state = typed.current;
      window.clearTimeout(state.timer);
      state.text += event.key.toLowerCase();
      state.timer = window.setTimeout(() => {
        state.text = "";
      }, 700);
      const labelOf = (node: HTMLElement) => (node.dataset.label ?? node.textContent ?? "").toLowerCase();
      const ordered = [...nodes.slice(index + 1), ...nodes.slice(0, index + 1)];
      // Repeating one letter cycles through items that start with it.
      const needle = state.text.length > 1 && state.text.split("").every((c) => c === state.text[0]) ? state.text[0] : state.text;
      ordered.find((node) => labelOf(node).startsWith(needle))?.focus();
    }
  };

  const itemClass = (item: MenuAction) =>
    cn(
      "flex w-full cursor-pointer gap-2 rounded-md px-2.5 py-2 text-left text-[13px] outline-none transition-colors duration-[var(--dur-fast)] hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent pointer-coarse:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
      item.description ? "items-start" : "items-center",
      item.tone === "danger" ? "text-danger-text" : "text-fg",
    );

  return (
    <>
      <span
        ref={wrapperRef}
        className="inline-flex min-w-0 max-w-full"
        onKeyDown={(event) => {
          if (open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
          if (event.target !== triggerEl()) return;
          event.preventDefault();
          initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
          openFor(event.target as HTMLElement);
        }}
      >
        {/* eslint-disable-next-line react-hooks/refs -- `toggle` only touches refs inside the click handler, never during render */}
        {cloneElement(trigger, { onClick: toggle, "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": open ? id : undefined })}
      </span>
      {open && pos
        ? // Portal out of the clipped / backdrop-filter ancestors: a fixed panel inside a filtered ancestor would be offset by it.
          createPortal(
            <div
              ref={panelRef}
              id={id}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              style={{ position: "fixed", top: pos.box.top, bottom: pos.box.bottom, left: pos.box.left, width: pos.box.width, maxHeight: pos.box.maxHeight }}
              className={cn("ui-scroll z-[60] overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop outline-none", className)}
            >
              {header ? <div className="border-b border-line px-2.5 pb-2 pt-1.5">{header}</div> : null}
              {items.map((item, index) => {
                if (item.type === "separator") return <div key={index} role="separator" className="my-1 h-px bg-line" />;
                if (item.type === "label") return <p key={index} role="presentation" className="px-2.5 pb-1 pt-2 text-xs font-semibold text-fg-muted">{item.label}</p>;
                const content = (
                  <>
                    {item.icon ? <Icon name={item.icon} size={16} className={cn("shrink-0", item.description && "mt-0.5")} /> : null}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{item.label}</span>
                      {item.description ? <span className="truncate text-xs font-normal text-fg-muted">{item.description}</span> : null}
                    </span>
                    {item.meta}
                    {item.shortcut ? <kbd className="tnum ml-2 shrink-0 font-sans text-xs text-fg-muted">{item.shortcut}</kbd> : null}
                  </>
                );
                if (item.href && !item.disabled) {
                  return (
                    <Link key={index} href={item.href} role="menuitem" tabIndex={-1} data-label={item.label} onClick={hide} className={itemClass(item)}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={index}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-label={item.label}
                    aria-disabled={item.disabled || undefined}
                    title={item.disabled ? item.disabledReason : undefined}
                    onClick={() => {
                      if (item.disabled) return;
                      hide();
                      triggerEl()?.focus();
                      item.onSelect?.();
                    }}
                    className={itemClass(item)}
                  >
                    {content}
                  </button>
                );
              })}
            </div>,
            pos.host,
          )
        : null}
    </>
  );
}
