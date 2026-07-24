import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "category" | "brand";
export type BadgeSize = "sm" | "md";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  count?: number;
  size?: BadgeSize;
  tone?: BadgeTone;
};

const toneClassNames = {
  neutral:
    "border-snake-neutral-border bg-snake-neutral-surface text-snake-neutral",
  info: "border-snake-info-border bg-snake-info-surface text-snake-info",
  category:
    "border-snake-category-labs-border bg-snake-category-labs-surface text-snake-category-labs",
  brand:
    "border-snake-brand-border bg-snake-brand-soft text-snake-brand-strong",
} as const satisfies Record<BadgeTone, string>;

const sizeClassNames = {
  sm: "px-2 py-0.5 text-[length:var(--snake-text-eyebrow-size)] leading-[var(--snake-text-eyebrow-line-height)]",
  md: "px-2.5 py-1 text-[length:var(--snake-text-label-size)] leading-[var(--snake-text-label-line-height)]",
} as const satisfies Record<BadgeSize, string>;

export function Badge({
  children,
  className,
  count,
  size = "md",
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-snake-pill border font-[var(--snake-font-weight-semibold)]",
        toneClassNames[tone],
        sizeClassNames[size],
        className,
      )}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span className="font-mono tabular-nums" data-slot="count">
          {count}
        </span>
      ) : null}
    </span>
  );
}
