import { supabase } from "@/lib/supabase";

export async function getDashboardStats() {
  // produkter uten lokasjon
  const { count: missingLocationCount } = await supabase
    .from("inventory")
    .select("*", { count: "exact", head: true })
    .is("location_id", null);

  // produkter uten SKU
  const { count: missingSkuCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .is("sku", null);

  // aktive lokasjoner uten varer
  const { count: emptyLocationCount } = await supabase
    .from("locations")
    .select("id, inventory(id)", { count: "exact", head: true })
    .eq("active", true)
    .eq("inventory.id", null);

  return {
    missingLocationCount: missingLocationCount ?? 0,
    missingSkuCount: missingSkuCount ?? 0,
    emptyLocationCount: emptyLocationCount ?? 0,
  };
}