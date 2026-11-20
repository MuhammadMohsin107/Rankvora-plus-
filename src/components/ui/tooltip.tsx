"use client";

import { createPortal } from "react-dom";
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { getPortalHost } from "./menu";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
  /** Milliseconds before showing on hover (focus shows immediately). Default 120. */
  delay?: number;
};

type Open = { rect: DOMRect; host: HTMLElement };

/**
 * Tooltip rendered in a portal with fixed positioning, so it is never clipped by overflow-hidden cards or table cells.
 * Shows on hover and keyboard focus, hides on Escape, scroll and pointer-leave; a tap toggles it on touch screens.
 * The text is always available to assistive tech through aria-describedby. Keep it to one short sentence.
 */
export function Tooltip({ content, children, side = "top", className, delay = 120 }: TooltipProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timer = useRef(0);
  const touchedAt = useRef(0);
  const [open, setOpen] = useState<Open | null>(null);

  const clear = () => window.clearTimeout(timer.current);

  const show = useCallback((wait: number) => {
    window.clearTimeout(timer.current);
    const reveal = () => {
      const node = wrapperRef.current;
      if (node) setOpen({ rect: node.getBoundingClientRect(), host: getPortalHost(node) });
    };
    if (wait > 0) timer.current = window.setTimeout(reveal, wait);
    else reveal();
  }, []);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(null);
  }, []);

  const hideSoon = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(null), 80);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Position after the bubble has size: set styles directly on the node (no extra render, no layout flash).
  const place = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !open) return;
      const { rect } = open;
      const gutter = 8;
      const vw = document.documentElement.clientWidth;
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const left = Math.max(gutter, Math.min(vw - width - gutter, rect.left + rect.width / 2 - width / 2));
      const fitsAbove = rect.top - height - 6 >= gutter;
      const fitsBelow = rect.bottom + height + 6 <= window.innerHeight - gutter;
      const above = side === "top" ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
      node.style.left = `${left}px`;
      node.style.top = `${above ? rect.top - height - 6 : rect.bottom + 6}px`;
      node.style.visibility = "visible";
    },
    [open, side],
  );

  // Put the description on the real control when the child is a plain DOM element (the wrapper is not focusable).
  const child =
    isValidElement(children) && typeof children.type === "string"
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          "aria-describedby": [(children.props as Record<string, unknown>)["aria-describedby"], id].filter(Boolean).join(" "),
        })
      : children;

  return (
    <span
      ref={wrapperRef}
      className={cn("relative inline-flex", className)}
      aria-describedby={id}
      onMouseEnter={() => {
        if (Date.now() - touchedAt.current < 600) return;
        show(delay);
      }}
      onMouseLeave={hideSoon}
      onFocus={() => show(0)}
      onBlur={hide}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        touchedAt.current = Date.now();
        if (open) hide();
        else show(0);
      }}
    >
      {child}
      {/* Hidden elements can still be referenced by aria-describedby, and are not read twice in browse mode. */}
      <span id={id} hidden>
        {content}
      </span>
      {open
        ? createPortal(
            <div
              ref={place}
              role="presentation"
              onMouseEnter={clear}
              onMouseLeave={hideSoon}
              style={{ position: "fixed", visibility: "hidden", top: 0, left: 0 }}
              className="z-[70] w-max max-w-[min(260px,calc(100vw-16px))] rounded-md bg-fg px-2 py-1 text-xs font-normal leading-snug text-canvas shadow-pop"
            >
              {content}
            </div>,
            open.host,
          )
        : null}
    </span>
  );
}
