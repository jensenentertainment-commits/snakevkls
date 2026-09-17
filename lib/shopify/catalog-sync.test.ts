import assert from "node:assert/strict";
import test from "node:test";
import {
  mapShopifyVariant,
  mapShopifyProductContent,
  parseShopifyMoneyToMinor,
  SHOPIFY_CATALOG_QUERY,
  validateShopifyLocation,
  type ShopifyVariantNode,
} from "./catalog-sync.ts";

const completeEmpty = {
  state: "complete" as const,
  observedAt: "2026-09-17T12:00:00Z",
  collections: [],
};
const observedAt = "2026-09-17T12:00:00Z";

function variant(
  overrides: Partial<ShopifyVariantNode> = {}
): ShopifyVariantNode {
  return {
    id: "gid://shopify/ProductVariant/1",
    sku: " VK-1 ",
    title: "Blå",
    price: "199.90",
    inventoryItem: {
      id: "gid://shopify/InventoryItem/2",
      tracked: true,
      inventoryLevel: {
        id: "gid://shopify/InventoryLevel/3",
        quantities: [{ name: "available", quantity: 7 }],
      },
    },
    product: {
      id: "gid://shopify/Product/4",
      updatedAt: "2026-09-16T10:00:00Z",
      title: "Ullgenser",
      status: "ACTIVE",
      vendor: "VK",
      productType: "Genser",
      description: "Varm ullgenser",
      seo: {
        title: "Ullgenser",
        description: "Varm ullgenser for kalde dager",
      },
      handle: "ullgenser",
      category: {
        id: "gid://shopify/TaxonomyCategory/aa-1",
        fullName: "Klær > Overdeler > Gensere",
      },
      featuredImage: { url: "https://cdn.example/product.jpg" },
      collections: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
    },
    ...overrides,
  };
}

test("parses Shopify NOK prices into whole øre without floating point math", () => {
  assert.equal(parseShopifyMoneyToMinor("0"), 0);
  assert.equal(parseShopifyMoneyToMinor("10.5"), 1050);
  assert.equal(parseShopifyMoneyToMinor("199.90"), 19990);
  assert.throws(() => parseShopifyMoneyToMinor("19.999"), /Ugyldig/);
  assert.throws(() => parseShopifyMoneyToMinor("-1.00"), /Ugyldig/);
});

test("maps price and available quantity at the configured location", () => {
  const result = mapShopifyVariant(variant(), {
    currencyCode: "NOK",
    locationId: "gid://shopify/Location/5",
    contentObservedAt: "2026-09-17T12:00:00Z",
    collectionObservation: completeEmpty,
  });

  assert.equal(result.sku, "VK-1");
  assert.equal(result.shopifyPriceMinor, 19990);
  assert.equal(result.shopifyPriceCurrency, "NOK");
  assert.equal(result.shopifyQuantity, 7);
  assert.equal(
    result.shopifyInventoryLocationId,
    "gid://shopify/Location/5"
  );
  assert.equal(
    result.shopifyInventoryLevelId,
    "gid://shopify/InventoryLevel/3"
  );
});

test("catalog query requests the Phase 2A product-content source fields", () => {
  assert.match(SHOPIFY_CATALOG_QUERY, /product\s*{\s*id\s*updatedAt/);
  assert.match(SHOPIFY_CATALOG_QUERY, /\bdescription\b/);
  assert.match(
    SHOPIFY_CATALOG_QUERY,
    /seo\s*{[\s\S]*?title[\s\S]*?description[\s\S]*?}/,
  );
  assert.match(SHOPIFY_CATALOG_QUERY, /\bhandle\b/);
  assert.match(
    SHOPIFY_CATALOG_QUERY,
    /category\s*{[\s\S]*?id[\s\S]*?fullName[\s\S]*?}/,
  );
});

test("content timestamps never substitute observation time for source time", () => {
  const content = mapShopifyProductContent(variant().product, observedAt);
  assert.equal(content.shopifyUpdatedAt, "2026-09-16T10:00:00Z");
  assert.equal(content.contentObservedAt, observedAt);
  for (const updatedAt of [undefined, null, "", "not-a-date"]) {
    assert.throws(() => mapShopifyProductContent({ ...variant().product, updatedAt } as ShopifyVariantNode["product"], observedAt), /timestamps/);
  }
  assert.throws(() => mapShopifyProductContent(variant().product, "invalid"), /timestamps/);
});

test("absent source fields cannot become observed missing values", () => {
  for (const key of ["description", "seo", "category", "vendor", "productType", "featuredImage"]) {
    const product = { ...variant().product } as unknown as Record<string, unknown>;
    delete product[key];
    assert.throws(() => mapShopifyProductContent(product as ShopifyVariantNode["product"], observedAt), /missing source fields/);
  }
});

test("maps populated Shopify product content without mixing category and product type", () => {
  const result = mapShopifyProductContent(variant().product, observedAt);

  assert.deepEqual(result, {
    shopifyProductId: "gid://shopify/Product/4",
    shopifyUpdatedAt: "2026-09-16T10:00:00Z",
    contentObservedAt: observedAt,
    productName: "Ullgenser",
    description: "Varm ullgenser",
    seoTitle: "Ullgenser",
    seoDescription: "Varm ullgenser for kalde dager",
    productHandle: "ullgenser",
    productType: "Genser",
    shopifyCategory: {
      id: "gid://shopify/TaxonomyCategory/aa-1",
      fullName: "Klær > Overdeler > Gensere",
    },
    vendor: "VK",
    status: "ACTIVE",
    imageReference: "https://cdn.example/product.jpg",
  });
  assert.notEqual(result.productType, result.shopifyCategory?.fullName);
});

test("preserves nullable and explicitly empty Shopify product-content values", () => {
  const result = mapShopifyProductContent({
    ...variant().product,
    description: "",
    seo: { title: null, description: "" },
    category: null,
    productType: null,
    vendor: null,
    featuredImage: null,
  }, observedAt);

  assert.equal(result.description, "");
  assert.equal(result.seoTitle, null);
  assert.equal(result.seoDescription, "");
  assert.equal(result.shopifyCategory, null);
  assert.equal(result.productType, null);
  assert.equal(result.vendor, null);
  assert.equal(result.imageReference, null);
});

test("variant payload carries mapped content without changing variant semantics", () => {
  const result = mapShopifyVariant(variant(), {
    currencyCode: "NOK",
    locationId: "gid://shopify/Location/5",
    contentObservedAt: "2026-09-17T12:00:00Z",
    collectionObservation: completeEmpty,
  });

  assert.equal(result.shopifyVariantId, "gid://shopify/ProductVariant/1");
  assert.equal(result.sku, "VK-1");
  assert.equal(result.shopifyPriceMinor, 19990);
  assert.equal(result.shopifyQuantity, 7);
  assert.equal(result.productContent.shopifyProductId, result.shopifyProductId);
  assert.equal(result.productContent.description, "Varm ullgenser");
});

test("keeps a missing inventory level distinct from zero available", () => {
  const input = variant({
    inventoryItem: {
      id: "gid://shopify/InventoryItem/2",
      tracked: true,
      inventoryLevel: null,
    },
  });

  const result = mapShopifyVariant(input, {
    currencyCode: "NOK",
    locationId: "gid://shopify/Location/5",
    contentObservedAt: "2026-09-17T12:00:00Z",
    collectionObservation: completeEmpty,
  });

  assert.equal(result.shopifyQuantity, null);
  assert.equal(result.shopifyInventoryLevelId, null);
});

test("rejects a non-NOK shop for warehouse sales V1", () => {
  assert.throws(
    () =>
      mapShopifyVariant(variant(), {
        currencyCode: "SEK",
        locationId: "gid://shopify/Location/5",
        contentObservedAt: "2026-09-17T12:00:00Z",
        collectionObservation: completeEmpty,
      }),
    /krever NOK/
  );
});

test("catalog query requests price and location-specific available inventory", () => {
  assert.match(SHOPIFY_CATALOG_QUERY, /\$locationId: ID!/);
  assert.match(
    SHOPIFY_CATALOG_QUERY,
    /inventoryLevel\(locationId: \$locationId\)/
  );
  assert.match(SHOPIFY_CATALOG_QUERY, /quantities\(names: \["available"\]\)/);
  assert.match(SHOPIFY_CATALOG_QUERY, /\bprice\b/);
  assert.match(SHOPIFY_CATALOG_QUERY, /location\(id: \$locationId\)/);
  assert.doesNotMatch(SHOPIFY_CATALOG_QUERY, /\binventoryQuantity\b/);
});

test("requires the configured Shopify location to exist and be active", () => {
  const locationId = "gid://shopify/Location/5";

  assert.doesNotThrow(() =>
    validateShopifyLocation(
      { id: locationId, name: "VK-lager", isActive: true },
      locationId
    )
  );
  assert.throws(
    () =>
      validateShopifyLocation(
        { id: locationId, name: "VK-lager", isActive: false },
        locationId
      ),
    /ikke aktiv/
  );
  assert.throws(
    () => validateShopifyLocation(null, locationId),
    /finnes ikke/
  );
});
