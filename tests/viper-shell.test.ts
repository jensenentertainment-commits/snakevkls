import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { VIPER_MODULE_NAVIGATION, LAGER_MODULE_NAVIGATION, WAREHOUSE_SALES_MODULE_NAVIGATION, GLOBAL_NAVIGATION_ITEMS } from "../app/components/navigation/modules.ts";
import { isNavigationItemActive, visibleNavigationItems } from "../app/components/navigation/types.ts";

test("Viper navigation hides admin tasks until an administrator is known", () => {
  const items = VIPER_MODULE_NAVIGATION.items;
  assert.deepEqual(visibleNavigationItems(items, "admin").map(i => i.href), ["/viper", "/viper/admin/order-intake", "/viper/admin/exceptions", "/viper/admin/recovery"]);
  for (const role of [undefined, "user", "warehouse"] as const) {
    assert.deepEqual(visibleNavigationItems(items, role).map(i => i.href), ["/viper"]);
  }
  for (const navigation of [LAGER_MODULE_NAVIGATION, WAREHOUSE_SALES_MODULE_NAVIGATION]) {
    assert.deepEqual(visibleNavigationItems(navigation.items, "user"), navigation.items);
  }
});

test("Viper global navigation covers nested routes without duplicate module selection", () => {
  const global = GLOBAL_NAVIGATION_ITEMS.find(i => i.id === "viper")!;
  for (const path of ["/viper", "/viper/orders/example", "/viper/picks/example", ...VIPER_MODULE_NAVIGATION.items.slice(1).map(i => i.href)]) {
    assert.equal(isNavigationItemActive(path, global), true);
  }
  assert.equal(isNavigationItemActive("/viper-other", global), false);
  for (const item of VIPER_MODULE_NAVIGATION.items) {
    assert.deepEqual(VIPER_MODULE_NAVIGATION.items.filter(i => isNavigationItemActive(item.href, i)).map(i => i.id), [item.id]);
  }
});

test("Viper pages use the shared main landmark and retain server authorization", () => {
  for (const page of ["page.tsx", "orders/[id]/page.tsx", "picks/[id]/page.tsx", "admin/order-intake/page.tsx", "admin/exceptions/page.tsx", "admin/recovery/page.tsx"]) {
    const source = readFileSync(`app/viper/${page}`, "utf8");
    assert.doesNotMatch(source, /SnakeNav|<main\b|min-h-screen/);
    assert.match(source, page.startsWith("admin/") ? /await requireViperAdminPageActor\(\)/ : /await requireViperPageActor\(\)/);
  }
  const shell = readFileSync("app/components/shell/AuthenticatedAppShell.tsx", "utf8");
  assert.match(shell, /visibleNavigationItems\(moduleNavigation.items, profile\?\.role\)/);
  const moduleNav = readFileSync("app/components/layout/ModuleNav.tsx", "utf8");
  assert.match(moduleNav, /ModuleNavMobile/);
  assert.match(moduleNav, /AppNavLinks/);
});

test("global desktop and mobile navigation hide Lagersalg for every role", () => {
  for (const role of ["admin", "user", "warehouse"] as const) {
    assert.deepEqual(visibleNavigationItems(GLOBAL_NAVIGATION_ITEMS, role).map(i => i.id),
      role === "warehouse" ? ["dashboard", "lager", "viper"] : ["dashboard", "lager", "viper", "shopify"]);
  }
  assert.deepEqual(visibleNavigationItems(GLOBAL_NAVIGATION_ITEMS, undefined), []);
  const navbar = readFileSync("app/components/layout/AppNavbar.tsx", "utf8");
  assert.match(navbar, /<AppNavLinks items=\{visibleItems\}/);
  assert.match(navbar, /<MobileNav[\s\S]*?items=\{visibleItems\}/);
  assert.match(readFileSync("app/warehouse-sales/layout.tsx", "utf8"), /requireRole\(\["admin", "user"\]\)/);
});
