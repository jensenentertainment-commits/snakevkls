import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function getDashboardStats() {
  const supabase = getSupabaseAdmin();
  const [
    missingLocationRes,
    missingSkuRes,
    emptyLocationRes,
    productsRes,
    reconciliationRes,
    locationsNoZoneRes,
    latestActivityRes,
    latestShopifySyncRes,
  ] = await Promise.all([
    supabase
      .from("inventory")
      .select("*", { count: "exact", head: true })
      .is("location_id", null),

    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .is("sku", null),

    supabase
      .from("locations")
      .select("id, inventory(id)", { count: "exact", head: true })
      .eq("active", true)
      .is("inventory.id", null),

    supabase
      .from("products")
      .select(`
        id,
        shopify_quantity,
        inventory (
          id,
          quantity,
          location_id
        )
      `)
      .eq("active", true),

    supabase
      .from("warehouse_sale_shopify_reconciliation")
      .select("product_id, reconciliation_status"),

    supabase
      .from("locations")
      .select("*", { count: "exact", head: true })
      .eq("active", true)
      .is("zone_id", null),

    supabase
      .from("activity_log")
      .select("id, title, action, actor_name, actor_email, created_at")
      .order("created_at", { ascending: false })
      .limit(1),

    supabase
      .from("activity_log")
      .select("id, title, action, created_at, metadata")
      .eq("action", "shopify_sync_completed")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const failedQuery = ([
    ["missingLocation", missingLocationRes],
    ["missingSku", missingSkuRes],
    ["emptyLocation", emptyLocationRes],
    ["products", productsRes],
    ["shopifyReconciliation", reconciliationRes],
    ["locationsNoZone", locationsNoZoneRes],
    ["latestActivity", latestActivityRes],
    ["latestShopifySync", latestShopifySyncRes],
  ] as const).find(([, result]) => result.error);

  if (failedQuery) {
    const [queryName, result] = failedQuery;
    const error = result.error!;
    console.error(`Dashboard query failed: ${queryName}`, {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw new Error(
      `Dashboard data query failed (${queryName}): ${error.message}`
    );
  }

  const products = productsRes.data ?? [];

  const placedProductCount = products.filter((product) =>
    product.inventory?.some((item) => item.location_id)
  ).length;

  const quantityDiffCount = (reconciliationRes.data ?? []).filter(
    (product) => product.reconciliation_status === "unexplained_difference"
  ).length;

  return {
    missingLocationCount: missingLocationRes.count ?? 0,
    missingSkuCount: missingSkuRes.count ?? 0,
    emptyLocationCount: emptyLocationRes.count ?? 0,

    activeProductCount: products.length,
    placedProductCount,
    quantityDiffCount,

    locationsNoZoneCount: locationsNoZoneRes.count ?? 0,

    latestActivity: latestActivityRes.data?.[0] ?? null,
    latestShopifySync: latestShopifySyncRes.data?.[0] ?? null,
  };
}
