export type WarehouseSaleShopifyPayload = {
  schemaVersion: 1;
  locationId: string;
  changes: Array<{
    productId: string;
    saleLineId: string;
    inventoryItemId: string;
    delta: number;
  }>;
};

export type WarehouseSaleShopifyClaim =
  | { acquired: false }
  | {
      acquired: true;
      jobId: string;
      warehouseSaleId: string;
      shop: string;
      shopifyLocationId: string;
      idempotencyKey: string;
      referenceDocumentUri: string;
      payload: WarehouseSaleShopifyPayload;
      payloadHash: string;
      attemptCount: number;
      leaseToken: string;
      leaseExpiresAt: string;
    };

export type ShopifyWorkerFailureKind =
  | "transient"
  | "permanent"
  | "unknown";

export type ShopifyInventoryAdjustmentResult = {
  adjustmentGroupId: string;
};

