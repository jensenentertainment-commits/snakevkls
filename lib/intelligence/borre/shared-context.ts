import { getDashboardStats } from "@/lib/dashboard";
import { getWarehouseHealth } from "@/lib/intelligence/snake-intelligence";
import { createClient } from "@/lib/supabase/server";

export async function getBorreContext() {
  const supabase = await createClient();

  const stats = await getDashboardStats();

  const health = getWarehouseHealth({
    missingLocationCount: stats.missingLocationCount,
    quantityDiffCount: stats.quantityDiffCount,
    locationsWithoutZoneCount: stats.locationsNoZoneCount,
    placedCount: stats.placedProductCount,
  });

  const latestSync = stats.latestShopifySync as any;
  const meta = latestSync?.metadata ?? {};

  // Produkter uten lokasjon
  const { data: missingInventoryRows } = await supabase
    .from("inventory")
    .select("product_id, quantity")
    .is("location_id", null)
    .limit(10);

  const productIds =
    missingInventoryRows?.map((p) => p.product_id).filter(Boolean) ?? [];

  const { data: products } =
    productIds.length > 0
      ? await supabase
          .from("products")
          .select("id, product_name, sku")
          .in("id", productIds)
      : { data: [] };

  const missingLocationProducts =
    missingInventoryRows?.map((item) => {
      const product = products?.find((p) => p.id === item.product_id);

      return {
        productName: product?.product_name ?? "Ukjent produkt",
        sku: product?.sku ?? null,
        quantity: item.quantity,
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
          imported: meta.imported,
          skippedNoSku: meta.skipped_no_sku,
          collectionsLinked: meta.collections_linked,
          durationMs: meta.duration_ms,
          source: meta.source,
        }
      : null,

    missingLocationProducts,
  };
}