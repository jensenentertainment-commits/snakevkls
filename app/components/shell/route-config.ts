import {
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

if (!lagerNavigationItem) {
  throw new Error("Global navigation must define the Lager module.");
}

export const APP_ROUTE_SHELLS = [
  {
    id: "lager",
    moduleNavigation: LAGER_MODULE_NAVIGATION,
    navigationItem: lagerNavigationItem,
    width: "wide",
  },
] as const satisfies readonly AppRouteShellConfig[];
