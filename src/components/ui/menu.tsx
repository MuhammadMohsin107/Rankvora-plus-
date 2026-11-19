"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { cloneElement, useCallback, useEffect, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";

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
};

export type MenuItem = MenuAction | { type: "separator" } | { type: "label"; label: string };

type MenuProps = {
  /** The control that opens the menu (a button). Menu injects onClick and aria-* props; style the open state with `aria-expanded:`. */
  trigger: ReactElement<Record<string, unknown>>;
  items: MenuItem[];
  align?: "start" | "end";
  width?: number;
  className?: string;
  /** Optional header node shown above the items. */
  header?: ReactNode;
};

/**
 * Accessible dropdown menu: fixed positioning (escapes clipped tables),
 * arrow-key navigation, Esc and outside-click to close, focus returns to trigger.
 */
export function Menu({ trigger, items, align = "end", width = 224, header, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
    wrapperRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  const toggle = (event: MouseEvent<HTMLElement>) => {
    if (open) {
      setOpen(false);
      setPos(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    // Never wider than the viewport minus a 8px gutter on each side (phones, small windows).
    const panelWidth = Math.min(width, document.documentElement.clientWidth - 16);
    const edge = document.documentElement.clientWidth - panelWidth - 8;
    const left = align === "end" ? Math.max(8, Math.min(edge, rect.right - panelWidth)) : Math.max(8, Math.min(edge, rect.left));
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const openUp = below < 220 && above > below;
    setPos({
      left,
      width: panelWidth,
      top: openUp ? Math.max(8, rect.top - 6 - Math.min(above, 360)) : rect.bottom + 6,
      maxHeight: Math.min(openUp ? above : below, 360),
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const items = panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    items?.[0]?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !wrapperRef.current?.contains(target)) {
        setOpen(false);
        setPos(null);
      }
    };
    const onScroll = () => {
      setOpen(false);
      setPos(null);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nodes[(index + 1) % nodes.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      nodes[(index - 1 + nodes.length) % nodes.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      nodes[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      nodes[nodes.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
      setPos(null);
    }
  };

  const itemClass = (item: MenuAction) =>
    cn(
      "flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors duration-[var(--dur-fast)] focus-visible:bg-surface-2 hover:bg-surface-2 pointer-coarse:min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-45",
      item.tone === "danger" ? "text-danger" : "text-fg",
    );

  return (
    <>
      <span ref={wrapperRef} className="inline-flex min-w-0 max-w-full">
        {cloneElement(trigger, { onClick: toggle, "aria-haspopup": "menu", "aria-expanded": open, "aria-controls": id })}
      </span>
      {open && pos
        ? // Portal to <body>: an ancestor with backdrop-filter (the sticky top bar) would otherwise
          // become the containing block of this fixed panel and shift it by the sidebar width.
          createPortal(
        <div
          ref={panelRef}
          id={id}
          role="menu"
          onKeyDown={onKeyDown}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className={cn("ui-scroll z-[60] overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop", className)}
        >
          {header ? <div className="border-b border-line px-2.5 pb-2 pt-1.5">{header}</div> : null}
          {items.map((item, index) => {
            if (item.type === "separator") return <div key={index} role="separator" className="my-1 h-px bg-line" />;
            if (item.type === "label") return <p key={index} className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">{item.label}</p>;
            const content = (
              <>
                {item.icon ? <Icon name={item.icon} size={15} className="shrink-0" /> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.meta}
              </>
            );
            if (item.href && !item.disabled) {
              return (
                <Link key={index} href={item.href} role="menuitem" tabIndex={-1} onClick={() => setOpen(false)} className={itemClass(item)}>
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
                aria-disabled={item.disabled || undefined}
                title={item.disabled ? item.disabledReason : undefined}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  setPos(null);
                  item.onSelect?.();
                }}
                className={itemClass(item)}
              >
                {content}
              </button>
            );
          })}
        </div>,
            document.body,
          )
        : null}
    </>
  );
}
