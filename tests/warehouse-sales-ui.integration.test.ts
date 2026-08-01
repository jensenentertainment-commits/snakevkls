import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("phase 8 UI uses only the authenticated API adapter", () => {
  const files = [
    "app/components/warehouse-sales/WarehouseSalesProvider.tsx",
    "app/components/warehouse-sales/ProductSearch.tsx",
    "app/components/warehouse-sales/SaleHistory.tsx",
    "app/components/warehouse-sales/SaleDocument.tsx",
  ];
  const source = files.map(read).join("\n");

  assert.match(source, /warehouseSalesApiAdapter/);
  assert.doesNotMatch(
    source,
    /createClient|supabase|complete_warehouse_sale|inventoryAdjustQuantities/,
  );
});

test("completion clearly requires a separate Vipps check", () => {
  const cart = read("app/components/warehouse-sales/SaleCart.tsx");
  assert.match(cart, /Kontroller Vipps-betalingen/);
  assert.match(cart, /Snake registrerer ikke selve betalingen/);
  assert.match(cart, /Betaling kontrollert – fullfør/);
});

test("workspace exposes mobile cart dialog and desktop simultaneous layout", () => {
  const workspace = read(
    "app/components/warehouse-sales/WarehouseSaleWorkspace.tsx",
  );
  assert.match(workspace, /lg:grid-cols/);
  assert.match(workspace, /lg:block/);
  assert.match(workspace, /aria-modal="true"/);
  assert.match(workspace, /aria-expanded=\{cartOpen\}/);
});

test("interactive controls have accessible names and usable touch sizes", () => {
  const search = read("app/components/warehouse-sales/ProductSearch.tsx");
  const cart = read("app/components/warehouse-sales/SaleCart.tsx");
  const workspace = read(
    "app/components/warehouse-sales/WarehouseSaleWorkspace.tsx",
  );

  assert.match(search, /aria-label=\{`Legg til/);
  assert.match(cart, /aria-label=\{`Reduser antall/);
  assert.match(cart, /aria-label=\{`Øk antall/);
  assert.match(workspace, /aria-label="Lukk handlekurv"/);
  assert.doesNotMatch(`${search}\n${cart}\n${workspace}`, /h-(?:8|9|10)\b/);
});

test("internal document is explicitly not a customer receipt", () => {
  const document = read("app/components/warehouse-sales/SaleDocument.tsx");
  assert.match(document, /Internt salgsbilag/);
  assert.match(document, /ikke en\s+kundekvittering/);
  assert.match(document, /Betalingsmåte: Vipps/);
});
