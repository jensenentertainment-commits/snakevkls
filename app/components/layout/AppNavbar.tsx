import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ADMIN_NAVIGATION_ITEMS,
  GLOBAL_NAVIGATION_ITEMS,
} from "@/app/components/navigation/modules";
import type { NavigationItem } from "@/app/components/navigation/types";
import type { Role } from "@/lib/auth/roles";

import { AppClock } from "./AppClock";
import { AppNavLinks } from "./AppNavLinks";
import { AppUserMenu } from "./AppUserMenu";
import { MobileNav } from "./MobileNav";

export type AppNavbarUser = {
  displayName: string;
  roleLabel?: string;
};

export type AppNavbarProps = {
  adminItems?: readonly NavigationItem[];
  homeHref?: string;
  isAdmin?: boolean;
  items?: readonly NavigationItem[];
  logoutSlot?: ReactNode;
  role?: Role;
  user: AppNavbarUser;
};

export function AppNavbar({
  adminItems = ADMIN_NAVIGATION_ITEMS,
  homeHref = "/dashboard",
  isAdmin = false,
  items = GLOBAL_NAVIGATION_ITEMS,
  logoutSlot,
  role,
  user,
}: AppNavbarProps) {
  const visibleItems = role
    ? items.filter((item) => !item.roles || item.roles.includes(role))
    : [];
  const visibleAdminItems = isAdmin
    ? adminItems.filter(
        (item) => !item.roles || Boolean(role && item.roles.includes(role)),
      )
    : [];

  return (
    <header className="border-b border-snake-border-on-dark-subtle bg-snake-app-deep text-snake-text-on-dark print:hidden">
      <div className="mx-auto flex min-h-20 max-w-[var(--snake-shell-wide-max-width)] items-center gap-4 px-[var(--snake-page-gutter-mobile)] sm:px-[var(--snake-page-gutter-tablet)] lg:px-[var(--snake-page-gutter-desktop)]">
        <Link
          aria-label="Snake OS – dashboard"
          className="flex shrink-0 items-center gap-3 rounded-snake-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snake-focus-on-dark"
          href={homeHref}
        >
          <Image
            alt=""
            className="h-11 w-11 rounded-snake-pill border border-snake-border-on-dark-default object-contain p-1"
            height={44}
            priority
            src="/vk_logo2.png"
            width={44}
          />
          <span className="hidden text-[length:var(--snake-text-label-size)] font-[var(--snake-font-weight-semibold)] uppercase leading-[var(--snake-text-label-line-height)] tracking-[var(--snake-text-eyebrow-tracking)] sm:block">
            Snake OS
          </span>
        </Link>

        <nav aria-label="Systemnavigasjon" className="hidden lg:block">
          <AppNavLinks items={visibleItems} />
        </nav>

        <div className="ml-auto hidden xl:block text-[length:var(--snake-text-meta-size)] leading-[var(--snake-text-meta-line-height)]">
          <AppClock />
        </div>
        <div className="hidden lg:block">
          <AppUserMenu
            adminItems={visibleAdminItems}
            displayName={user.displayName}
            logoutSlot={logoutSlot}
            roleLabel={user.roleLabel}
          />
        </div>
        <MobileNav
          adminItems={visibleAdminItems}
          displayName={user.displayName}
          items={visibleItems}
          logoutSlot={logoutSlot}
          roleLabel={user.roleLabel}
        />
      </div>
    </header>
  );
}
