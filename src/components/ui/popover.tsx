"use client";

import { createPortal } from "react-dom";
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { computeFloatingPosition, focusableIn, getPortalHost, type FloatingPosition } from "./menu";

type PopoverApi = { close: () => void };

type PopoverProps = {
  /** The control that opens the panel (a button). Popover injects onClick and aria-* props. */
  trigger: ReactElement<Record<string, unknown>>;
  /** Accessible name of the panel. */
  label: string;
  children: ReactNode | ((api: PopoverApi) => ReactNode);
  align?: "start" | "end";
  /** Panel width in px (capped to the viewport). */
  width?: number;
  className?: string;
  /** Notified when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
};

/**
 * Anchored panel for filters, pickers and selectors. Portal (into an open dialog when inside one), fixed position
 * with viewport clamping, closes on Esc / outside click / scroll, focus moves in and returns to the trigger.
 */
export function Popover({ trigger, label, children, align = "start", width = 320, className, onOpenChange }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ box: FloatingPosition; host: HTMLElement } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const change = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) setPos(null);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(
    (returnFocus = true) => {
      change(false);
      if (returnFocus) (wrapperRef.current?.firstElementChild as HTMLElement | null)?.focus();
    },
    [change],
  );

  const toggle = (event: MouseEvent<HTMLElement>) => {
    (trigger.props.onClick as ((e: MouseEvent<HTMLElement>) => void) | undefined)?.(event);
    if (open) {
      change(false);
      return;
    }
    const element = event.currentTarget;
    const box = computeFloatingPosition(element.getBoundingClientRect(), { width: document.documentElement.clientWidth, height: window.innerHeight }, { width, align, maxHeight: 520, minSpace: 280 });
    setPos({ box, host: getPortalHost(element) });
    change(true);
  };

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    // Focus the first control inside, else the panel itself.
    (focusableIn(panel)[0] ?? panel)?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel?.contains(target) && !wrapperRef.current?.contains(target)) change(false);
    };
    const onScroll = (event: Event) => {
      if (panel && event.target instanceof Node && panel.contains(event.target)) return;
      change(false);
    };
    const onResize = () => change(false);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, change]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    // The panel is portalled to the end of the document, so keep Tab inside it while open.
    const nodes = focusableIn(panelRef.current);
    if (nodes.length === 0) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <span ref={wrapperRef} className="inline-flex min-w-0 max-w-full">
        {cloneElement(trigger, { onClick: toggle, "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": open ? id : undefined })}
      </span>
      {open && pos
        ? createPortal(
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={onKeyDown}
              style={{ position: "fixed", top: pos.box.top, bottom: pos.box.bottom, left: pos.box.left, width: pos.box.width, maxHeight: pos.box.maxHeight }}
              className={cn("ui-scroll z-[60] overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-pop outline-none", className)}
            >
              {/* eslint-disable-next-line react-hooks/refs -- `close` only touches refs when called from an event handler */}
              {typeof children === "function" ? children({ close: () => close() }) : children}
            </div>,
            pos.host,
          )
        : null}
    </>
  );
}
