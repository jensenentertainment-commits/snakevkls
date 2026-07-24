"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/app/components/design-system/cn";
import {
  isNavigationItemActive,
  type NavigationItem,
} from "@/app/components/navigation/types";

export type AppNavLinksProps = {
  items: readonly NavigationItem[];
  layout?: "horizontal" | "vertical";
};

const layoutClassNames = {
  horizontal: "flex items-center gap-1",
  vertical: "flex flex-col gap-1",
} as const satisfies Record<
  NonNullable<AppNavLinksProps["layout"]>,
  string
>;

export function AppNavLinks({
  items,
  layout = "horizontal",
}: AppNavLinksProps) {
  const pathname = usePathname();

  return (
    <ul className={layoutClassNames[layout]}>
      {items.map((item) => {
        const active = isNavigationItemActive(pathname, item);
        const Icon = item.icon;

        return (
          <li key={item.id}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-snake-control border px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] leading-[var(--snake-text-body-small-line-height)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark motion-reduce:transition-none",
                active
                  ? "border-snake-border-selected bg-snake-brand-soft text-snake-text-on-dark"
                  : "border-transparent text-snake-text-on-dark-muted hover:bg-snake-app-elevated hover:text-snake-text-on-dark",
              )}
              href={item.href}
            >
              {Icon ? (
                <Icon aria-hidden="true" className="shrink-0" size={18} />
              ) : null}
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
