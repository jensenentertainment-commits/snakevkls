import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { runWarehouseSaleShopifyWorker } from "./shopify-worker-engine";
import { createWarehouseSaleShopifyJobStore } from "./shopify-worker-store";

export type WarehouseSaleShopifyQueueSummary = {
  pendingCount: number;
  failedCount: number;
};

export async function getWarehouseSaleShopifyQueueSummary(): Promise<WarehouseSaleShopifyQueueSummary> {
  const admin = getSupabaseAdmin();
  const [pending, failed] = await Promise.all([
    admin
      .from("warehouse_sale_shopify_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("warehouse_sale_shopify_sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
  ]);

  if (pending.error) throw pending.error;
  if (failed.error) throw failed.error;

  return {
    pendingCount: pending.count ?? 0,
    failedCount: failed.count ?? 0,
  };
}

export async function runNextWarehouseSaleShopifyJob() {
  return runWarehouseSaleShopifyWorker(
    createWarehouseSaleShopifyJobStore(),
  );
}
