import {
  ShopifyInventoryWorkerError,
  adjustShopifyInventoryForWarehouseSale,
} from "./shopify-inventory-client.ts";
import type {
  ShopifyInventoryAdjustmentResult,
  WarehouseSaleShopifyClaim,
} from "./shopify-worker-types.ts";

export interface WarehouseSaleShopifyJobStore {
  claim(): Promise<WarehouseSaleShopifyClaim>;
  getAccessToken(shop: string): Promise<string>;
  complete(
    jobId: string,
    leaseToken: string,
    result: ShopifyInventoryAdjustmentResult
  ): Promise<void>;
  fail(
    jobId: string,
    leaseToken: string,
    error: ShopifyInventoryWorkerError,
    retryDelaySeconds: number | null
  ): Promise<void>;
}

export type WarehouseSaleShopifyWorkerResult =
  | { status: "idle" }
  | { status: "synced"; jobId: string; attemptCount: number }
  | {
      status: "failed";
      jobId: string;
      attemptCount: number;
      errorCode: string;
      retryScheduled: boolean;
      resultUnknown: boolean;
    };

export function retryDelaySeconds(attemptCount: number): number {
  return Math.min(3600, 30 * 2 ** Math.max(0, attemptCount - 1));
}

export async function runWarehouseSaleShopifyWorker(
  store: WarehouseSaleShopifyJobStore,
  adjust: typeof adjustShopifyInventoryForWarehouseSale =
    adjustShopifyInventoryForWarehouseSale
): Promise<WarehouseSaleShopifyWorkerResult> {
  const claim = await store.claim();
  if (!claim.acquired) return { status: "idle" };

  try {
    const accessToken = await store.getAccessToken(claim.shop);
    const result = await adjust({ claim, accessToken });
    await store.complete(claim.jobId, claim.leaseToken, result);
    return {
      status: "synced",
      jobId: claim.jobId,
      attemptCount: claim.attemptCount,
    };
  } catch (cause) {
    const error =
      cause instanceof ShopifyInventoryWorkerError
        ? cause
        : new ShopifyInventoryWorkerError(
            cause instanceof Error ? cause.message : "Ukjent worker-feil",
            "WORKER_INTERNAL",
            "transient"
          );
    const retryDelay =
      error.kind === "permanent"
        ? null
        : retryDelaySeconds(claim.attemptCount);
    await store.fail(
      claim.jobId,
      claim.leaseToken,
      error,
      retryDelay
    );
    return {
      status: "failed",
      jobId: claim.jobId,
      attemptCount: claim.attemptCount,
      errorCode: error.code,
      retryScheduled: retryDelay !== null,
      resultUnknown: error.kind === "unknown",
    };
  }
}
