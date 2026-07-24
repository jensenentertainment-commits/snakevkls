import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  type ButtonSize,
  type ButtonVariant,
  Button,
} from "./Button";
import { cn } from "./cn";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  "aria-label": string;
  children: ReactNode;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

const squareClassNames = {
  sm: "w-9 px-0",
  md: "w-11 px-0",
  lg: "w-14 px-0",
} as const satisfies Record<ButtonSize, string>;

export function IconButton({
  "aria-label": ariaLabel,
  children,
  className,
  loading = false,
  size = "md",
  variant = "secondary",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      aria-label={ariaLabel}
      className={cn(squareClassNames[size], className)}
      loading={loading}
      loadingLabel=""
      size={size}
      type={type}
      variant={variant}
    >
      <span aria-hidden="true" className="inline-flex">
        {children}
      </span>
    </Button>
  );
}
