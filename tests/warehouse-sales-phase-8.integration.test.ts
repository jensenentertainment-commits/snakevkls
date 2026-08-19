import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("phase 8 exposes authenticated search, quote, completion and history routes", () => {
  for (const file of [
    "app/api/warehouse-sales/products/route.ts",
    "app/api/warehouse-sales/quote/route.ts",
    "app/api/warehouse-sales/complete/route.ts",
    "app/api/warehouse-sales/history/route.ts",
    "app/api/warehouse-sales/history/[id]/route.ts",
  ]) {
    const source = read(file);
    assert.match(source, /requireRole\(\["admin", "user"\]\)/);
    assert.match(source, /private, no-store|completeWarehouseSale/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  }
});

test("server quote owns stock, price override and availability decisions", () => {
  const repository = read("lib/warehouse-sales/repository.ts");
  assert.match(repository, /shopify_price_minor/);
  assert.match(repository, /shopify_inventory_location_id/);
  assert.match(repository, /sumPhysicalInventory/);
  assert.match(repository, /priceOverridden/);
  assert.match(repository, /lineTotalMinor/);
  assert.match(repository, /canComplete/);
  assert.match(repository, /Ikke koblet til riktig lager/);
  assert.match(repository, /Ikke på lager/);
});

test("completion requotes before delegating to the atomic RPC contract", () => {
  const route = read("app/api/warehouse-sales/complete/route.ts");
  assert.match(route, /quoteWarehouseSale/);
  assert.match(route, /if \(!quote\.canComplete\)/);
  assert.match(route, /completeWarehouseSale/);
  assert.match(route, /getWarehouseSale/);
});

test("client operation identity survives unknown result and blocks parallel completion", () => {
  const provider = read(
    "app/components/warehouse-sales/WarehouseSalesProvider.tsx",
  );
  assert.match(provider, /operationKeyRef\.current \?\?= crypto\.randomUUID\(\)/);
  assert.match(provider, /completionPromiseRef\.current/);
  assert.match(provider, /error\.kind !== "unknown"/);
  assert.match(provider, /idempotencyKey: operationKey/);
});

test("fixtures and in-memory sales are removed from the runtime adapter", () => {
  assert.throws(() =>
    read("lib/warehouse-sales/ui-adapter/fixtures.ts"),
  );
  assert.throws(() =>
    read("lib/warehouse-sales/ui-adapter/safe-adapter.ts"),
  );
  const adapter = read("lib/warehouse-sales/ui-adapter/api-adapter.ts");
  assert.match(adapter, /\/api\/warehouse-sales\/products/);
  assert.match(adapter, /\/api\/warehouse-sales\/quote/);
  assert.match(adapter, /\/api\/warehouse-sales\/complete/);
});

test("history and voucher remain read-only server data", () => {
  const history = read("app/api/warehouse-sales/history/route.ts");
  const document = read("app/api/warehouse-sales/history/[id]/route.ts");
  assert.match(history, /export async function GET/);
  assert.match(document, /export async function GET/);
  assert.doesNotMatch(`${history}\n${document}`, /POST|PATCH|PUT|DELETE/);
});

test("Shopify OAuth requests the location scope required for safe mapping", () => {
  const install = read("app/api/shopify/install/route.ts");
  assert.match(install, /read_locations/);
  assert.match(install, /write_inventory/);
});
