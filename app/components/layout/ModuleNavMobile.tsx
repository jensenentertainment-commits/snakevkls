import { ChevronDown } from "lucide-react";

import type { NavigationItem } from "@/app/components/navigation/types";

import { AppNavLinks } from "./AppNavLinks";

export type ModuleNavMobileProps = {
  items: readonly NavigationItem[];
  label: string;
};

export function ModuleNavMobile({ items, label }: ModuleNavMobileProps) {
  return (
    <details className="group relative lg:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-snake-control border border-snake-border-on-dark-default bg-snake-app-elevated px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] text-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark">
        <span>{label}: arbeidsområde</span>
        <ChevronDown
          aria-hidden="true"
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          size={18}
        />
      </summary>
      <div className="absolute left-0 right-0 z-40 mt-2 rounded-snake-card border border-snake-border-on-dark-default bg-snake-app p-3 shadow-snake-panel">
        <AppNavLinks items={items} layout="vertical" />
      </div>
    </details>
  );
}
