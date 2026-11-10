import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { executeStockRead, readStockData, type ReadPage } from "./stock-reader.ts";
import { locationStock, productStock, resolveProduct, type StockData } from "./stock-contract.ts";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture(): StockData {
  return {
    products: [{ id: id(1), product_name: "Testvare", variant_name: null, sku: null, active: true,
      shopify_variant_id: "gid://shopify/ProductVariant/123", shopify_quantity: 20,
      shopify_inventory_tracked: true, shopify_inventory_location_id: "gid://shopify/Location/1",
      shopify_inventory_observed_at: "2026-11-08T22:00:00Z" }],
    zones: [{ id: id(2), code: "HL", name: "Hovedlager", active: true }],
    locations: [{ id: id(3), code: "HL01-01-A", zone_id: id(2), active: true, location_purpose: "PICK" },
      { id: id(4), code: "HL01-02-A", zone_id: id(2), active: true, location_purpose: "BUFFER" }],
    inventory: [{ id: id(5), product_id: id(1), location_id: id(3), zone_id: id(2), quantity: 3 },
      { id: id(6), product_id: id(1), location_id: id(4), zone_id: id(2), quantity: 5 }],
  };
}
const reader = (data: StockData, cap = 500): ReadPage => async (table, _cols, from, to) => ({
  data: data[table].slice(from, Math.min(to + 1, from + cap)), count: data[table].length, error: null,
});

test("sums all locations, retains PICK/BUFFER, SKU is optional; no mutation", () => {
  const data = fixture(); const before = structuredClone(data);
  const result = productStock(data, id(1));
  assert.equal(result.registeredQuantity, 8);
  assert.deepEqual(result.placements.map(p => p.purpose), ["PICK", "BUFFER"]);
  assert.equal(result.sku, null);
  assert.equal(result.difference.snakeMinusShopify, -12);
  assert.equal(result.difference.confirmedStockError, false);
  assert.equal(result.difference.scopeEquivalence, "unverified");
  assert.equal(result.physicalRegistration, "incomplete_or_unknown");
  assert.deepEqual(data, before);
});
test("zero unplaced rows and empty locations are not findings", () => {
  const data = fixture(); data.inventory = [{ ...data.inventory[0], location_id: null, zone_id: null, quantity: 0 }];
  assert.deepEqual(productStock(data, id(1)).positiveInvalidPlacements, []);
  const location = locationStock(data, id(3));
  assert.equal(location.status, "found");
  if (location.status === "found") { assert.equal(location.hasPositiveStock, false); assert.deepEqual(location.entries, []); }
});
test("unplaced and inactive positive stock remain in total and get separate reasons", () => {
  const data = fixture(); data.inventory[0].location_id = null; data.locations[1].active = false;
  const result = productStock(data, id(1));
  assert.equal(result.registeredQuantity, 8);
  assert.deepEqual(result.positiveInvalidPlacements.map(p => p.placementIssue), ["unplaced", "location_inactive"]);
});
test("invalid zones and missing location references are explicit", () => {
  const data = fixture(); data.locations[0].zone_id = null; data.inventory[1].location_id = id(99);
  assert.deepEqual(productStock(data, id(1)).positiveInvalidPlacements.map(p => p.placementIssue), ["zone_unknown", "location_unknown"]);
});
test("exact UUID and numeric/GID variant resolve without SKU fallback", () => {
  const data = fixture();
  for (const key of [{ kind: "productUuid", value: id(1) }, { kind: "variantId", value: "123" },
    { kind: "variantId", value: "gid://shopify/ProductVariant/123" }] as const) {
    assert.equal(resolveProduct(data, key).status, "resolved");
  }
  assert.equal(resolveProduct(data, { kind: "variantId", value: "999" }).status, "not_found");
  assert.throws(() => resolveProduct(data, { kind: "productUuid", value: "Testvare" }), /INVALID/);
});
test("ambiguous names and duplicate variant identities never select arbitrarily", () => {
  const data = fixture(); data.products.push({ ...data.products[0], id: id(9), variant_name: "Stor" });
  assert.equal(resolveProduct(data, { kind: "name", value: "testvare" }).status, "ambiguous");
  assert.equal(resolveProduct(data, { kind: "variantId", value: "123" }).status, "ambiguous");
});
test("duplicate SKU never merges stock or substitutes a variant identity", () => {
  const data = fixture(); data.products[0].sku = "DUP";
  data.products.push({ ...data.products[0], id: id(9), shopify_variant_id: "gid://shopify/ProductVariant/456" });
  assert.equal(resolveProduct(data, { kind: "variantId", value: "456" }).candidates[0].productUuid, id(9));
  assert.equal(productStock(data, id(9)).registeredQuantity, 0);
  assert.equal(productStock(data, id(1)).registeredQuantity, 8);
});
test("inactive zones and conflicting zone references are not valid placements", () => {
  const data = fixture(); data.zones[0].active = false;
  assert.equal(productStock(data, id(1)).positiveInvalidPlacements[0].placementIssue, "zone_inactive");
  data.zones[0].active = true; data.inventory[0].zone_id = null;
  assert.equal(productStock(data, id(1)).positiveInvalidPlacements[0].placementIssue, "zone_mismatch");
});
test("unknown observations never become zero; observed zero remains zero", () => {
  for (const field of ["shopify_quantity", "shopify_inventory_observed_at", "shopify_inventory_location_id", "shopify_inventory_tracked"] as const) {
    const data = fixture(); data.products[0][field] = null;
    assert.equal(productStock(data, id(1)).difference.snakeMinusShopify, null);
    assert.equal(productStock(data, id(1)).shopify.state, "unknown");
  }
  const data = fixture(); data.products[0].shopify_quantity = 0;
  assert.equal(productStock(data, id(1)).difference.snakeMinusShopify, 8);
  data.products[0].shopify_inventory_observed_at = "invalid";
  assert.equal(productStock(data, id(1)).shopify.state, "unknown");
});
test("invalid quantities cannot manufacture totals", () => {
  const data = fixture(); data.inventory[0].quantity = -1;
  assert.equal(productStock(data, id(1)).registeredQuantity, null);
  assert.equal(productStock(data, id(1)).difference.snakeMinusShopify, null);
});
test("location lookup retains product identity and zero rows", () => {
  const data = fixture(); data.inventory[0].quantity = 0;
  const result = locationStock(data, id(3));
  if (result.status !== "found") assert.fail();
  assert.equal(result.entries[0].product?.id, id(1));
  assert.equal(result.entries[0].quantity, 0);
  assert.equal(result.zone?.code, "HL");
});
test("reads past server page limits with explicit total counts", async () => {
  const data = fixture(); data.inventory = Array.from({ length: 1201 }, (_, i) => ({ ...data.inventory[0], id: id(i + 20), quantity: 1 }));
  const loaded = await readStockData(reader(data, 100));
  assert.equal(productStock(loaded, id(1)).registeredQuantity, 1201);
});
test("query errors, count changes, truncation, duplicate pages and malformed data fail closed", async () => {
  for (const page of [
    { data: [], count: null, error: null }, { data: [], count: 1, error: null },
    { data: [], count: 0, error: { message: "private details" } },
    { data: [{ id: "x" }], count: 1, error: null },
  ]) await assert.rejects(readStockData(async () => page), /BORRE_READ_/);
  let calls = 0;
  await assert.rejects(readStockData(async () => ({ data: [fixture().products[0]], count: ++calls === 1 ? 2 : 3, error: null })), /INCOMPLETE/);
  await assert.rejects(readStockData(async () => ({ data: [fixture().products[0]], count: 2, error: null })), /CHANGED/);
});
test("missing product references are incomplete, not invisible stock", async () => {
  const data = fixture(); data.products = [];
  await assert.rejects(readStockData(reader(data)), /INCOMPLETE/);
});
test("anonymous, inactive, missing and unknown roles are denied before any data read", async () => {
  for (const identity of [{ authenticated: false, profile: { role: "admin", active: true } },
    { authenticated: true, profile: null }, { authenticated: true, profile: { role: "admin", active: false } },
    { authenticated: true, profile: { role: "external", active: true } }]) {
    let reads = 0;
    await assert.rejects(executeStockRead(identity, async () => { reads++; throw new Error(); }, { kind: "invalidPlacements" }), /FORBIDDEN/);
    assert.equal(reads, 0);
  }
});
test("all existing Børre roles can read, ambiguous results have no selected stock", async () => {
  for (const role of ["admin", "user", "warehouse"]) {
    const data = fixture(); data.products.push({ ...data.products[0], id: id(9) });
    const result = await executeStockRead({ authenticated: true, profile: { role, active: true } }, reader(data), { kind: "product", key: { kind: "name", value: "Testvare" } });
    assert.equal(result.metadata.consistency, "non_atomic_read_window");
    assert.ok("stock" in result.result && result.result.stock === null);
  }
});
test("server boundary preserves session auth/RLS and exposes no write or public action", () => {
  const source = readFileSync(new URL("./stock-server.ts", import.meta.url), "utf8");
  assert.match(source, /import "server-only"/);
  assert.match(source, /requireRole\(\["admin", "user", "warehouse"\]\)/);
  assert.match(source, /auth\.authClient\.from/);
  assert.doesNotMatch(source, /service_role|\.rpc\(|\.insert\(|\.update\(|\.delete\(|use server/);
});
