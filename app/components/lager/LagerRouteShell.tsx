"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { GLOBAL_NAVIGATION_ITEMS } from "@/app/components/navigation";
import { isNavigationItemActive } from "@/app/components/navigation/types";

import { LagerAppShell } from "./LagerAppShell";

export type LagerRouteShellProps = {
  children: ReactNode;
};

const lagerNavigationItem = GLOBAL_NAVIGATION_ITEMS.find(
  (item) => item.id === "lager",
);

export function LagerRouteShell({ children }: LagerRouteShellProps) {
  const pathname = usePathname();
  const isLagerRoute =
    lagerNavigationItem !== undefined &&
    isNavigationItemActive(pathname, lagerNavigationItem);

  if (!isLagerRoute) return children;

  return <LagerAppShell>{children}</LagerAppShell>;
}
