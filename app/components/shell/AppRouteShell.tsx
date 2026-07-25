"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { isNavigationItemActive } from "@/app/components/navigation";

import { AuthenticatedAppShell } from "./AuthenticatedAppShell";
import { APP_ROUTE_SHELLS } from "./route-config";

export type AppRouteShellProps = {
  children: ReactNode;
};

export function AppRouteShell({ children }: AppRouteShellProps) {
  const pathname = usePathname();
  const routeShell = APP_ROUTE_SHELLS.find(({ navigationItem }) =>
    isNavigationItemActive(pathname, navigationItem),
  );

  if (!routeShell) return children;

  return (
    <AuthenticatedAppShell
      moduleNavigation={routeShell.moduleNavigation}
      width={routeShell.width}
    >
      {children}
    </AuthenticatedAppShell>
  );
}
