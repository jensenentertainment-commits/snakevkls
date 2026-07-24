import type { ModuleNavigation } from "@/app/components/navigation/types";

import { AppNavLinks } from "./AppNavLinks";
import { ModuleNavMobile } from "./ModuleNavMobile";

export type ModuleNavProps = {
  navigation: ModuleNavigation;
};

export function ModuleNav({ navigation }: ModuleNavProps) {
  return (
    <nav
      aria-label={`${navigation.label}: arbeidsnavigasjon`}
      className="border-b border-snake-border-on-dark-subtle bg-snake-app"
    >
      <div className="mx-auto max-w-[var(--snake-shell-wide-max-width)] px-[var(--snake-page-gutter-mobile)] py-3 sm:px-[var(--snake-page-gutter-tablet)] lg:px-[var(--snake-page-gutter-desktop)]">
        <div className="hidden lg:block">
          <AppNavLinks items={navigation.items} />
        </div>
        <ModuleNavMobile
          items={navigation.items}
          label={navigation.label}
        />
      </div>
    </nav>
  );
}
