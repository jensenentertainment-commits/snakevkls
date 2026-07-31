import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeShopifyOrderId } from "../lib/viper/shopify/order-id.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("P4.1 normalizes only numeric Shopify order identifiers", () => {
  assert.equal(
    normalizeShopifyOrderId("1234567890"),
    "gid://shopify/Order/1234567890"
  );
  assert.equal(
    normalizeShopifyOrderId("gid://shopify/Order/1234567890"),
    "gid://shopify/Order/1234567890"
  );
  assert.equal(normalizeShopifyOrderId("#1001"), null);
  assert.equal(normalizeShopifyOrderId("gid://shopify/Product/123"), null);
});

test("P4.1 requires read_orders while shared OAuth includes Lagersalg inventory scope", async () => {
  const install = await source("app/api/shopify/install/route.ts");
  const client = await source("lib/viper/shopify/order-client.ts");

  for (const scope of [
    "read_products",
    "read_inventory",
    "write_inventory",
    "read_locations",
    "read_orders",
  ]) {
    assert.match(install, new RegExp(scope));
  }
  assert.match(install, /requireViperAdminApiActor\(\)/);
  assert.match(client, /scopes\.includes\("read_orders"\)/);
  assert.doesNotMatch(
    client,
    /write_(orders|inventory|fulfillments|products)/
  );
});

test("P4.1 preview API is admin-only, no-store and exposes no database writes", async () => {
  const route = await source("app/api/viper/shopify/orders/preview/route.ts");
  const preview = await source("lib/viper/shopify/order-preview.ts");

  assert.match(route, /requireViperAdminApiActor\(\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /normalizeShopifyOrderId/);
  assert.doesNotMatch(`${route}\n${preview}`, /\.(insert|upsert|update|delete)\(/);
  assert.doesNotMatch(
    `${route}\n${preview}`,
    /orders\)\s*\.(insert|upsert)|order_lines\)\s*\.(insert|upsert)/
  );
});

test("P4.1 matches exact variant IDs and provides closed rejection codes", async () => {
  const preview = await source("lib/viper/shopify/order-preview.ts");
  const types = await source("lib/viper/shopify/preview-types.ts");

  assert.match(preview, /\.in\("shopify_variant_id", variantIds\)/);
  assert.match(preview, /SKU_MISMATCH/);
  assert.doesNotMatch(preview, /sku.*fallback|fallback.*sku/i);

  for (const code of [
    "ORDER_CANCELLED",
    "PAYMENT_NOT_ELIGIBLE",
    "VARIANT_MISSING",
    "PRODUCT_NOT_FOUND",
    "INVENTORY_MISSING",
    "LOCATION_MISSING",
    "INSUFFICIENT_PHYSICAL_STOCK",
    "PICK_LOCATION_AMBIGUOUS",
  ]) {
    assert.match(types, new RegExp(`"${code}"`));
  }
});

test("P4.1 Shopify query excludes customer and payment details", async () => {
  const client = await source("lib/viper/shopify/order-client.ts");

  assert.match(client, /lineItems\(first: 100\)/);
  assert.match(client, /updatedAt/);
  assert.match(client, /unfulfilledQuantity/);
  assert.match(client, /requiresShipping/);
  assert.doesNotMatch(client, /\bcustomer\b|\bemail\b|\bphone\b|shippingAddress/);
});
