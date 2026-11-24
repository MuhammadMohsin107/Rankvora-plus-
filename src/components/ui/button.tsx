import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "dark" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Heights come from tokens: sm 32, md 36, lg 40; all 44 on coarse pointers.
 * Press feedback is a 0.98 scale on transform only; reduced motion removes it.
 */
const base =
  "inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-[color,background-color,border-color,transform,opacity] duration-[var(--dur-fast)] ease-[var(--ease)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-fg hover:border-fg-faint hover:bg-surface-2",
  /** Solid near-black (light theme) or near-white (dark theme): the strongest neutral button. */
  dark: "bg-fg text-surface hover:bg-fg/85",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger-solid text-danger-fg hover:bg-danger-solid-hover",
  "danger-ghost": "text-danger-text hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-btn-sm px-3 text-label",
  md: "h-btn px-4 text-body",
  lg: "h-btn-lg px-5 text-body",
};

export function buttonStyles(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  trailingIcon,
  loading,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles(variant, size, className)}
      {...rest}
    >
      {loading ? <Icon name="loader" className="animate-spin" /> : icon ? <Icon name={icon} /> : null}
      {children}
      {trailingIcon && !loading ? <Icon name={trailingIcon} /> : null}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
};

export function ButtonLink({ variant = "secondary", size = "md", icon, trailingIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonStyles(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} /> : null}
    </Link>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: IconName;
  /** Required: icon-only controls need an accessible name. */
  label: string;
  size?: ButtonSize;
  variant?: "ghost" | "secondary" | "primary" | "danger-ghost";
  badge?: ReactNode;
};

const iconVariants = {
  ghost: variants.ghost,
  secondary: variants.secondary,
  primary: variants.primary,
  "danger-ghost": variants["danger-ghost"],
} as const;

const iconSizes: Record<ButtonSize, string> = { sm: "size-btn-sm", md: "size-btn", lg: "size-btn-lg" };

export function IconButton({ icon, label, size = "md", variant = "ghost", className, badge, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, iconVariants[variant], iconSizes[size], "relative", className)}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
      {badge}
    </button>
  );
}
