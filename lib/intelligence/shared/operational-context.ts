import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";
import { createClient } from "@/lib/supabase/server";

type ShopifySyncMetadata = {
  imported?: number;
  skipped_no_sku?: number;
  collections_linked?: number;
  duration_ms?: number;
  source?: string;
};

export async function getSnakeOperationalContext() {
  const supabase = await createClient();
  const stats = await getDashboardStats();

  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });

  const latestSync = stats.latestShopifySync;
  const metadata =
    (latestSync?.metadata as ShopifySyncMetadata | null) ?? {};

  const { data: missingInventoryRows, error: inventoryError } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .is("location_id", null)
    .limit(10);

  if (inventoryError) {
    throw new Error(
      `Operational inventory query failed: ${inventoryError.message}`
    );
  }

  const productIds = [
    ...new Set(
      missingInventoryRows
        ?.map((row) => row.product_id)
        .filter((id): id is string => Boolean(id)) ?? []
    ),
  ];

  const { data: products, error: productsError } =
    productIds.length > 0
      ? await supabase
          .from("products")
          .select("id, product_name, sku")
          .in("id", productIds)
      : { data: [], error: null };

  if (productsError) {
    throw new Error(
      `Operational product query failed: ${productsError.message}`
    );
  }

  const missingLocationProducts =
    missingInventoryRows?.map((item) => {
      const product = products?.find(
        (candidate) => candidate.id === item.product_id
      );

      return {
        productName: product?.product_name ?? "Ukjent produkt",
        sku: product?.sku ?? null,
        quantity: item.quantity ?? 0,
      };
    }) ?? [];

  return {
    stats,
    health,

    warehouse: {
      activeProducts: stats.activeProductCount,
      placedProducts: stats.placedProductCount,
      quantityDiffs: stats.quantityDiffCount,
      missingLocations: stats.missingLocationCount,
      missingSku: stats.missingSkuCount,
      emptyLocations: stats.emptyLocationCount,
      locationsWithoutZone: stats.locationsNoZoneCount,
    },

    shopifySync: latestSync
      ? {
          status: latestSync.action,
          title: latestSync.title,
          createdAt: latestSync.created_at,
          imported: metadata.imported ?? null,
          skippedNoSku: metadata.skipped_no_sku ?? null,
          collectionsLinked: metadata.collections_linked ?? null,
          durationMs: metadata.duration_ms ?? null,
          source: metadata.source ?? null,
        }
      : null,

    missingLocationProducts,
  };
}
