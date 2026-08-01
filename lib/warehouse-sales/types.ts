export const WAREHOUSE_SALE_STATUS = ["completed"] as const;
export type WarehouseSaleStatus = (typeof WAREHOUSE_SALE_STATUS)[number];

export const WAREHOUSE_SALE_PAYMENT_METHODS = ["vipps", "cash"] as const;
export type WarehouseSalePaymentMethod =
  (typeof WAREHOUSE_SALE_PAYMENT_METHODS)[number];

export const SHOPIFY_SYNC_JOB_STATUSES = [
  "pending",
  "processing",
  "synced",
  "failed",
] as const;
export type ShopifySyncJobStatus =
  (typeof SHOPIFY_SYNC_JOB_STATUSES)[number];

export type WarehouseSaleRow = {
  id: string;
  saleNumber: string;
  status: WarehouseSaleStatus;
  paymentMethod: WarehouseSalePaymentMethod;
  currency: string;
  totalAmountMinor: number;
  totalQuantity: number;
  lineCount: number;
  completedAt: string;
  completedBy: string;
  completedByName: string;
  createdAt: string;
};

export type WarehouseSaleLineRow = {
  id: string;
  saleId: string;
  lineNumber: number;
  productId: string;
  sku: string | null;
  productName: string;
  variantName: string | null;
  standardUnitPriceMinor: number;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  priceOverridden: boolean;
  createdAt: string;
};

export type WarehouseSaleShopifyChange = {
  productId: string;
  saleLineId: string;
  inventoryItemId: string;
  delta: number;
};

export type WarehouseSaleShopifyPayload = {
  schemaVersion: 1;
  locationId: string;
  changes: WarehouseSaleShopifyChange[];
};

export type WarehouseSaleShopifySyncJobRow = {
  id: string;
  warehouseSaleId: string;
  status: ShopifySyncJobStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  syncedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompleteWarehouseSaleLineInput = {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
};

export type CompleteWarehouseSaleInput = {
  idempotencyKey: string;
  paymentMethod: WarehouseSalePaymentMethod;
  lines: CompleteWarehouseSaleLineInput[];
  requestHash: string;
};

export type CompleteWarehouseSaleResult = {
  saleId: string;
  saleNumber: string;
  status: "completed";
  totalAmountMinor: number;
  totalQuantity: number;
  lineCount: number;
  completedAt: string;
  shopifySyncStatus: ShopifySyncJobStatus;
  idempotentReplay: boolean;
};
