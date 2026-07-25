import type { ReactNode } from "react";

import { AppRouteShell } from "@/app/components/shell";

export type LagerRouteShellProps = {
  children: ReactNode;
};

export function LagerRouteShell({ children }: LagerRouteShellProps) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
