import type { ReactNode } from "react";

import { LAGER_MODULE_NAVIGATION } from "@/app/components/navigation";
import { AuthenticatedAppShell } from "@/app/components/shell";

export type LagerAppShellProps = {
  children: ReactNode;
};

export function LagerAppShell({ children }: LagerAppShellProps) {
  return (
    <AuthenticatedAppShell
      moduleNavigation={LAGER_MODULE_NAVIGATION}
      width="wide"
    >
      {children}
    </AuthenticatedAppShell>
  );
}
