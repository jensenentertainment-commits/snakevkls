import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sourceLines, sourceReasons } from "../lib/viper/shopify/order-source.ts";

const order = {
  id: "gid://shopify/Order/1", sourceName:"web",app:{id:"gid://shopify/App/580111"},legacyResourceId: "1", name: "#1",
  createdAt: "2026-11-03T00:00:00Z", updatedAt: "2026-11-03T00:00:00Z",
  cancelledAt: null, closed: false, fulfillable: true,
  displayFinancialStatus: "PAID", displayFulfillmentStatus: "UNFULFILLED",
  lineItems: { pageInfo: { hasNextPage: false }, nodes: [{
    id: "gid://shopify/LineItem/1", title: "Test", variantTitle: null,
    sku: "old", unfulfilledQuantity: 2, requiresShipping: true,
    variant: { id: "gid://shopify/ProductVariant/1", sku: " SKU-1 " },
  }] },
};

test("V1 accepts eligible source and preserves exact variant identity and outstanding quantity", () => {
  assert.deepEqual(sourceReasons(order), []);
  assert.deepEqual(sourceLines(order), [{ externalLineId: order.lineItems.nodes[0].id,
    shopifyVariantId: "gid://shopify/ProductVariant/1", sku: "SKU-1", productName: "Test",
    variantName: null, requestedQuantity: 2, sequenceNumber: 1 }]);
  const fulfilled = structuredClone(order);
  fulfilled.lineItems.nodes[0].unfulfilledQuantity = 0;
  assert.deepEqual(sourceLines(fulfilled), []);
  assert.equal(sourceReasons(fulfilled)[0].code, "NOTHING_TO_PICK");
});

test("only the verified web and Online Store app pair is eligible", () => {
  for (const origin of [
    { sourceName: "zettle", app: { id: "gid://shopify/App/2627233" } },
    { sourceName: "pos", app: order.app },
    { sourceName: "shopify_draft_order", app: order.app },
    { sourceName: "unknown", app: order.app },
    { sourceName: "web", app: { id: "gid://shopify/App/2627233" } },
    { sourceName: null, app: order.app },
    { sourceName: "web", app: null },
    { sourceName: "web", app: { id: "580111" } },
  ]) {
    assert.equal(sourceReasons({ ...order, ...origin })[0].code, "ORDER_ORIGIN_NOT_ALLOWED");
  }
  const missing = structuredClone(order) as Partial<typeof order>;
  delete missing.sourceName;
  delete missing.app;
  assert.equal(sourceReasons(missing as typeof order)[0].code, "ORDER_ORIGIN_NOT_ALLOWED");
});

test("origin fields are requested and preview/import use the shared eligibility rule", async () => {
  const read = (file: string) => readFile(new URL(file, import.meta.url), "utf8");
  const client = await read("../lib/viper/shopify/order-client.ts");
  assert.match(client, /sourceName\s+app\s*\{\s*id\s*\}/);
  const preview = await read("../lib/viper/shopify/order-preview.ts");
  assert.match(preview, /sourceReasons\(order\)/);
  const materialize = await read("../lib/viper/shopify/order-materialization.ts");
  assert.match(materialize, /await previewFetchedShopifyOrder\(order\)/);
  assert.ok(materialize.indexOf("if (!preview.importable)") < materialize.indexOf(".rpc("));
});

test("V1 fails closed on cancellation, payment, incomplete source and nonphysical items", () => {
  assert.equal(sourceReasons({ ...order, cancelledAt: order.updatedAt })[0].code, "ORDER_CANCELLED");
  assert.equal(sourceReasons({ ...order, displayFinancialStatus: "PENDING" })[0].code, "PAYMENT_NOT_ELIGIBLE");
  const large = structuredClone(order); large.lineItems.pageInfo.hasNextPage = true;
  assert.equal(sourceReasons(large)[0].code, "ORDER_TOO_LARGE");
  const digital = structuredClone(order); digital.lineItems.nodes[0].requiresShipping = false;
  assert.equal(sourceReasons(digital)[0].code, "NON_PHYSICAL_LINE");
});

test("V1 preview/import share database resolver and it has no persistent writes or public execute grant", async () => {
  const sql = await readFile(new URL("../supabase/migrations/20261103215816_viper_shared_location_validation.sql", import.meta.url), "utf8");
  const resolver = sql.split("create or replace function public.materialize_viper_shopify_order")[0];
  assert.match(resolver, /stable security invoker set search_path = ''/);
  assert.doesNotMatch(resolver, /\b(insert into|update public|delete from|for update)\b/i);
  assert.match(resolver, /revoke all .* from public, anon, authenticated/);
  assert.match(resolver, /location\.active and zone\.active/);
  assert.match(resolver, /candidate_location_purpose := 'PICK'/);
  assert.match(resolver, /candidate_location_purpose := 'BUFFER'/);
  assert.match(resolver, /PICK_ORDER_MISSING/);
  assert.equal((sql.match(/prepared_lines := public\.validate_viper_order_lines\(requested_lines\)/g) ?? []).length, 1);
  const preview = await readFile(new URL("../lib/viper/shopify/order-preview.ts", import.meta.url), "utf8");
  assert.match(preview, /rpc\("validate_viper_order_lines"/);
  assert.doesNotMatch(preview, /\.from\("(inventory|locations|products)"\)/);
});
