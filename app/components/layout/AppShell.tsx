import type { ReactNode } from "react";

import { cn } from "@/app/components/design-system/cn";

export type AppShellProps = {
  children: ReactNode;
  moduleNav?: ReactNode;
  navbar: ReactNode;
  width?: "default" | "wide";
};

const widthClassNames = {
  default: "max-w-[var(--snake-shell-max-width)]",
  wide: "max-w-[var(--snake-shell-wide-max-width)]",
} as const satisfies Record<NonNullable<AppShellProps["width"]>, string>;

export function AppShell({
  children,
  moduleNav,
  navbar,
  width = "default",
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-snake-app text-snake-text-on-dark">
      {navbar}
      {moduleNav}
      <main
        className={cn(
          "mx-auto w-full px-[var(--snake-page-gutter-mobile)] py-[var(--snake-space-6)] sm:px-[var(--snake-page-gutter-tablet)] lg:px-[var(--snake-page-gutter-desktop)] lg:py-[var(--snake-space-8)]",
          widthClassNames[width],
        )}
      >
        {children}
      </main>
    </div>
  );
}
