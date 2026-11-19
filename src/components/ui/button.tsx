import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors duration-[var(--dur-fast)] disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-ghost": "text-danger hover:bg-danger-soft",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] pointer-coarse:min-h-11",
  md: "h-9 px-3.5 text-sm pointer-coarse:min-h-11",
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
  variant?: "ghost" | "secondary";
  badge?: ReactNode;
};

export function IconButton({ icon, label, size = "md", variant = "ghost", className, badge, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        base,
        variant === "ghost" ? "text-fg-muted hover:bg-surface-2 hover:text-fg" : "border border-line-strong bg-surface text-fg hover:bg-surface-2",
        size === "sm" ? "size-8" : "size-9",
        "relative pointer-coarse:size-11",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
      {badge}
    </button>
  );
}
