import type { ComponentType } from "react";

export type NavigationIcon = ComponentType<{
  "aria-hidden"?: boolean | "true" | "false";
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
}>;

export type NavigationItem = {
  href: string;
  icon?: NavigationIcon;
  id: string;
  label: string;
  matchPaths?: readonly string[];
};

export type ModuleNavigation = {
  id: string;
  items: readonly NavigationItem[];
  label: string;
};

export function isNavigationItemActive(
  pathname: string,
  item: NavigationItem,
) {
  const paths = item.matchPaths ?? [item.href];

  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
