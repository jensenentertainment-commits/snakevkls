import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWarehouseSaleRequest,
  WarehouseSaleValidationError,
} from "./validation.ts";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("normalizes order and produces the same hash for the same logical sale", () => {
  const first = normalizeWarehouseSaleRequest({
    idempotencyKey: IDEMPOTENCY_KEY.toUpperCase(),
    paymentMethod: "vipps",
    lines: [
      { productId: PRODUCT_B, quantity: 1, unitPriceMinor: 9900 },
      { productId: PRODUCT_A, quantity: 2, unitPriceMinor: 19990 },
    ],
  });
  const retry = normalizeWarehouseSaleRequest({
    idempotencyKey: IDEMPOTENCY_KEY,
    paymentMethod: "vipps",
    lines: [
      { productId: PRODUCT_A, quantity: 2, unitPriceMinor: 19990 },
      { productId: PRODUCT_B, quantity: 1, unitPriceMinor: 9900 },
    ],
  });

  assert.equal(first.idempotencyKey, IDEMPOTENCY_KEY);
  assert.deepEqual(first.lines, retry.lines);
  assert.equal(first.requestHash, retry.requestHash);
  assert.match(first.requestHash, /^[0-9a-f]{64}$/);
});

test("request hash changes when quantity or actual price changes", () => {
  const base = {
    idempotencyKey: IDEMPOTENCY_KEY,
    paymentMethod: "vipps",
    lines: [{ productId: PRODUCT_A, quantity: 1, unitPriceMinor: 10000 }],
  } as const;

  const original = normalizeWarehouseSaleRequest(base);
  const changedQuantity = normalizeWarehouseSaleRequest({
    ...base,
    lines: [{ ...base.lines[0], quantity: 2 }],
  });
  const changedPrice = normalizeWarehouseSaleRequest({
    ...base,
    lines: [{ ...base.lines[0], unitPriceMinor: 9000 }],
  });
  const changedPaymentMethod = normalizeWarehouseSaleRequest({
    ...base,
    paymentMethod: "cash",
  });

  assert.notEqual(original.requestHash, changedQuantity.requestHash);
  assert.notEqual(original.requestHash, changedPrice.requestHash);
  assert.notEqual(original.requestHash, changedPaymentMethod.requestHash);
});

test("rejects duplicate products, invalid quantities and negative prices", () => {
  assert.throws(
    () =>
      normalizeWarehouseSaleRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        paymentMethod: "vipps",
        lines: [
          { productId: PRODUCT_A, quantity: 1, unitPriceMinor: 100 },
          { productId: PRODUCT_A, quantity: 1, unitPriceMinor: 100 },
        ],
      }),
    /bare forekomme én gang/
  );

  for (const line of [
    { productId: PRODUCT_A, quantity: 0, unitPriceMinor: 100 },
    { productId: PRODUCT_A, quantity: 1.5, unitPriceMinor: 100 },
    { productId: PRODUCT_A, quantity: 1, unitPriceMinor: -1 },
    { productId: PRODUCT_A, quantity: 1, unitPriceMinor: 1.5 },
  ]) {
    assert.throws(
      () =>
        normalizeWarehouseSaleRequest({
          idempotencyKey: IDEMPOTENCY_KEY,
          paymentMethod: "vipps",
          lines: [line],
        }),
      WarehouseSaleValidationError
    );
  }
});

test("accepts Vipps and cash but rejects other payment methods", () => {
  const cash = normalizeWarehouseSaleRequest({
    idempotencyKey: IDEMPOTENCY_KEY,
    paymentMethod: "cash",
    lines: [{ productId: PRODUCT_A, quantity: 1, unitPriceMinor: 100 }],
  });
  assert.equal(cash.paymentMethod, "cash");

  assert.throws(
    () =>
      normalizeWarehouseSaleRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        paymentMethod: "card",
        lines: [{ productId: PRODUCT_A, quantity: 1, unitPriceMinor: 100 }],
      }),
    /betalingsmåte/
  );
});

test("keeps line-count boundaries", () => {
  assert.throws(
    () =>
      normalizeWarehouseSaleRequest({
        idempotencyKey: IDEMPOTENCY_KEY,
        paymentMethod: "vipps",
        lines: [],
      }),
    /mellom 1 og 100/
  );
});
