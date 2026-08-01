import assert from "node:assert/strict";
import test from "node:test";
import {
  ShopifyInventoryWorkerError,
  adjustShopifyInventoryForWarehouseSale,
} from "./shopify-inventory-client.ts";
import {
  retryDelaySeconds,
  runWarehouseSaleShopifyWorker,
  type WarehouseSaleShopifyJobStore,
} from "./shopify-worker-engine.ts";
import type { WarehouseSaleShopifyClaim } from "./shopify-worker-types.ts";

const claim: Extract<WarehouseSaleShopifyClaim, { acquired: true }> = {
  acquired: true,
  jobId: "10000000-0000-4000-8000-000000000001",
  warehouseSaleId: "20000000-0000-4000-8000-000000000001",
  shop: "test.myshopify.com",
  shopifyLocationId: "gid://shopify/Location/10",
  idempotencyKey: "30000000-0000-4000-8000-000000000001",
  referenceDocumentUri: "snake://warehouse-sale/sale-1",
  payloadHash: "a".repeat(64),
  attemptCount: 2,
  leaseToken: "40000000-0000-4000-8000-000000000001",
  leaseExpiresAt: "2026-07-29T20:00:00Z",
  payload: {
    schemaVersion: 1,
    locationId: "gid://shopify/Location/10",
    changes: [
      {
        productId: "product-1",
        saleLineId: "line-1",
        inventoryItemId: "gid://shopify/InventoryItem/20",
        delta: -3,
      },
    ],
  },
};

function fakeStore(
  events: unknown[],
  claimed: WarehouseSaleShopifyClaim = claim
): WarehouseSaleShopifyJobStore {
  return {
    async claim() {
      events.push("claim");
      return claimed;
    },
    async getAccessToken(shop) {
      events.push(["token", shop]);
      return "fake-token";
    },
    async complete(jobId, leaseToken, result) {
      events.push(["complete", jobId, leaseToken, result]);
    },
    async fail(jobId, leaseToken, error, delay) {
      events.push(["fail", jobId, leaseToken, error.code, error.kind, delay]);
    },
  };
}

test("fake Shopify receives the immutable delta, explicit CAS opt-out, location and idempotency key", async () => {
  let requestBody = "";
  const result = await adjustShopifyInventoryForWarehouseSale({
    claim,
    accessToken: "fake-token",
    fetchImpl: async (_url, init) => {
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          data: {
            inventoryAdjustQuantities: {
              inventoryAdjustmentGroup: {
                createdAt: "2026-07-29T20:00:00Z",
                referenceDocumentUri: claim.referenceDocumentUri,
              },
              userErrors: [],
            },
          },
        }),
        { status: 200 }
      );
    },
  });
  const body = JSON.parse(requestBody);
  assert.equal(body.variables.idempotencyKey, claim.idempotencyKey);
  assert.equal(body.variables.input.referenceDocumentUri, claim.referenceDocumentUri);
  assert.deepEqual(body.variables.input.changes, [
    {
      delta: -3,
      changeFromQuantity: null,
      inventoryItemId: "gid://shopify/InventoryItem/20",
      locationId: claim.shopifyLocationId,
    },
  ]);
  assert.match(result.adjustmentGroupId, /^snake:\/\/warehouse-sale/);
});

test("worker completes a claimed fake job without changing its identity", async () => {
  const events: unknown[] = [];
  const result = await runWarehouseSaleShopifyWorker(
    fakeStore(events),
    async ({ claim: received }) => {
      assert.equal(received, claim);
      return { adjustmentGroupId: "group-1" };
    }
  );
  assert.deepEqual(result, {
    status: "synced",
    jobId: claim.jobId,
    attemptCount: 2,
  });
  assert.deepEqual(events.at(-1), [
    "complete",
    claim.jobId,
    claim.leaseToken,
    { adjustmentGroupId: "group-1" },
  ]);
});

test("timeouts remain unknown and retry with the original claimed identity", async () => {
  const events: unknown[] = [];
  const result = await runWarehouseSaleShopifyWorker(
    fakeStore(events),
    async () => {
      throw new ShopifyInventoryWorkerError(
        "timeout",
        "TIMEOUT_UNKNOWN",
        "unknown"
      );
    }
  );
  assert.equal(result.status, "failed");
  assert.equal(result.resultUnknown, true);
  assert.equal(result.retryScheduled, true);
  assert.deepEqual(events.at(-1), [
    "fail",
    claim.jobId,
    claim.leaseToken,
    "TIMEOUT_UNKNOWN",
    "unknown",
    60,
  ]);
});

test("permanent errors remain visible without automatic retry", async () => {
  const events: unknown[] = [];
  const result = await runWarehouseSaleShopifyWorker(
    fakeStore(events),
    async () => {
      throw new ShopifyInventoryWorkerError(
        "invalid location",
        "INVALID_LOCATION",
        "permanent"
      );
    }
  );
  assert.equal(result.status, "failed");
  assert.equal(result.retryScheduled, false);
  assert.deepEqual(events.at(-1), [
    "fail",
    claim.jobId,
    claim.leaseToken,
    "INVALID_LOCATION",
    "permanent",
    null,
  ]);
});

test("idle claims never access Shopify and backoff is bounded", async () => {
  const events: unknown[] = [];
  const result = await runWarehouseSaleShopifyWorker(
    fakeStore(events, { acquired: false }),
    async () => assert.fail("idle worker must not call Shopify")
  );
  assert.deepEqual(result, { status: "idle" });
  assert.deepEqual(events, ["claim"]);
  assert.equal(retryDelaySeconds(1), 30);
  assert.equal(retryDelaySeconds(2), 60);
  assert.equal(retryDelaySeconds(99), 3600);
});

test("timeout after applied mutation is deduplicated by the same Shopify key", async () => {
  const operations = new Map<string, string>();
  let appliedDelta = 0;
  let calls = 0;

  const statefulFake: typeof fetch = async (_url, init) => {
    calls += 1;
    const bodyText = String(init?.body);
    const body = JSON.parse(bodyText);
    const key = String(body.variables.idempotencyKey);
    const previous = operations.get(key);

    if (previous === undefined) {
      operations.set(key, bodyText);
      appliedDelta += Number(body.variables.input.changes[0].delta);
      const timeout = new Error("response lost after apply");
      timeout.name = "AbortError";
      throw timeout;
    }

    assert.equal(bodyText, previous, "retry payload must be byte-identical");
    return new Response(
      JSON.stringify({
        data: {
          inventoryAdjustQuantities: {
            inventoryAdjustmentGroup: {
              createdAt: "2026-07-29T20:00:00Z",
              referenceDocumentUri: claim.referenceDocumentUri,
            },
            userErrors: [],
          },
        },
      }),
      { status: 200 }
    );
  };

  await assert.rejects(
    () =>
      adjustShopifyInventoryForWarehouseSale({
        claim,
        accessToken: "fake-token",
        fetchImpl: statefulFake,
      }),
    (error: unknown) =>
      error instanceof ShopifyInventoryWorkerError &&
      error.code === "TIMEOUT_UNKNOWN"
  );

  await adjustShopifyInventoryForWarehouseSale({
    claim,
    accessToken: "fake-token",
    fetchImpl: statefulFake,
  });

  assert.equal(calls, 2);
  assert.equal(operations.size, 1);
  assert.equal(appliedDelta, -3);
});
