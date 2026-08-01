import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ShopifyInventoryWorkerError } from "./shopify-inventory-client.ts";
import type {
  ShopifyInventoryAdjustmentResult,
  WarehouseSaleShopifyClaim,
} from "./shopify-worker-types.ts";
import type { WarehouseSaleShopifyJobStore } from "./shopify-worker-engine.ts";

function rpcResult<T>(
  data: unknown,
  error: { message?: string } | null
): T {
  if (error) throw new Error(error.message ?? "Databasefeil");
  return data as T;
}

export function createWarehouseSaleShopifyJobStore(): WarehouseSaleShopifyJobStore {
  const admin = getSupabaseAdmin();

  return {
    async claim() {
      const { data, error } = await admin.rpc(
        "claim_warehouse_sale_shopify_sync_job",
        { requested_lease_seconds: 60 }
      );
      return rpcResult<WarehouseSaleShopifyClaim>(data, error);
    },

    async getAccessToken(shop) {
      const { data, error } = await admin
        .from("shopify_connections")
        .select("access_token, scopes")
        .eq("shop", shop)
        .single();
      if (error || !data?.access_token) {
        throw new ShopifyInventoryWorkerError(
          "Shopify-forbindelsen finnes ikke",
          "SHOPIFY_CONNECTION_MISSING",
          "permanent"
        );
      }
      const scopes = String(data.scopes ?? "")
        .split(",")
        .map((scope) => scope.trim());
      if (!scopes.includes("write_inventory")) {
        throw new ShopifyInventoryWorkerError(
          "Shopify-forbindelsen mangler write_inventory",
          "SHOPIFY_SCOPE_MISSING",
          "permanent"
        );
      }
      return String(data.access_token);
    },

    async complete(jobId, leaseToken, result: ShopifyInventoryAdjustmentResult) {
      const { error } = await admin.rpc(
        "complete_warehouse_sale_shopify_sync_job",
        {
          requested_job_id: jobId,
          requested_lease_token: leaseToken,
          requested_adjustment_group_id: result.adjustmentGroupId,
        }
      );
      rpcResult<void>(null, error);
    },

    async fail(jobId, leaseToken, failure, retryDelaySeconds) {
      const { error } = await admin.rpc(
        "fail_warehouse_sale_shopify_sync_job",
        {
          requested_job_id: jobId,
          requested_lease_token: leaseToken,
          requested_error_code: failure.code,
          requested_error_message: failure.message,
          requested_retry_delay_seconds: retryDelaySeconds,
        }
      );
      rpcResult<void>(null, error);
    },
  };
}
