import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type StatusBadgeProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  "children"
> & {
  icon?: ReactNode;
  label: string;
  tone?: StatusTone;
};

const toneClassNames = {
  success:
    "border-snake-success-border bg-snake-success-surface text-snake-success",
  warning:
    "border-snake-warning-border bg-snake-warning-surface text-snake-warning",
  danger:
    "border-snake-danger-border bg-snake-danger-surface text-snake-danger",
  info: "border-snake-info-border bg-snake-info-surface text-snake-info",
  neutral:
    "border-snake-neutral-border bg-snake-neutral-surface text-snake-neutral",
} as const satisfies Record<StatusTone, string>;

export function StatusBadge({
  className,
  icon,
  label,
  tone = "neutral",
  ...props
}: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-snake-pill border px-2.5 py-1 text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-eyebrow-line-height)]",
        toneClassNames[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </span>
  );
}
