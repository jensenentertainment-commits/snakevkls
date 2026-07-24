import type { HTMLAttributes } from "react";

import { cn } from "./cn";

export type ProgressTone = "primary" | "success" | "warning" | "danger";

export type ProgressProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  label: string;
  max?: number;
  showValue?: boolean;
  tone?: ProgressTone;
  value: number;
};

const toneClassNames = {
  primary: "bg-snake-primary",
  success: "bg-snake-success",
  warning: "bg-snake-warning",
  danger: "bg-snake-danger",
} as const satisfies Record<ProgressTone, string>;

export function Progress({
  className,
  label,
  max = 100,
  showValue = false,
  tone = "primary",
  value,
  ...props
}: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value)
    ? Math.min(Math.max(value, 0), safeMax)
    : 0;
  const percentage = (safeValue / safeMax) * 100;

  return (
    <div {...props} className={cn("w-full", className)}>
      <div className="mb-2 flex items-center justify-between gap-3 text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-medium)] leading-[var(--snake-text-label-line-height)] text-snake-text-secondary">
        <span>{label}</span>
        {showValue ? (
          <span className="font-mono tabular-nums">
            {safeValue} / {safeMax}
          </span>
        ) : null}
      </div>
      <div
        aria-label={label}
        aria-valuemax={safeMax}
        aria-valuemin={0}
        aria-valuenow={safeValue}
        className="h-2 overflow-hidden rounded-snake-pill bg-snake-neutral-surface"
        role="progressbar"
      >
        <div
          className={cn(
            "h-full rounded-snake-pill transition-[width] motion-reduce:transition-none",
            toneClassNames[tone],
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
