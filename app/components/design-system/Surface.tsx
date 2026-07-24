import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

export type SurfaceVariant = "workspace" | "card" | "dark" | "glass";

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "main" | "section";
  children: ReactNode;
  variant?: SurfaceVariant;
};

const variantClassNames = {
  workspace:
    "bg-snake-workspace text-snake-text-primary shadow-snake-overlay",
  card: "bg-snake-surface text-snake-text-primary shadow-snake-card",
  dark: "bg-snake-app-elevated text-snake-text-on-dark shadow-snake-panel",
  glass:
    "border border-snake-border-on-dark-subtle bg-snake-app-elevated/80 text-snake-text-on-dark shadow-snake-glass backdrop-blur-xl",
} as const satisfies Record<SurfaceVariant, string>;

export function Surface({
  as: Element = "div",
  children,
  className,
  variant = "card",
  ...props
}: SurfaceProps) {
  return (
    <Element
      {...props}
      className={cn(
        "rounded-snake-panel",
        variantClassNames[variant],
        className,
      )}
    >
      {children}
    </Element>
  );
}
