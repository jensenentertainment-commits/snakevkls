import {
  ADMIN_NAVIGATION_ITEMS,
  GLOBAL_NAVIGATION_ITEMS,
  LAGER_MODULE_NAVIGATION,
  type ModuleNavigation,
  type NavigationItem,
} from "@/app/components/navigation";

export type AppRouteShellConfig = {
  id: string;
  moduleNavigation?: ModuleNavigation;
  navigationItem: NavigationItem;
  width: "default" | "wide";
};

const lagerNavigationItem = GLOBAL_NAVIGATION_ITEMS.find(
  (item) => item.id === "lager",
);
const dashboardNavigationItem = GLOBAL_NAVIGATION_ITEMS.find(
  (item) => item.id === "dashboard",
);
const settingsNavigationItem = ADMIN_NAVIGATION_ITEMS.find(
  (item) => item.id === "settings",
);
const labsNavigationItem = ADMIN_NAVIGATION_ITEMS.find(
  (item) => item.id === "labs",
);

if (
  !dashboardNavigationItem ||
  !labsNavigationItem ||
  !lagerNavigationItem ||
  !settingsNavigationItem
) {
  throw new Error(
    "Global navigation must define Dashboard, Labs, Lager, and Settings.",
  );
}

export const APP_ROUTE_SHELLS = [
  {
    id: "dashboard",
    moduleNavigation: undefined,
    navigationItem: dashboardNavigationItem,
    width: "wide",
  },
  {
    id: "lager",
    moduleNavigation: LAGER_MODULE_NAVIGATION,
    navigationItem: lagerNavigationItem,
    width: "wide",
  },
  {
    id: "settings",
    moduleNavigation: undefined,
    navigationItem: settingsNavigationItem,
    width: "wide",
  },
  {
    id: "labs",
    moduleNavigation: undefined,
    navigationItem: labsNavigationItem,
    width: "wide",
  },
] as const satisfies readonly AppRouteShellConfig[];
