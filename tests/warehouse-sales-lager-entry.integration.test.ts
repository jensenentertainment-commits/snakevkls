import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const lager = readFileSync(join(process.cwd(), "app/lager/page.tsx"), "utf8");

test("Lager exposes Viper and Lagersalg as active operational workspaces", () => {
  const viper = lager.match(
    /\{\s*href: "\/viper",[\s\S]+?title: "Viper",[\s\S]+?\},/,
  );
  const warehouseSales = lager.match(
    /\{\s*href: "\/warehouse-sales",[\s\S]+?title: "Lagersalg",[\s\S]+?\},/,
  );

  assert.ok(viper);
  assert.match(viper[0], /Plukk, pakk og fullfør ordre/);
  assert.match(viper[0], /label: "Operativ"/);
  assert.doesNotMatch(viper[0], /muted: true/);

  assert.ok(warehouseSales);
  assert.match(warehouseSales[0], /Fysiske lagersalg fra lageret/);
  assert.match(warehouseSales[0], /label: "Operativ"/);
  assert.doesNotMatch(warehouseSales[0], /muted: true/);
});

test("the obsolete Plukk card is removed", () => {
  assert.doesNotMatch(lager, /title: "Plukk"/);
  assert.doesNotMatch(lager, /Plukkflyt kommer senere/);
});
