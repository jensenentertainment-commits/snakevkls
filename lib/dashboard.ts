import { supabaseAdmin } from "@/lib/supabase/admin";

const supabase = supabaseAdmin;

export async function getDashboardStats() {
  const [
    missingLocationRes,
    missingSkuRes,
    emptyLocationRes,
    productsRes,
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
      .eq("inventory.id", null),

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

  const products = productsRes.data ?? [];

  const placedProductCount = products.filter((product) =>
    product.inventory?.some((item) => item.location_id)
  ).length;

  const quantityDiffCount = products.filter((product) => {
    const snakeQuantity =
      product.inventory?.reduce(
        (sum, item) => sum + (item.quantity ?? 0),
        0
      ) ?? 0;

    return (product.shopify_quantity ?? 0) - snakeQuantity !== 0;
  }).length;

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