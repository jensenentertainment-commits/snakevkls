"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

import type { NavigationItem } from "@/app/components/navigation/types";

import { AppNavLinks } from "./AppNavLinks";
import { AppClock } from "./AppClock";

export type MobileNavProps = {
  accountHref?: string;
  adminItems?: readonly NavigationItem[];
  displayName: string;
  items: readonly NavigationItem[];
  logoutSlot?: ReactNode;
  roleLabel?: string;
};

export function MobileNav({
  accountHref = "/account",
  adminItems = [],
  displayName,
  items,
  logoutSlot,
  roleLabel,
}: MobileNavProps) {
  const pathname = usePathname();

  return (
    <details className="group relative ml-auto lg:hidden" key={pathname}>
      <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-snake-control border border-snake-border-on-dark-default bg-snake-app-elevated text-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark">
        <span className="sr-only">Åpne systemnavigasjon</span>
        <Menu aria-hidden="true" className="group-open:hidden" size={20} />
        <X aria-hidden="true" className="hidden group-open:block" size={20} />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-snake-card border border-snake-border-on-dark-default bg-snake-app p-3 shadow-snake-overlay">
        <div className="border-b border-snake-border-on-dark-subtle px-3 pb-3">
          <p className="font-[var(--snake-font-weight-semibold)] text-snake-text-on-dark">
            {displayName}
          </p>
          {roleLabel ? (
            <p className="text-[length:var(--snake-text-meta-size)] leading-[var(--snake-text-meta-line-height)] text-snake-text-on-dark-muted">
              {roleLabel}
            </p>
          ) : null}
          <div className="mt-2 text-[length:var(--snake-text-meta-size)] leading-[var(--snake-text-meta-line-height)]">
            <AppClock />
          </div>
        </div>
        <nav aria-label="Systemnavigasjon">
          <AppNavLinks items={items} layout="vertical" />
        </nav>
        {adminItems.length > 0 ? (
          <nav
            aria-label="Administrasjon"
            className="mt-3 border-t border-snake-border-on-dark-subtle pt-3"
          >
            <p className="px-3 pb-2 text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-on-dark-muted">
              Administrasjon
            </p>
            <AppNavLinks items={adminItems} layout="vertical" />
          </nav>
        ) : null}
        <div className="mt-3 border-t border-snake-border-on-dark-subtle pt-3">
          <Link
            className="flex min-h-11 items-center rounded-snake-control px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] text-snake-text-on-dark-muted hover:bg-snake-app-elevated hover:text-snake-text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark"
            href={accountHref}
          >
            Konto
          </Link>
          {logoutSlot}
        </div>
      </div>
    </details>
  );
}
