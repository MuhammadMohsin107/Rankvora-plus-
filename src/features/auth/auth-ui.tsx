"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { ApiRequestError } from "@/lib/api-client";

/** The card every account page shares. One heading, the form, and one line of links below. */
export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Card>
        <CardBody className="flex flex-col gap-4 p-5">
          <h1 className="rv-section-title">{title}</h1>
          {children}
        </CardBody>
      </Card>
      {footer ? <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-body-sm text-fg-muted">{footer}</div> : null}
    </div>
  );
}

export const authLink = "inline-flex min-h-target items-center rounded font-medium text-accent-text hover:underline";

/** A message about the whole form, announced when it appears. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-control border border-line border-l-[3px] border-l-danger bg-surface-2 px-3 py-2 text-body-sm text-fg">
      <Icon name="alert-circle" size={16} className="mt-px shrink-0 text-danger-icon" />
      {message}
    </p>
  );
}

export function FormNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-control border border-line bg-surface-2 px-3 py-2 text-body-sm text-fg">
      <Icon name="check-circle" size={16} className="mt-px shrink-0 text-success-icon" />
      <span>{children}</span>
    </p>
  );
}

type PasswordProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  label: string;
  value: string;
  onValue: (value: string) => void;
  error?: string;
  hint?: string;
};

/** Password input with a show/hide button. Paste and password managers work as usual. */
export function PasswordField({ label, value, onValue, error, hint, ...rest }: PasswordProps) {
  const [shown, setShown] = useState(false);
  return (
    <Field label={label} required error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input id={id} type={shown ? "text" : "password"} aria-describedby={describedBy} invalid={invalid} value={value} onChange={(event) => onValue(event.target.value)} className="pr-11" {...rest} />
          <button
            type="button"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            onClick={() => setShown((current) => !current)}
            className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-fg-subtle hover:bg-surface-2 hover:text-fg"
          >
            <Icon name={shown ? "eye-off" : "eye"} size={16} />
          </button>
        </div>
      )}
    </Field>
  );
}

export function Loading() {
  return (
    <p role="status" className="flex items-center justify-center py-2 text-fg-subtle">
      <Spinner />
      <span className="sr-only">Loading</span>
    </p>
  );
}

export const messageOf = (error: unknown) => (error instanceof ApiRequestError ? error.message : "Something went wrong. Try again.");
