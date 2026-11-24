"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";

const control =
  "w-full rounded-control border border-line-strong bg-surface px-3 text-base text-fg placeholder:text-fg-subtle transition-[border-color,background-color] duration-[var(--dur-fast)] hover:border-fg-faint focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60 read-only:bg-surface-2 aria-[invalid=true]:border-danger md:text-body";

/** Borderless look for controls that sit inside a toolbar (FilterBar): the bar draws the border. Text colour is set by the caller. */
const bare =
  "h-8 w-full rounded-control border-0 bg-transparent text-base transition-colors duration-[var(--dur-fast)] placeholder:text-fg-subtle hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:text-body";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
};

/** Visible label + helper text + error, wired with aria-describedby. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label font-medium text-fg">
        {label}
        {required ? <span className="ml-0.5 text-danger-text" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-helper text-danger-text">
          <Icon name="alert-circle" size={13} className="text-danger-icon" />
          {error}
        </p>
      ) : null}
      {hint && !error ? <p id={hintId} className="text-helper text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export function Input({ className, invalid, ...rest }: InputProps) {
  return <input aria-invalid={invalid || undefined} className={cn(control, "h-control", className)} {...rest} />;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export function Textarea({ className, invalid, rows = 4, ...rest }: TextareaProps) {
  return <textarea rows={rows} aria-invalid={invalid || undefined} className={cn(control, "py-2 leading-relaxed", className)} {...rest} />;
}

/** `dense`: 36px high instead of 40px, for toolbars and table rows. */
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; dense?: boolean; /** Borderless, for use inside a toolbar. */ bare?: boolean };
export function Select({ className, invalid, dense, bare: isBare, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={isBare ? cn(bare, "cursor-pointer appearance-none pl-3 pr-8", className) : cn(control, dense ? "h-9" : "h-control", "cursor-pointer appearance-none pr-9", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon name="chevron-down" className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-fg-subtle", isBare ? "right-2.5" : "right-3")} />
    </div>
  );
}

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode; description?: string };
export function Checkbox({ label, description, className, id: idProp, ...rest }: CheckboxProps) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--accent)] pointer-coarse:size-5"
        {...rest}
      />
      {label ? (
        <span className="flex flex-col">
          <span className="text-body text-fg">{label}</span>
          {description ? <span className="text-helper text-fg-subtle">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};
export function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-[var(--dur)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45 pointer-coarse:h-6 pointer-coarse:w-11",
        checked ? "bg-accent" : "bg-fg-faint",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-surface shadow-card transition-transform duration-[var(--dur)] motion-reduce:transition-none pointer-coarse:size-5",
          checked ? "translate-x-[18px] pointer-coarse:translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; icon?: Parameters<typeof Icon>[0]["name"]; count?: number }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
};
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex rounded-control border border-line bg-surface-2 p-0.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 font-medium transition-colors duration-[var(--dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring pointer-coarse:min-h-10",
              size === "sm" ? "h-7 text-helper" : "h-8 text-label",
              active ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
            )}
          >
            {option.icon ? <Icon name={option.icon} size={14} /> : null}
            {option.label}
            {option.count !== undefined ? <span className="tnum text-fg-subtle">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

type RadioCardsProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; description?: string; disabled?: boolean; badge?: ReactNode }[];
  label: string;
  columns?: 1 | 2 | 3;
};
/** Radio group rendered as selectable cards (e.g. connection method). */
export function RadioCards<T extends string>({ value, onChange, options, label, columns = 3 }: RadioCardsProps<T>) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className={cn("grid gap-2", columns === 1 ? "grid-cols-1" : columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-control border p-3.5 transition-colors duration-[var(--dur-fast)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                checked ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-2",
                option.disabled && "pointer-events-none opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2 text-body font-medium text-fg">{option.label}{option.badge}</span>
                {option.description ? <span className="text-helper text-fg-muted">{option.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  value: string;
  onChange: (next: string) => void;
  label: string;
  /** 36px high instead of 40px. */
  dense?: boolean;
  /** Borderless, for use inside a toolbar. */
  bare?: boolean;
};
export function SearchField({ value, onChange, label, className, placeholder = "Search", dense, bare: isBare, ...rest }: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={isBare ? cn(bare, "pl-9 text-fg", value ? "pr-9" : "pr-3") : cn(control, dense ? "h-9" : "h-control", "pl-9", value && "pr-10")}
        {...rest}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg pointer-coarse:size-9"
        >
          <Icon name="x" size={14} />
        </button>
      ) : null}
    </div>
  );
}
