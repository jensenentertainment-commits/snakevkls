/** Børre-only read model. No health score, reservations or stock corrections. */
export type Product = {
  id: string; product_name: string; variant_name: string | null; sku: string | null;
  shopify_variant_id: string | null; active: boolean;
  shopify_quantity: number | null; shopify_inventory_tracked: boolean | null;
  shopify_inventory_location_id: string | null; shopify_inventory_observed_at: string | null;
};
export type Inventory = { id: string; product_id: string; location_id: string | null; zone_id: string | null; quantity: number };
export type Location = { id: string; code: string; zone_id: string | null; active: boolean; location_purpose: string | null };
export type Zone = { id: string; code: string; name: string; active: boolean };
export type StockData = { products: Product[]; inventory: Inventory[]; locations: Location[]; zones: Zone[] };
export type ProductKey = { kind: "productUuid" | "variantId" | "name"; value: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeProductKey(key: ProductKey): ProductKey {
  if (!key || typeof key.value !== "string") throw new Error("INVALID_PRODUCT_KEY");
  const value = key.value.trim();
  if (key.kind === "productUuid" && uuid.test(value)) return { ...key, value: value.toLowerCase() };
  if (key.kind === "variantId" && /^(?:gid:\/\/shopify\/ProductVariant\/)?[1-9]\d*$/.test(value)) {
    return { ...key, value: `gid://shopify/ProductVariant/${value.split("/").pop()}` };
  }
  if (key.kind === "name" && value.length >= 2 && value.length <= 200) return { ...key, value };
  throw new Error("INVALID_PRODUCT_KEY");
}

export function resolveProduct(data: StockData, input: ProductKey) {
  const key = normalizeProductKey(input);
  const matches = data.products.filter(p => key.kind === "productUuid" ? p.id === key.value
    : key.kind === "variantId" ? p.shopify_variant_id === key.value
    : p.product_name.toLocaleLowerCase("nb-NO").includes(key.value.toLocaleLowerCase("nb-NO")));
  return {
    status: matches.length === 0 ? "not_found" as const : matches.length === 1 ? "resolved" as const : "ambiguous" as const,
    candidates: matches.map(p => ({ productUuid: p.id, variantId: p.shopify_variant_id, name: p.product_name, variantName: p.variant_name, sku: p.sku, active: p.active })),
  };
}

export function describePlacement(data: StockData, row: Inventory) {
  const location = data.locations.find(l => l.id === row.location_id) ?? null;
  const zone = data.zones.find(z => z.id === location?.zone_id) ?? null;
  const reason = !row.location_id ? "unplaced" : !location ? "location_unknown"
    : !location.active ? "location_inactive" : !zone ? "zone_unknown"
    : !zone.active ? "zone_inactive" : row.zone_id !== zone.id ? "zone_mismatch" : null;
  return {
    inventoryId: row.id, productUuid: row.product_id, quantity: row.quantity,
    locationId: row.location_id, locationCode: location?.code ?? null,
    zoneId: location?.zone_id ?? null, zoneCode: zone?.code ?? null,
    registeredZoneId: row.zone_id,
    purpose: location?.location_purpose === "PICK" || location?.location_purpose === "BUFFER" ? location.location_purpose : "unknown",
    placementIssue: row.quantity > 0 ? reason : null,
    referenceIssue: reason,
  };
}

export function productStock(data: StockData, productId: string) {
  const product = data.products.find(p => p.id === productId);
  if (!product) throw new Error("PRODUCT_NOT_FOUND");
  const placements = data.inventory.filter(r => r.product_id === productId).map(r => describePlacement(data, r));
  const sum = placements.reduce((n, r) => n + r.quantity, 0);
  const quantityValid = placements.every(r => Number.isSafeInteger(r.quantity) && r.quantity >= 0) && Number.isSafeInteger(sum);
  const registeredQuantity = quantityValid ? sum : null;
  const observedAt = product.shopify_inventory_observed_at;
  const observationKnown = product.shopify_inventory_tracked === true && product.shopify_variant_id !== null
    && product.shopify_inventory_location_id !== null && observedAt !== null && Number.isFinite(Date.parse(observedAt))
    && product.shopify_quantity !== null && Number.isSafeInteger(product.shopify_quantity);
  const shopifyQuantity = observationKnown ? product.shopify_quantity : null;
  return {
    productUuid: product.id, variantId: product.shopify_variant_id, name: product.product_name,
    variantName: product.variant_name, sku: product.sku, active: product.active,
    registeredQuantity, inventoryRowCount: placements.length, placements,
    positiveInvalidPlacements: placements.filter(p => p.placementIssue !== null),
    shopify: { state: observationKnown ? "observed" : "unknown", quantity: shopifyQuantity,
      measure: "available" as const, locationId: product.shopify_inventory_location_id,
      observedAt, tracked: product.shopify_inventory_tracked, source: "stored_catalog" as const },
    difference: {
      // Arithmetic observation only: never label this a confirmed physical error.
      snakeMinusShopify: registeredQuantity !== null && shopifyQuantity !== null && Number.isSafeInteger(registeredQuantity - shopifyQuantity)
        ? registeredQuantity - shopifyQuantity : null,
      classification: "observation_only" as const, confirmedStockError: false as const,
      scopeEquivalence: "unverified" as const,
      caveats: ["snake_physical_registration_incomplete_or_unknown", "shopify_available_is_not_physical_stock",
        "order_processing_not_assessed", "observation_may_be_stale", "reads_are_not_an_atomic_snapshot"],
    },
    physicalRegistration: "incomplete_or_unknown" as const,
    dataIssues: quantityValid ? [] : ["invalid_registered_quantity"],
  };
}

export function locationStock(data: StockData, locationId: string) {
  if (!uuid.test(locationId)) throw new Error("INVALID_LOCATION_ID");
  const location = data.locations.find(l => l.id === locationId.toLowerCase());
  if (!location) return { status: "not_found" as const };
  const rows = data.inventory.filter(r => r.location_id === location.id);
  return { status: "found" as const, location,
    zone: data.zones.find(z => z.id === location.zone_id) ?? null,
    entries: rows.map(row => ({ ...describePlacement(data, row),
      product: data.products.find(p => p.id === row.product_id) ?? null })),
    hasPositiveStock: rows.some(row => row.quantity > 0),
    // An empty registered location is not proof of physical emptiness.
    physicalOccupancy: "unknown" as const,
  };
}
