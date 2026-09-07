import assert from "node:assert/strict";
import test from "node:test";
import {
  ROY_PRODUCT_CONTENT_CATALOG_SCOPE,
  classifyCollectionMembership,
  classifyObservedField,
  type ProductCollectionObservation,
  type ProductContentObservation,
  type ShopifyProductContentValue,
} from "../lib/intelligence/roy/product-content-contract.ts";
import { ROY_RECEIVED_CATALOG_FIELDS } from "../lib/intelligence/workforce/contexts/shopify-catalog.ts";

const content: ShopifyProductContentValue = {
  productName: "Elektrisk saksejekk",
  description: "",
  seoTitle: null,
  seoDescription: null,
  productHandle: "elektrisk-saksejekk",
  productType: "Jekk",
  shopifyCategory: {
    id: "gid://shopify/TaxonomyCategory/aa-1",
    fullName: "Kjøretøydeler > Verktøy > Jekker",
  },
  vendor: "Varekompaniet",
  status: "ACTIVE",
  imageReference: null,
  shopifyUpdatedAt: "2026-09-07T08:00:00.000Z",
};

const unknown: ProductContentObservation = {
  state: "unknown",
  observedAt: null,
  value: null,
};

const observed: ProductContentObservation = {
  state: "observed",
  observedAt: "2026-09-07T08:05:00.000Z",
  value: content,
};

test("Phase 2A catalog scope is active Shopify products only", () => {
  assert.equal(ROY_PRODUCT_CONTENT_CATALOG_SCOPE, "active_shopify_products");
});

test("unobserved values remain unknown even when their storage value is null", () => {
  assert.equal(classifyObservedField(unknown, null), "unknown");
  assert.equal(classifyObservedField(unknown, ""), "unknown");
});

test("observed null, blank, and empty values are missing", () => {
  assert.equal(classifyObservedField(observed, null), "missing");
  assert.equal(classifyObservedField(observed, "  "), "missing");
  assert.equal(classifyObservedField(observed, []), "missing");
  assert.equal(classifyObservedField(observed, "registrert"), "present");
});

test("Shopify Product Category remains semantically separate from product type", () => {
  assert.equal(observed.value.productType, "Jekk");
  assert.equal(
    observed.value.shopifyCategory?.fullName,
    "Kjøretøydeler > Verktøy > Jekker",
  );
  assert.notEqual(
    observed.value.productType,
    observed.value.shopifyCategory?.fullName,
  );
});

test("collection completeness distinguishes none from unknown and incomplete", () => {
  const noObservation: ProductCollectionObservation = {
    state: "unknown",
    observedAt: null,
    collections: [],
  };
  const partial: ProductCollectionObservation = {
    state: "incomplete",
    observedAt: "2026-09-07T08:05:00.000Z",
    collections: [
      { id: "gid://shopify/Collection/1", title: "Verktøy", handle: "verktoy" },
    ],
  };
  const completeEmpty: ProductCollectionObservation = {
    state: "complete",
    observedAt: "2026-09-07T08:05:00.000Z",
    collections: [],
  };
  const completePopulated: ProductCollectionObservation = {
    state: "complete",
    observedAt: "2026-09-07T08:05:00.000Z",
    collections: partial.collections,
  };

  assert.equal(classifyCollectionMembership(noObservation), "unknown");
  assert.equal(classifyCollectionMembership(partial), "incomplete");
  assert.equal(classifyCollectionMembership(completeEmpty), "none");
  assert.equal(classifyCollectionMembership(completePopulated), "present");
});

test("new content fields are not activated in Roy receivedFields by Commit 1", () => {
  for (const field of [
    "description",
    "seoTitle",
    "seoDescription",
    "productHandle",
    "shopifyCategory",
  ]) {
    assert.equal(ROY_RECEIVED_CATALOG_FIELDS.includes(field as never), false);
  }
});
