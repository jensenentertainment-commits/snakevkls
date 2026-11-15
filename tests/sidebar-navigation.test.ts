import assert from "node:assert/strict";
import test from "node:test";
import { isSidebarItemActive, sidebarNavigation } from "../app/components/navigation/sidebar.ts";
import { isNavigationItemActive } from "../app/components/navigation/types.ts";

test("sidebar fails closed until role is known", () => {
  assert.deepEqual(sidebarNavigation(), { main: [], employees: [], admin: [] });
});

test("sidebar retains module roles, hides Lagersalg and exposes only existing employees", () => {
  for (const role of ["admin", "user", "warehouse"] as const) {
    const nav = sidebarNavigation(role);
    assert.deepEqual(nav.main.map(i => i.id), role === "warehouse"
      ? ["dashboard", "lager", "viper"] : ["dashboard", "lager", "viper", "shopify"]);
    assert.deepEqual(nav.employees.map(i => i.id), role === "warehouse" ? ["borre"] : ["borre", "roy"]);
    assert.deepEqual(nav.admin.map(i => i.id), role === "admin" ? ["settings", "labs"] : []);
    assert.equal(nav.main.find(i => i.id === "lager")?.children.length, 6);
    assert.ok(!nav.main.find(i => i.id === "lager")?.children.some(i => i.href === "/fix-locations"));
    assert.equal(nav.main.find(i => i.id === "viper")?.children.length, role === "admin" ? 4 : 1);
  }
});

test("existing product, pick and employee routes retain navigation identity", () => {
  const nav = sidebarNavigation("admin");
  assert.ok(isNavigationItemActive("/products/example", nav.main.find(i => i.id === "lager")!));
  assert.ok(isNavigationItemActive("/viper/picks/example", nav.main.find(i => i.id === "viper")!));
  assert.equal(nav.employees.find(i => i.id === "roy")?.href, "/shopify");
  assert.equal(nav.employees.find(i => i.id === "borre")?.href, "/borre");
  assert.ok(!isNavigationItemActive("/viper-other", nav.main.find(i => i.id === "viper")!));
});

test("hidden sales module cannot leak into sidebar via current module", () => {
  const nav = sidebarNavigation("admin", {id: "warehouse-sales", label: "Lagersalg", items: [{id: "sale", href: "/warehouse-sales", label: "Nytt salg"}]});
  assert.ok(!nav.main.some(i => i.id === "warehouse-sales"));
});

test("nested pick/order pages select queue without selecting it on admin routes", () => {
  const children = sidebarNavigation("admin").main.find(item => item.id === "viper")!.children;
  for (const path of ["/viper", "/viper/orders/example", "/viper/picks/example"]) {
    assert.deepEqual(children.filter(item => isSidebarItemActive(path, item)).map(item => item.id), ["queue"]);
  }
  for (const item of children.slice(1)) {
    assert.deepEqual(children.filter(other => isSidebarItemActive(item.href, other)).map(other => other.id), [item.id]);
  }
  assert.equal(isSidebarItemActive("/viper/picks-other", children[0]), false);
});

test("Lager overview does not steal selection from product/location details", () => {
  const children = sidebarNavigation("admin").main.find(item => item.id === "lager")!.children;
  for (const [path, id] of [["/lager", "overview"], ["/products/example", "products"], ["/locations/HL01", "locations"], ["/location-count", "count"]]) {
    assert.deepEqual(children.filter(item => isSidebarItemActive(path, item)).map(item => item.id), [id]);
  }
});
