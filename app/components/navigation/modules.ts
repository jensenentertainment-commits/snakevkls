import {
  Activity,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Wrench,
  PackageCheck,
  ListChecks,
} from "lucide-react";

import type { ModuleNavigation, NavigationItem } from "./types";

export const ACCOUNT_NAVIGATION_ITEM = {
  href: "/account",
  id: "account",
  label: "Konto",
} as const satisfies NavigationItem;

export const GLOBAL_NAVIGATION_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    id: "dashboard",
    label: "Dashboard",
    roles: ["admin", "user", "warehouse", "lager"],
  },
  {
    href: "/lager",
    icon: Boxes,
    id: "lager",
    label: "Lager",
    roles: ["admin", "user", "warehouse", "lager"],
    matchPaths: [
      "/lager",
      "/products",
      "/locations",
      "/fix-locations",
      "/issues",
      "/location-count",
      "/activities",
    ],
  },
  {
    href: "/viper",
    icon: ListChecks,
    id: "viper",
    label: "Viper",
    roles: ["admin", "user", "warehouse", "lager"],
  },
  {
    href: "/warehouse-sales",
    icon: ShoppingBag,
    id: "warehouse-sales",
    label: "Lagersalg",
    roles: ["admin", "user", "lager"],
    matchPaths: ["/warehouse-sales"],
  },
] as const satisfies readonly NavigationItem[];

export const ADMIN_NAVIGATION_ITEMS = [
  {
    href: "/settings",
    icon: Settings,
    id: "settings",
    label: "Innstillinger",
    roles: ["admin"],
    matchPaths: ["/settings", "/zones"],
  },
  {
    href: "/labs",
    icon: FlaskConical,
    id: "labs",
    label: "Labs",
    roles: ["admin"],
  },
] as const satisfies readonly NavigationItem[];

export const LAGER_MODULE_NAVIGATION = {
  id: "lager",
  label: "Lager",
  items: [
    {
      href: "/lager",
      icon: LayoutDashboard,
      id: "overview",
      label: "Oversikt",
    },
    {
      href: "/products",
      icon: PackageSearch,
      id: "products",
      label: "Produkter",
    },
    {
      href: "/locations",
      icon: MapPin,
      id: "locations",
      label: "Lokasjoner",
    },
    {
      href: "/fix-locations",
      icon: Wrench,
      id: "cleanup",
      label: "Ryddemodus",
    },
    {
      href: "/issues",
      icon: ShieldAlert,
      id: "issues",
      label: "Avvik",
    },
    {
      href: "/location-count",
      icon: PackageCheck,
      id: "count",
      label: "Telling",
    },
    {
      href: "/activities",
      icon: Activity,
      id: "activity",
      label: "Aktivitet",
    },
  ],
} as const satisfies ModuleNavigation;

export const WAREHOUSE_SALES_MODULE_NAVIGATION = {
  id: "warehouse-sales",
  label: "Lagersalg",
  items: [
    {
      href: "/warehouse-sales",
      icon: ShoppingBag,
      id: "new-sale",
      label: "Nytt salg",
    },
    {
      href: "/warehouse-sales/history",
      icon: ReceiptText,
      id: "history",
      label: "Historikk",
    },
  ],
} as const satisfies ModuleNavigation;
