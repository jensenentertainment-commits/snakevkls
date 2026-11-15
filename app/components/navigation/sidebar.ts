import { PackageSearch, UserRound } from "lucide-react";
import { ADMIN_NAVIGATION_ITEMS, GLOBAL_NAVIGATION_ITEMS, LAGER_MODULE_NAVIGATION, VIPER_MODULE_NAVIGATION } from "./modules.ts";
import { isNavigationItemActive, visibleNavigationItems, type NavigationItem, type ModuleNavigation } from "./types.ts";
import type { Role } from "@/lib/auth/roles";

// Navigation shortcuts only. Page/API authorization remains authoritative.
export const EMPLOYEE_NAVIGATION_ITEMS = [
  { id: "borre", href: "/borre", label: "Børre", icon: PackageSearch, roles: ["admin", "user", "warehouse"] },
  { id: "roy", href: "/shopify", label: "Roy", icon: UserRound, roles: ["admin", "user"] },
] as const satisfies readonly NavigationItem[];

export function isSidebarItemActive(pathname: string, item: NavigationItem) {
  // Detail routes belong to the queue; admin pages must not select it.
  if (item.id === "queue" && item.href === "/viper") {
    return pathname === item.href || ["/viper/orders/", "/viper/picks/"].some(prefix => pathname.startsWith(prefix));
  }
  return isNavigationItemActive(pathname, item);
}

export function sidebarNavigation(role?: Role, currentModule?: ModuleNavigation) {
  if (!role) return { main: [], employees: [], admin: [] };
  const modules: readonly ModuleNavigation[] = [LAGER_MODULE_NAVIGATION, VIPER_MODULE_NAVIGATION];
  return {
    main: visibleNavigationItems(GLOBAL_NAVIGATION_ITEMS, role).map(item => {
      const moduleNav = modules.find(entry => entry.id === item.id) ??
        (currentModule?.id === item.id ? currentModule : undefined);
      const children = moduleNav ? visibleNavigationItems(moduleNav.items, role).map(child => {
        return child.href === item.href ? { ...child, exact: true } : child;
      }) : [];
      return { ...item, children };
    }),
    employees: visibleNavigationItems(EMPLOYEE_NAVIGATION_ITEMS, role),
    admin: visibleNavigationItems(ADMIN_NAVIGATION_ITEMS, role),
  };
}
