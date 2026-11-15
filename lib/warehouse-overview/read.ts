import "server-only";
import { requireRole } from "@/lib/auth/require-role";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getViperQueue } from "@/lib/viper/orders/repository";
import { inventoryIssues, readAllIssuePages, type IssueProduct, type IssueInventory, type IssueLocation } from "@/lib/inventory/issues";
import { collectOverview, type CountWork, type WarehouseActivity } from "./model";

export async function readWarehouseOverview() {
  // Authorize before any privileged reads, matching the existing counting route.
  const auth = await requireRole(["admin", "user", "warehouse"]);
  if (!auth.ok) return { ok: false as const, status: auth.response.status };
  const client = auth.authClient;
  const data = await collectOverview({
    issues: async () => {
      const [products, inventory, locations] = await Promise.all([
        readAllIssuePages<IssueProduct>((from, to) => client.from("products").select("id,sku,product_name,variant_name").order("id").range(from, to)),
        readAllIssuePages<IssueInventory>((from, to) => client.from("inventory").select("id,product_id,quantity,location_id,zone_id").order("id").range(from, to)),
        readAllIssuePages<IssueLocation>((from, to) => client.from("locations").select("id,code,active,zone_id,zones(id,code)").order("id").range(from, to) as unknown as PromiseLike<{data: IssueLocation[] | null; error: unknown}>),
      ]);
      return inventoryIssues(products, inventory, locations).list;
    },
    counts: async () => {
      // Sessions are service-only; never expose the admin client to the browser.
      const { data, count, error } = await getSupabaseAdmin().from("location_count_sessions")
        .select("id,location_code,updated_at", { count: "exact" }).eq("status", "active")
        .order("updated_at", { ascending: false }).order("id").limit(3);
      if (error || !data || count === null) throw new Error("Count overview unavailable");
      return { items: data as CountWork[], total: count };
    },
    picks: () => getViperQueue({ id: auth.user.id, email: auth.user.email ?? null,
      displayName: auth.profile.display_name, role: auth.profile.role }),
    activity: async () => {
      const { data, error } = await client.from("activity_log")
        .select("id,title,description,created_at")
        .in("entity_type", ["product", "inventory", "location", "zone", "stock_movement"])
        .order("created_at", { ascending: false }).order("id").limit(5);
      if (error || !data) throw new Error("Activity unavailable");
      return data as WarehouseActivity[];
    },
  });
  return { ok: true as const, data };
}
