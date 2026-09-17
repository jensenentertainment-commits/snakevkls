import assert from "node:assert/strict";
import test from "node:test";
import { mapShopifyVariant, type ShopifyVariantNode, type ShopifyVariantPayload } from "./catalog-sync.ts";
import { parseStoredSyncRun, prepareShopifyPersistencePage, syncWriteResult } from "./sync-persistence.ts";
import { ShopifySyncWriteRejectedError } from "./sync-engine.ts";

function payload(variantId = 1, productId = 1): ShopifyVariantPayload {
  const node: ShopifyVariantNode = {
    id: `gid://shopify/ProductVariant/${variantId}`, sku: null, title: "Default Title", price: "12.34",
    inventoryItem: { id: `gid://shopify/InventoryItem/${variantId}`, tracked: false, inventoryLevel: null },
    product: {
      id: `gid://shopify/Product/${productId}`, updatedAt: "2026-09-16T10:00:00Z", title: "Product",
      status: "ACTIVE", vendor: null, productType: "", description: "", seo: { title: null, description: "" },
      handle: "reassigned-handle", category: null, featuredImage: null,
      collections: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
    },
  };
  return mapShopifyVariant(node, {
    currencyCode: "NOK", locationId: "gid://shopify/Location/1", contentObservedAt: "2026-09-17T10:00:00Z",
    collectionObservation: { state: "complete", observedAt: "2026-09-17T10:01:00Z", collections: [] },
  });
}

test("page normalization deduplicates by product ID, preserves all variants and no-SKU content", () => {
  const variants = [payload(3, 2), payload(1), payload(2)];
  const result = prepareShopifyPersistencePage(variants);
  assert.equal(result.products.length, 2);
  assert.deepEqual(result.products.map((p) => p.productContent.shopifyProductId), ["gid://shopify/Product/1", "gid://shopify/Product/2"]);
  assert.equal(result.variants.length, 3);
  result.variants.forEach((variant, index) => {
    const expected = { ...variants[index] } as Partial<ShopifyVariantPayload>;
    delete expected.productContent;
    delete expected.collectionObservation;
    assert.deepEqual(variant, expected);
  });
  assert.equal(result.products[0].productContent.seoTitle, null);
  assert.equal(result.products[0].productContent.description, "");
  assert.deepEqual(result.products[0].collectionObservation.collections, []);
  assert.equal(result.products[0].collectionObservation.state, "complete");
  assert.deepEqual(prepareShopifyPersistencePage([]), { variants: [], products: [] });
});

test("conflicting, mismatched, or incomplete snapshots fail before any RPC", () => {
  const different = payload(2);
  different.productContent.description = "different observation";
  assert.throws(() => prepareShopifyPersistencePage([payload(), different]), /Conflicting/);
  const mismatched = payload();
  mismatched.productContent.shopifyProductId = "gid://shopify/Product/999";
  assert.throws(() => prepareShopifyPersistencePage([mismatched]), /Invalid/);
  for (const state of ["unknown", "incomplete"]) {
    const input = payload();
    input.collectionObservation = { ...input.collectionObservation, state } as ShopifyVariantPayload["collectionObservation"];
    assert.throws(() => prepareShopifyPersistencePage([input]), ShopifySyncWriteRejectedError);
  }
  const legacy = payload();
  legacy.collections = [{ id: "gid://shopify/Collection/1", title: "Legacy", handle: null }];
  assert.throws(() => prepareShopifyPersistencePage([legacy]), /disagree/);
});

test("SQL rejections are distinct from ambiguous transport and malformed responses", () => {
  for (const code of ["P0001", "23505", "23514", "22007", "40001", "42501"]) {
    assert.throws(() => syncWriteResult(null, { message: "rejected", code }), ShopifySyncWriteRejectedError);
  }
  for (const code of ["", "08006", "57014", "PGRST002"]) {
    assert.throws(() => syncWriteResult(null, { message: "unknown", code }), (error: unknown) =>
      error instanceof Error && !(error instanceof ShopifySyncWriteRejectedError));
  }
  for (const value of [null, [], "OK"]) assert.throws(() => syncWriteResult(value, null), /acknowledgement/);
});

const stored = {
  runId: "run-1", status: "running", pagesProcessed: 2, processedCount: 10, skippedNoSku: 2,
  collectionsLinked: 8, reconciledCount: 0, hasNextPage: false, cursor: "final",
  leaseExpiresAt: "2026-09-17T10:00:00Z", startedAt: "2026-09-17T09:00:00Z", completedAt: null,
};

test("authoritative run parsing preserves final-page state and rejects missing metadata", () => {
  const parsed = parseStoredSyncRun(stored, "run-1");
  assert.equal(parsed.status, "running");
  assert.equal("hasNextPage" in parsed && parsed.hasNextPage, false);
  for (const change of [{ runId: "other" }, { pagesProcessed: -1 }, { hasNextPage: undefined }, { cursor: undefined }, { status: "unknown" }]) {
    assert.throws(() => parseStoredSyncRun({ ...stored, ...change }, "run-1"));
  }
  const complete = { ...stored, status: "completed", completedAt: "2026-09-17T10:00:00Z" };
  assert.equal(parseStoredSyncRun(complete, "run-1").status, "completed");
  assert.throws(() => parseStoredSyncRun({ ...complete, hasNextPage: true }, "run-1"));
  assert.throws(() => parseStoredSyncRun({ ...complete, completedAt: null }, "run-1"));
});
