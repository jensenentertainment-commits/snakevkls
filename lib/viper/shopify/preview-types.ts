export type ShopifyPreviewReasonCode =
  | "AUTH_SCOPE_MISSING"
  | "ORDER_NOT_FOUND"
  | "ORDER_CANCELLED"
  | "ORDER_CLOSED"
  | "ORDER_NOT_FULFILLABLE"
  | "PAYMENT_NOT_ELIGIBLE"
  | "FULFILLMENT_NOT_ELIGIBLE"
  | "NOTHING_TO_PICK"
  | "ORDER_TOO_LARGE"
  | "NON_PHYSICAL_LINE"
  | "VARIANT_MISSING"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "SKU_MISMATCH"
  | "INVENTORY_MISSING"
  | "LOCATION_MISSING"
  | "LOCATION_INACTIVE"
  | "INSUFFICIENT_PHYSICAL_STOCK"
  | "PICK_LOCATION_AMBIGUOUS"
  | "DUPLICATE_PICK_TARGET";

export type ShopifyPreviewReason = {
  code: ShopifyPreviewReasonCode;
  message: string;
  lineId?: string;
};

export type ShopifyOrderPreviewLine = {
  lineId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  requestedQuantity: number;
  variantId: string | null;
  productName: string | null;
  snakeSku: string | null;
  locationCode: string | null;
  availableQuantity: number | null;
  importable: boolean;
  reasons: ShopifyPreviewReason[];
};

export type ShopifyOrderPreview = {
  order: {
    id: string;
    legacyResourceId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    financialStatus: string | null;
    fulfillmentStatus: string | null;
  };
  importable: boolean;
  reasons: ShopifyPreviewReason[];
  lines: ShopifyOrderPreviewLine[];
};

export type ShopifyPreviewApiResponse =
  | { ok: true; preview: ShopifyOrderPreview }
  | {
      ok: false;
      error: string;
      code?: ShopifyPreviewReasonCode | "INVALID_ORDER_ID" | "SHOPIFY_ERROR";
    };

export type ShopifyOrderImportResult = {
  orderId: string;
  pickJobId: string;
  orderNumber: string;
  orderStatus: "received" | "ready_to_pick" | "picking" | "picked" | "cancelled";
  pickJobStatus: "ready" | "in_progress" | "completed" | "cancelled";
  lineCount: number;
  idempotent: boolean;
};

export type ShopifyImportApiResponse =
  | { ok: true; result: ShopifyOrderImportResult }
  | {
      ok: false;
      error: string;
      code:
        | ShopifyPreviewReasonCode
        | "INVALID_ORDER_ID"
        | "PREVIEW_STALE"
        | "ORDER_NOT_IMPORTABLE"
        | "SHOPIFY_ERROR"
        | "FEATURE_DISABLED"
        | "MATERIALIZATION_FAILED";
    };
