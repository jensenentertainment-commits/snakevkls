import {
  ACCOUNT_NAVIGATION_ITEM,
  ADMIN_NAVIGATION_ITEMS,
  GLOBAL_NAVIGATION_ITEMS,
  LAGER_MODULE_NAVIGATION,
  WAREHOUSE_SALES_MODULE_NAVIGATION,
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
const warehouseSalesNavigationItem = GLOBAL_NAVIGATION_ITEMS.find(
  (item) => item.id === "warehouse-sales",
);
const shopifyNavigationItem = GLOBAL_NAVIGATION_ITEMS.find(
  (item) => item.id === "shopify",
);

if (
  !dashboardNavigationItem ||
  !labsNavigationItem ||
  !lagerNavigationItem ||
  !settingsNavigationItem ||
  !warehouseSalesNavigationItem ||
  !shopifyNavigationItem
) {
  throw new Error(
    "Global navigation must define Dashboard, Labs, Lager, Shopify, Lagersalg, and Settings.",
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
    id: "shopify",
    moduleNavigation: undefined,
    navigationItem: shopifyNavigationItem,
    width: "wide",
  },
  {
    id: "warehouse-sales",
    moduleNavigation: WAREHOUSE_SALES_MODULE_NAVIGATION,
    navigationItem: warehouseSalesNavigationItem,
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
  {
    id: "account",
    moduleNavigation: undefined,
    navigationItem: ACCOUNT_NAVIGATION_ITEM,
    width: "wide",
  },
] as const satisfies readonly AppRouteShellConfig[];
