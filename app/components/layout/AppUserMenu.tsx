import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown, UserRound } from "lucide-react";

import type { NavigationItem } from "@/app/components/navigation/types";

export type AppUserMenuProps = {
  accountHref?: string;
  adminItems?: readonly NavigationItem[];
  displayName: string;
  logoutSlot?: ReactNode;
  roleLabel?: string;
};

export function AppUserMenu({
  accountHref = "/account",
  adminItems = [],
  displayName,
  logoutSlot,
  roleLabel,
}: AppUserMenuProps) {
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <details className="group relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-snake-control border border-snake-border-on-dark-default bg-snake-app-elevated px-3 text-snake-text-on-dark transition-colors hover:border-snake-border-on-dark-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark motion-reduce:transition-none">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-snake-pill bg-snake-primary text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-semibold)]"
        >
          {initials || <UserRound size={16} />}
        </span>
        <span className="hidden text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-semibold)] lg:inline">
          {displayName}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
          size={16}
        />
      </summary>

      <div className="absolute right-0 z-50 mt-2 w-64 rounded-snake-card border border-snake-border-default bg-snake-surface p-2 text-snake-text-primary shadow-snake-overlay">
        <div className="border-b border-snake-border-subtle px-3 py-3">
          <p className="font-[var(--snake-font-weight-semibold)]">
            {displayName}
          </p>
          {roleLabel ? (
            <p className="text-[length:var(--snake-text-meta-size)] leading-[var(--snake-text-meta-line-height)] text-snake-text-muted">
              {roleLabel}
            </p>
          ) : null}
        </div>
        <Link
          className="mt-1 flex min-h-11 items-center rounded-snake-control px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-medium)] text-snake-link hover:bg-snake-info-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
          href={accountHref}
        >
          Konto
        </Link>
        {adminItems.length > 0 ? (
          <div className="mt-1 border-t border-snake-border-subtle pt-1">
            <p className="px-3 py-2 text-[length:var(--snake-text-eyebrow-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-eyebrow-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] text-snake-text-muted">
              Administrasjon
            </p>
            {adminItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex min-h-11 items-center gap-2 rounded-snake-control px-3 text-[length:var(--snake-text-body-small-size)] font-[var(--snake-font-weight-medium)] text-snake-link hover:bg-snake-info-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus"
                  href={item.href}
                  key={item.id}
                >
                  {Icon ? <Icon aria-hidden="true" size={16} /> : null}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ) : null}
        {logoutSlot ? (
          <div className="mt-1 border-t border-snake-border-subtle pt-1">
            {logoutSlot}
          </div>
        ) : null}
      </div>
    </details>
  );
}
