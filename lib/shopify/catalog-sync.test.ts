import assert from "node:assert/strict";
import test from "node:test";
import {
  mapShopifyVariant,
  parseShopifyMoneyToMinor,
  SHOPIFY_CATALOG_QUERY,
  validateShopifyLocation,
  type ShopifyVariantNode,
} from "./catalog-sync.ts";

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
      title: "Ullgenser",
      status: "ACTIVE",
      vendor: "VK",
      productType: "Genser",
      featuredImage: { url: "https://cdn.example/product.jpg" },
      collections: { edges: [] },
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
