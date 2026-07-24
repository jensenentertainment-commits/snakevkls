import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type CardVariant =
  | "default"
  | "subtle"
  | "interactive"
  | "selected"
  | "disabled"
  | "status";
export type CardStatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
  children: ReactNode;
  statusTone?: CardStatusTone;
  variant?: CardVariant;
};

const variantClassNames = {
  default:
    "border-snake-border-subtle bg-snake-surface text-snake-text-primary shadow-snake-card",
  subtle:
    "border-snake-border-subtle bg-snake-surface-subtle text-snake-text-primary shadow-snake-none",
  interactive:
    "border-snake-border-default bg-snake-surface text-snake-text-primary shadow-snake-card transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-snake-primary hover:shadow-snake-panel motion-reduce:transform-none motion-reduce:transition-none",
  selected:
    "border-snake-border-selected bg-snake-brand-soft text-snake-text-primary shadow-snake-card",
  disabled:
    "border-snake-border-subtle bg-snake-neutral-surface text-snake-text-disabled shadow-snake-none opacity-50",
  status:
    "border-snake-neutral-border bg-snake-neutral-surface text-snake-neutral shadow-snake-card",
} as const satisfies Record<CardVariant, string>;

const statusClassNames = {
  success:
    "border-snake-success-border bg-snake-success-surface text-snake-success",
  warning:
    "border-snake-warning-border bg-snake-warning-surface text-snake-warning",
  danger:
    "border-snake-danger-border bg-snake-danger-surface text-snake-danger",
  info: "border-snake-info-border bg-snake-info-surface text-snake-info",
  neutral:
    "border-snake-neutral-border bg-snake-neutral-surface text-snake-neutral",
} as const satisfies Record<CardStatusTone, string>;

export function Card({
  as: Element = "div",
  children,
  className,
  statusTone = "neutral",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <Element
      {...props}
      aria-disabled={variant === "disabled" || undefined}
      className={cn(
        "rounded-snake-card border p-5",
        variantClassNames[variant],
        variant === "status" && statusClassNames[statusTone],
        className,
      )}
    >
      {children}
    </Element>
  );
}
