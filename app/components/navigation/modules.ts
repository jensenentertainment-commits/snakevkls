import {
  Activity,
  Boxes,
  ClipboardCheck,
  FlaskConical,
  LayoutDashboard,
  MapPin,
  PackageSearch,
  Settings,
  ShieldAlert,
  Wrench,
} from "lucide-react";

import type { ModuleNavigation, NavigationItem } from "./types";

export const GLOBAL_NAVIGATION_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    id: "dashboard",
    label: "Dashboard",
  },
  {
    href: "/lager",
    icon: Boxes,
    id: "lager",
    label: "Lager",
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
    icon: Boxes,
    id: "viper",
    label: "Viper",
  },
] as const satisfies readonly NavigationItem[];

export const ADMIN_NAVIGATION_ITEMS = [
  {
    href: "/settings",
    icon: Settings,
    id: "settings",
    label: "Innstillinger",
  },
  {
    href: "/labs",
    icon: FlaskConical,
    id: "labs",
    label: "Labs",
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
      icon: ClipboardCheck,
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
