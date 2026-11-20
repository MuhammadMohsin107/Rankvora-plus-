"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

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
  /** When true, closing (Esc, backdrop, close button) first asks to discard unsaved changes. */
  dirty?: boolean;
};

/**
 * Syncs a native <dialog> with `open`. The native modal dialog traps focus and closes on Esc; this adds
 * explicit focus return, a `data-autofocus` initial-focus hook, and a `shouldCancel` gate for unsaved changes.
 */
function useDialog(open: boolean, onClose: () => void, requestClose: () => void, shouldCancel: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const guard = useRef(shouldCancel);
  useEffect(() => {
    guard.current = shouldCancel;
  }, [shouldCancel]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node.showModal();
      node.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && node.open) {
      node.close();
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) target.focus();
    }
  }, [open]);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleClose = () => {
      const target = returnTo.current;
      returnTo.current = null;
      if (target?.isConnected) target.focus();
      onClose();
    };
    // Esc fires `cancel` first: with unsaved changes, keep the dialog open and ask instead.
    const handleCancel = (event: Event) => {
      if (!guard.current) return;
      event.preventDefault();
      requestClose();
    };
    node.addEventListener("close", handleClose);
    node.addEventListener("cancel", handleCancel);
    return () => {
      node.removeEventListener("close", handleClose);
      node.removeEventListener("cancel", handleCancel);
    };
  }, [onClose, requestClose]);
  return ref;
}

type DirtyGuardCopy = { title?: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string };

/**
 * Guards closing a form surface that has unsaved changes.
 *
 *   const guard = useDirtyGuard(isDirty, () => setOpen(false));
 *   <Dialog open={open} onClose={guard.requestClose}>...</Dialog>
 *   {guard.dialog}
 *
 * `requestClose()` closes immediately when clean, otherwise opens a "Discard changes?" confirm.
 * It also asks the browser to warn before the tab is closed while dirty.
 */
export function useDirtyGuard(dirty: boolean, onDiscard: () => void, copy?: DirtyGuardCopy) {
  const [asking, setAsking] = useState(false);

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onDiscard();
  }, [dirty, onDiscard]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const dialog = (
    <ConfirmDialog
      open={asking}
      onClose={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        onDiscard();
      }}
      title={copy?.title ?? "Discard changes?"}
      confirmLabel={copy?.confirmLabel ?? "Discard changes"}
      cancelLabel={copy?.cancelLabel ?? "Keep editing"}
    >
      {copy?.body ?? "Your unsaved changes will be lost."}
    </ConfirmDialog>
  );

  return { requestClose, dialog, asking };
}

const dialogSizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

/** Shared by Dialog and Drawer: header, scrolling body, optional footer. */
function Panel({ title, titleId, description, closeLabel, onRequestClose, children, footer, fill }: { title: string; titleId: string; description?: string; closeLabel: string; onRequestClose: () => void; children: ReactNode; footer?: ReactNode; fill?: boolean }) {
  return (
    <div className={cn("flex flex-col", fill ? "h-full" : "max-h-[85dvh] max-sm:max-h-[92dvh]")}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold text-fg">{title}</h2>
          {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
        </div>
        <IconButton icon="x" label={closeLabel} size="sm" onClick={onRequestClose} />
      </div>
      <div className="ui-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3 max-sm:[&>button]:flex-1">{footer}</div> : null}
    </div>
  );
}

/** Centered dialog; below the `sm` breakpoint it becomes a full-width bottom sheet. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", dirty = false }: BaseProps & { size?: keyof typeof dialogSizes }) {
  const [asking, setAsking] = useState(false);
  const titleId = useId();
  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);
  const ref = useDialog(open, onClose, requestClose, dirty);
  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === ref.current) requestClose();
        }}
        className={cn(
          "ui-dialog m-auto w-[calc(100%-2rem)] rounded-card border border-line bg-surface p-0 shadow-pop backdrop:backdrop-blur-[2px]",
          "max-sm:mb-0 max-sm:mt-auto max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0",
          dialogSizes[size],
        )}
      >
        {open ? (
          <Panel title={title} titleId={titleId} description={description} closeLabel="Close" onRequestClose={requestClose} footer={footer}>
            {children}
          </Panel>
        ) : null}
      </dialog>
      {dirty ? (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onClose();
          }}
          title="Discard changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
        >
          Your unsaved changes will be lost.
        </ConfirmDialog>
      ) : null}
    </>
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

/** Confirmation for destructive or external-write actions. Focus starts on the safe choice for destructive actions. */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, cancelLabel = "Cancel", tone = "danger", loading }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus={tone === "danger" ? "" : undefined}>{cancelLabel}</Button>
          <Button variant={tone} onClick={onConfirm} loading={loading} data-autofocus={tone === "danger" ? undefined : ""}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="text-sm text-fg-muted">{children}</div>
    </Dialog>
  );
}

const drawerSizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

/** Right-hand detail panel for secondary information (responses, pages, evidence). Full width on phones. */
export function Drawer({ open, onClose, title, description, children, footer, size = "lg", dirty = false }: BaseProps & { size?: keyof typeof drawerSizes }) {
  const [asking, setAsking] = useState(false);
  const titleId = useId();
  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);
  const ref = useDialog(open, onClose, requestClose, dirty);
  return (
    <>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === ref.current) requestClose();
        }}
        className={cn("ui-drawer m-0 ml-auto h-dvh max-h-dvh w-full rounded-none border-l border-line bg-surface p-0 shadow-pop max-sm:max-w-none max-sm:border-l-0", drawerSizes[size])}
      >
        {open ? (
          <Panel title={title} titleId={titleId} description={description} closeLabel="Close panel" onRequestClose={requestClose} footer={footer} fill>
            {children}
          </Panel>
        ) : null}
      </dialog>
      {dirty ? (
        <ConfirmDialog
          open={asking}
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onClose();
          }}
          title="Discard changes?"
          confirmLabel="Discard changes"
          cancelLabel="Keep editing"
        >
          Your unsaved changes will be lost.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
