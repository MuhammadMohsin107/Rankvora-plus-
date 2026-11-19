"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button, type ButtonVariant } from "./button";
import { IconButton } from "./button";

type BaseProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One short line under the title. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Syncs a native <dialog> with `open` and reports user-initiated closes (Esc / backdrop). */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleClose = () => onClose();
    node.addEventListener("close", handleClose);
    return () => node.removeEventListener("close", handleClose);
  }, [onClose]);
  return ref;
}

const dialogSizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: BaseProps & { size?: keyof typeof dialogSizes }) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "ui-dialog m-auto w-[calc(100%-2rem)] rounded-card border border-line bg-surface p-0 shadow-pop backdrop:backdrop-blur-[2px]",
        dialogSizes[size],
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
              {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
            </div>
            <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
          </div>
          <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Say exactly what will happen. */
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  loading?: boolean;
};

/** Confirmation for destructive or external-write actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Cancel", tone = "danger", loading }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-fg-muted">{children}</div>
    </Dialog>
  );
}

const drawerSizes = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Right-hand detail panel for secondary information (responses, pages, evidence). */
export function Drawer({ open, onClose, title, description, children, footer, size = "lg" }: BaseProps & { size?: keyof typeof drawerSizes }) {
  const ref = useDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "ui-drawer m-0 ml-auto h-dvh max-h-dvh w-full rounded-none border-l border-line bg-surface p-0 shadow-pop",
        drawerSizes[size],
      )}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
              {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
            </div>
            <IconButton icon="x" label="Close panel" size="sm" onClick={onClose} />
          </div>
          <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
