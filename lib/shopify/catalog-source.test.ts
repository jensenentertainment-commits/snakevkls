import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogRequest, fetchShopifyCatalogPage, type CatalogRequest } from "./catalog-source.ts";
import { SHOPIFY_CATALOG_QUERY, mapShopifyVariant, type ShopifyVariantNode, type ShopifyVariantPayload } from "./catalog-sync.ts";
import { CollectionPaginationError, SHOPIFY_COLLECTIONS_QUERY } from "./collection-pagination.ts";
import { runPagedShopifySync, type ShopifySyncWorker } from "./sync-engine.ts";

const locationId = "gid://shopify/Location/5";
const collection = (id: number) => ({ id: `gid://shopify/Collection/${id}`, title: `Collection ${id}`, handle: `collection-${id}` });
const connection = (ids: number[], hasNextPage = false) => ({
  edges: ids.map((id) => ({ node: collection(id) })),
  pageInfo: { hasNextPage, endCursor: ids.length ? `collection-${ids.at(-1)}` : null },
});

function variant(id = 1, productId = 1, collections = connection([])): ShopifyVariantNode {
  return {
    id: `gid://shopify/ProductVariant/${id}`, sku: ` SKU-${id} `, title: "Default Title", price: "199.90",
    inventoryItem: {
      id: `gid://shopify/InventoryItem/${id}`, tracked: true,
      inventoryLevel: { id: `gid://shopify/InventoryLevel/${id}`, quantities: [{ name: "available", quantity: 7 }] },
    },
    product: {
      id: `gid://shopify/Product/${productId}`, title: "Product", status: "ACTIVE", vendor: "Vendor",
      productType: "Type", description: "Description", seo: { title: null, description: "" },
      handle: "product", category: null, featuredImage: null, collections,
    },
  };
}

function catalog(variants: ShopifyVariantNode[], hasNextPage = false, endCursor: string | null = "variant-end") {
  return {
    shop: { currencyCode: "NOK" }, location: { id: locationId, name: "Warehouse", isActive: true },
    productVariants: { edges: variants.map((node) => ({ node })), pageInfo: { hasNextPage, endCursor } },
  };
}

test("queries bound nested cost and use identical deterministic collection sorting", () => {
  assert.match(SHOPIFY_CATALOG_QUERY, /productVariants\(\s*first: 20/);
  assert.match(SHOPIFY_CATALOG_QUERY, /collections\(first: 20, sortKey: ID\)/);
  assert.match(SHOPIFY_COLLECTIONS_QUERY, /collections\(first: 100, after: \$cursor, sortKey: ID\)/);
  for (const query of [SHOPIFY_CATALOG_QUERY, SHOPIFY_COLLECTIONS_QUERY]) {
    assert.match(query, /pageInfo\s*{\s*hasNextPage\s*endCursor/);
    assert.doesNotMatch(query, /\bmutation\b/);
  }
});

test("multiple variants share one full product traversal and preserve legacy variant fields", async () => {
  const first = connection(Array.from({ length: 20 }, (_, i) => i + 1), true);
  const variants = [variant(1, 1, first), variant(2, 1, first), variant(3, 2, connection([50]))];
  const requests: Record<string, string | null>[] = [];
  const result = await fetchShopifyCatalogPage({
    cursor: null, locationId,
    request: async (query, variables) => {
      if (query === SHOPIFY_CATALOG_QUERY) return catalog(variants);
      assert.equal(query, SHOPIFY_COLLECTIONS_QUERY);
      requests.push(variables);
      return { product: { id: variables.productId, collections: connection([20, 21]) } };
    },
  });
  assert.deepEqual(requests, [{ productId: "gid://shopify/Product/1", cursor: "collection-20" }]);
  assert.strictEqual(result.variants[0].collectionObservation, result.variants[1].collectionObservation);
  assert.equal(result.variants[0].collections.length, 21);
  assert.deepEqual(result.variants[0].collections, result.variants[1].collections);
  assert.deepEqual(result.variants[2].collections, [collection(50)]);
  for (let i = 0; i < result.variants.length; i += 1) {
    const mapped = result.variants[i];
    assert.equal(mapped.sku, `SKU-${i + 1}`);
    assert.equal(mapped.shopifyVariantId, variants[i].id);
    assert.equal(mapped.shopifyProductId, variants[i].product.id);
    assert.equal(mapped.variantName, null);
    assert.equal(mapped.shopifyPriceMinor, 19990);
    assert.equal(mapped.shopifyPriceCurrency, "NOK");
    assert.equal(mapped.shopifyQuantity, 7);
    assert.equal(mapped.shopifyInventoryTracked, true);
    assert.equal(mapped.shopifyInventoryItemId, variants[i].inventoryItem.id);
    assert.equal(mapped.shopifyInventoryLevelId, variants[i].inventoryItem.inventoryLevel!.id);
    assert.equal(mapped.shopifyInventoryLocationId, locationId);
    assert.equal(mapped.productContent.description, "Description");
    assert.equal(mapped.collectionObservation.state, "complete");
  }
});

test("conflicting observations for the same product fail closed", async () => {
  await assert.rejects(fetchShopifyCatalogPage({
    cursor: null, locationId,
    request: async () => catalog([variant(1, 1, connection([])), variant(2, 1, connection([1], true))]),
  }), /Conflicting collection pages/);
});

test("a missing or mismatched product on a later page is incomplete, never complete empty", async () => {
  for (const product of [null, { id: "gid://shopify/Product/999", collections: connection([]) }]) {
    await assert.rejects(fetchShopifyCatalogPage({
      cursor: null, locationId,
      request: async (query) => query === SHOPIFY_CATALOG_QUERY
        ? catalog([variant(1, 1, connection([1], true))]) : { product },
    }), (error: unknown) => {
      assert.ok(error instanceof CollectionPaginationError);
      assert.equal(error.observation.state, "incomplete");
      return true;
    });
  }
});

test("mapper rejects unknown/incomplete observations even if bypassing the TypeScript guard", () => {
  for (const state of ["unknown", "incomplete"]) {
    assert.throws(() => mapShopifyVariant(variant(), {
      currencyCode: "NOK", locationId,
      collectionObservation: { state, observedAt: null, collections: [] } as unknown as ShopifyVariantPayload["collectionObservation"],
    }), /not complete/);
  }
});

test("a collection failure leaves the applied checkpoint and legacy relations intact; reclaim re-fetches the failed page", async () => {
  let storedCursor: string | null = null;
  let pagesProcessed = 0;
  let failLaterPage = true;
  let failures = 0;
  let completions = 0;
  const legacyRelations = new Map<string, unknown>([["gid://shopify/ProductVariant/2", [collection(999)]]]);
  const catalogCursors: (string | null)[] = [];
  const request: CatalogRequest = async (query, variables) => {
    if (query === SHOPIFY_CATALOG_QUERY) {
      catalogCursors.push(variables.cursor);
      return variables.cursor === null
        ? catalog([variant(1, 1, connection([1]))], true, "checkpoint-1")
        : catalog([variant(2, 2, connection([2], true))], false, "checkpoint-2");
    }
    assert.equal(variables.cursor, "collection-2");
    if (failLaterPage) throw new Error("later collection page unavailable");
    return { product: { id: variables.productId, collections: connection([3]) } };
  };
  const worker: ShopifySyncWorker<ShopifyVariantPayload> = {
    async claim() {
      return { acquired: true, resumed: pagesProcessed > 0, runId: "run", status: "running", cursor: storedCursor, processedCount: pagesProcessed, pagesProcessed, leaseToken: "lease" };
    },
    fetchPage: (cursor) => fetchShopifyCatalogPage({ cursor, locationId, request }),
    async applyPage({ page, expectedCursor }) {
      assert.equal(expectedCursor, storedCursor);
      for (const payload of page.variants) {
        assert.equal(payload.collectionObservation.state, "complete");
        legacyRelations.set(payload.shopifyVariantId, payload.collections);
      }
      storedCursor = page.endCursor;
      pagesProcessed += 1;
      return { runId: "run", status: "running", cursor: storedCursor, hasNextPage: page.hasNextPage, processedCount: pagesProcessed, skippedNoSku: 0, collectionsLinked: 0, pagesProcessed, leaseExpiresAt: "2026-09-17T12:00:00Z" };
    },
    async complete() {
      completions += 1;
      return { runId: "run", status: "completed", startedAt: "start", completedAt: "end", processedCount: 2, skippedNoSku: 0, collectionsLinked: 3, pagesProcessed, reconciledCount: 0 };
    },
    async pause() { assert.fail("unexpected pause"); },
    async fail() { failures += 1; },
  };
  await assert.rejects(runPagedShopifySync(worker), /later collection page unavailable/);
  assert.equal(storedCursor, "checkpoint-1");
  assert.equal(pagesProcessed, 1);
  assert.equal(completions, 0);
  assert.equal(failures, 1);
  assert.deepEqual(legacyRelations.get("gid://shopify/ProductVariant/2"), [collection(999)]);
  failLaterPage = false;
  assert.equal((await runPagedShopifySync(worker)).status, "completed");
  assert.deepEqual(catalogCursors, [null, "checkpoint-1", "checkpoint-1"]);
  assert.equal(pagesProcessed, 2);
  assert.equal(completions, 1);
  assert.deepEqual(legacyRelations.get("gid://shopify/ProductVariant/2"), [collection(2), collection(3)]);
});

function transport(responses: Response[]) {
  let time = 0;
  const waits: number[] = [];
  const calls: RequestInit[] = [];
  const request = createCatalogRequest({
    shop: "test.myshopify.com", apiVersion: "2026-04", accessToken: "test-token", deadlineMs: 60_000,
    now: () => time,
    sleep: async (ms) => { waits.push(ms); time += ms; },
    fetch: async (_url, init) => { calls.push(init!); return responses.shift()!; },
  });
  return { request, waits, calls };
}

const throttled = (requested = 101, available = 1, restoreRate = 50) => ({
  errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
  extensions: { cost: { requestedQueryCost: requested, throttleStatus: { currentlyAvailable: available, restoreRate } } },
});

test("GraphQL throttling waits for query-cost restoration and retries the identical read", async () => {
  const { request, waits, calls } = transport([
    Response.json(throttled()), Response.json({ data: { success: true } }),
  ]);
  assert.deepEqual(await request(SHOPIFY_COLLECTIONS_QUERY, { productId: "p", cursor: "c" }), { success: true });
  assert.deepEqual(waits, [2000]);
  assert.equal(calls[0].body, calls[1].body);
  assert.equal(calls[0].cache, "no-store");
  assert.ok(calls[0].signal instanceof AbortSignal);
});

test("successful response cost paces subsequent collection pages", async () => {
  const { request, waits } = transport([
    Response.json({ data: { ok: true }, extensions: throttled().extensions }),
    Response.json({ data: { ok: true } }),
  ]);
  await request(SHOPIFY_COLLECTIONS_QUERY, { cursor: "one" });
  await request(SHOPIFY_COLLECTIONS_QUERY, { cursor: "two" });
  assert.deepEqual(waits, [2000]);
});

test("HTTP 429 honors Retry-After even with a non-JSON body", async () => {
  const { request, waits } = transport([
    new Response("Too many requests", { status: 429, headers: { "Retry-After": "3" } }),
    Response.json({ data: { ok: true } }),
  ]);
  await request("query", {});
  assert.deepEqual(waits, [3000]);
});

test("throttle retries are bounded and never return partial GraphQL data", async () => {
  const { request, calls } = transport(Array.from({ length: 4 }, () => Response.json({ ...throttled(), data: { partial: true } })));
  await assert.rejects(request("query", {}), /throttled/);
  assert.equal(calls.length, 4);
});

test("an excessive throttle delay fails before exceeding the existing lease budget", async () => {
  const { request, waits, calls } = transport([Response.json(throttled(101, 0, 1))]);
  await assert.rejects(request("query", {}), /time budget/);
  assert.deepEqual(waits, []);
  assert.equal(calls.length, 1);
});

test("fatal and partial GraphQL errors are not retried or treated as usable data", async () => {
  for (const response of [
    Response.json({ data: { partial: true }, errors: [{ message: "Access denied" }] }),
    Response.json({ errors: [{ extensions: { code: "MAX_COST_EXCEEDED" } }] }),
    Response.json({ errors: [...throttled().errors, { message: "Invalid query" }] }),
    new Response("Unavailable", { status: 503 }),
    new Response("not JSON", { status: 200 }),
  ]) {
    const { request, calls } = transport([response]);
    await assert.rejects(request("query", {}), /API failed/);
    assert.equal(calls.length, 1);
  }
});

test("request deadline exhaustion prevents another network call", async () => {
  const request = createCatalogRequest({
    shop: "test.myshopify.com", apiVersion: "2026-04", accessToken: "test", deadlineMs: 10,
    now: () => 10, fetch: async () => assert.fail("deadline already exceeded"),
  });
  await assert.rejects(request("query", {}), /time budget/);
});

test("the HTTP source completes a shared product snapshot after a throttled continuation", async () => {
  const first = connection(Array.from({ length: 20 }, (_, i) => i + 1), true);
  const { request, calls, waits } = transport([
    Response.json({ data: catalog([variant(1, 1, first), variant(2, 1, first)]) }),
    Response.json(throttled()),
    Response.json({ data: { product: { id: "gid://shopify/Product/1", collections: connection([21]) } } }),
  ]);
  const page = await fetchShopifyCatalogPage({ cursor: null, locationId, request });
  assert.equal(page.variants.length, 2);
  assert.equal(page.variants[0].collections.length, 21);
  assert.equal(page.variants[0].collectionObservation.state, "complete");
  assert.strictEqual(page.variants[0].collectionObservation, page.variants[1].collectionObservation);
  assert.equal(calls.length, 3);
  assert.deepEqual(JSON.parse(String(calls[1].body)).variables, {
    productId: "gid://shopify/Product/1", cursor: "collection-20",
  });
  assert.equal(calls[1].body, calls[2].body);
  assert.deepEqual(waits, [2000]);
});

test("a later HTTP partial GraphQL response stays incomplete even when it claims the final page", async () => {
  const { request } = transport([
    Response.json({ data: catalog([variant(1, 1, connection([1], true))]) }),
    Response.json({
      data: { product: { id: "gid://shopify/Product/1", collections: connection([]) } },
      errors: [{ message: "Collection resolver failed" }],
    }),
  ]);
  await assert.rejects(fetchShopifyCatalogPage({ cursor: null, locationId, request }), (error: unknown) => {
    assert.ok(error instanceof CollectionPaginationError);
    assert.equal(error.observation.state, "incomplete");
    assert.deepEqual(error.observation.collections, [collection(1)]);
    return true;
  });
});

test("separate catalog snapshots do not reuse stale complete membership", async () => {
  const { request } = transport([
    Response.json({ data: catalog([variant(1, 1, connection([1]))]) }),
    Response.json({ data: catalog([variant(2, 1, connection([]))]) }),
  ]);
  const first = await fetchShopifyCatalogPage({ cursor: null, locationId, request });
  const second = await fetchShopifyCatalogPage({ cursor: "next-snapshot", locationId, request });
  assert.deepEqual(first.variants[0].collections, [collection(1)]);
  assert.deepEqual(second.variants[0].collections, []);
  assert.equal(second.variants[0].collectionObservation.state, "complete");
});
