import type {
  RoyCatalogAudit,
  ShopifyCatalogProduct,
  ShopifyCatalogVariant,
} from "../workforce/contexts/shopify-catalog.ts";

export type CatalogVariantRow = {
  id: string;
  shopify_product_id: string;
  shopify_variant_id: string | null;
  sku: string | null;
  product_name: string;
  variant_name: string | null;
  vendor: string | null;
  product_type: string | null;
  shopify_status: string | null;
  shopify_price_minor: number | null;
  shopify_price_currency: string | null;
  shopify_quantity: number | null;
  image_url: string | null;
  synced_at: string | null;
  shopify_inventory_tracked: boolean | null;
  shopify_inventory_observed_at: string | null;
};

export function groupCatalogVariants(
  rows: readonly CatalogVariantRow[],
  collectionsByRowId: ReadonlyMap<string, readonly { title: string; handle: string | null }[]>,
  selectedSku?: string | null,
): ShopifyCatalogProduct[] {
  const groups = new Map<string, CatalogVariantRow[]>();
  for (const row of rows) {
    const variants = groups.get(row.shopify_product_id) ?? [];
    variants.push(row);
    groups.set(row.shopify_product_id, variants);
  }

  return [...groups.entries()].map(([shopifyProductId, variants]) => {
    const selected = variants.find((row) => row.sku === selectedSku) ?? variants[0];
    const variantModels: ShopifyCatalogVariant[] = variants.map(toVariant);
    const collections = uniqueCollections(
      variants.flatMap((row) => collectionsByRowId.get(row.id) ?? []),
    );
    return {
      shopifyProductId,
      shopifyVariantId: selected.shopify_variant_id,
      sku: selected.sku,
      variantName: normalizeVariantName(selected.variant_name),
      productName: selected.product_name,
      vendor: selected.vendor,
      productType: selected.product_type,
      status: selected.shopify_status,
      priceMinor: selected.shopify_price_minor,
      currency: selected.shopify_price_currency,
      quantity: selected.shopify_quantity,
      imageReference: selected.image_url,
      syncedAt: selected.synced_at,
      inventoryTracked: selected.shopify_inventory_tracked,
      inventoryObservedAt: selected.shopify_inventory_observed_at,
      collections,
      variants: variantModels,
      hasProductFieldConflicts: hasParentFieldConflicts(variants),
    };
  });
}

export function buildCatalogAudit(products: readonly ShopifyCatalogProduct[]): RoyCatalogAudit {
  const variants = products.flatMap((product) => product.variants);
  const finding = (
    code: RoyCatalogAudit["findings"][number]["code"],
    scope: "product" | "variant",
    labels: readonly string[],
  ) => ({ code, scope, count: labels.length, evidence: labels.slice(0, 8) });
  const missingType = products.filter((p) => explicitEmpty(p.productType)).map(productLabel);
  const missingVendor = products.filter((p) => explicitEmpty(p.vendor)).map(productLabel);
  const missingImage = products.filter((p) => explicitEmpty(p.imageReference)).map(productLabel);
  const missingSku = products.flatMap((p) => p.variants.filter((v) => explicitEmpty(v.sku)).map(() => p.productName));
  const inconsistent = products.filter((product) => product.hasProductFieldConflicts).map(productLabel);
  const names = new Map<string, ShopifyCatalogProduct[]>();
  for (const product of products) {
    const key = product.productName.trim().toLocaleLowerCase("nb-NO");
    names.set(key, [...(names.get(key) ?? []), product]);
  }
  const duplicates = [...names.values()].filter((group) => group.length > 1).flatMap((group) => group.map(productLabel));
  const timestamps = variants.map((v) => v.syncedAt).filter((value): value is string => Boolean(value)).sort();
  return {
    productCount: products.length,
    variantCount: variants.length,
    findings: [
      finding("missing_product_type", "product", missingType),
      finding("missing_vendor", "product", missingVendor),
      finding("missing_featured_image_reference", "product", missingImage),
      finding("missing_sku", "variant", missingSku),
      finding("inconsistent_product_fields", "product", inconsistent),
      finding("exact_duplicate_product_name", "product", duplicates),
    ].filter((item) => item.count > 0),
    freshness: { oldestSyncedAt: timestamps[0] ?? null, newestSyncedAt: timestamps.at(-1) ?? null },
    deferred: [
      "Collection-dekning utsettes til den kan aggregeres komplett og skalerbart uten ny databasekontrakt.",
      "Stale sync utsettes som avviksklassifisering fordi ingen godkjent terskel finnes; eldste og nyeste synkronisering rapporteres faktuelt.",
    ],
  };
}

function toVariant(row: CatalogVariantRow): ShopifyCatalogVariant {
  return {
    shopifyVariantId: row.shopify_variant_id,
    sku: row.sku,
    variantName: normalizeVariantName(row.variant_name),
    priceMinor: row.shopify_price_minor,
    currency: row.shopify_price_currency,
    quantity: row.shopify_quantity,
    inventoryTracked: row.shopify_inventory_tracked,
    inventoryObservedAt: row.shopify_inventory_observed_at,
    syncedAt: row.synced_at,
  };
}

function normalizeVariantName(value: string | null) {
  return value?.trim().toLocaleLowerCase("en-US") === "default title" ? null : value;
}

function uniqueCollections(items: readonly { title: string; handle: string | null }[]) {
  return [...new Map(items.map((item) => [`${item.title}\0${item.handle ?? ""}`, item])).values()];
}

function explicitEmpty(value: unknown) { return value === null || value === ""; }
function productLabel(product: ShopifyCatalogProduct) { return product.sku ? `${product.productName} (SKU ${product.sku})` : product.productName; }
function hasParentFieldConflicts(rows: readonly CatalogVariantRow[]) {
  const fields = ["product_name", "vendor", "product_type", "shopify_status", "image_url"] as const;
  return fields.some((field) => new Set(rows.map((row) => row[field])).size > 1);
}
