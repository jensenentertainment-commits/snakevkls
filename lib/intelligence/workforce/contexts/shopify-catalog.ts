export type ShopifyCatalogProduct = {
  /** Internal grouping key. Never render this in normal user output. */
  shopifyProductId: string;
  sku: string | null;
  /** Internal selected/representative variant key. Never render it. */
  shopifyVariantId: string | null;
  variantName: string | null;
  productName: string;
  vendor: string | null;
  productType: string | null;
  status: string | null;
  priceMinor: number | null;
  currency: string | null;
  quantity: number | null;
  imageReference: string | null;
  syncedAt: string | null;
  inventoryTracked: boolean | null;
  inventoryObservedAt: string | null;
  collections: readonly { title: string; handle: string | null }[];
  variants: readonly ShopifyCatalogVariant[];
  /** Deterministic comparison of parent fields repeated on variant rows. */
  hasProductFieldConflicts: boolean;
};

export type ShopifyCatalogVariant = {
  shopifyVariantId: string | null;
  sku: string | null;
  variantName: string | null;
  priceMinor: number | null;
  currency: string | null;
  quantity: number | null;
  inventoryTracked: boolean | null;
  inventoryObservedAt: string | null;
  syncedAt: string | null;
};

export type RoyCatalogEntityScope = "product" | "variant" | "catalog";

export type RoyCatalogAuditFinding = {
  code:
    | "missing_product_type"
    | "missing_vendor"
    | "missing_featured_image_reference"
    | "missing_sku"
    | "inconsistent_product_fields"
    | "exact_duplicate_product_name";
  scope: "product" | "variant";
  count: number;
  evidence: readonly string[];
};

export type RoyCatalogAuditCode = RoyCatalogAuditFinding["code"];

export type RoyCatalogAudit = {
  productCount: number;
  variantCount: number;
  findings: readonly RoyCatalogAuditFinding[];
  freshness: { oldestSyncedAt: string | null; newestSyncedAt: string | null };
  deferred: readonly string[];
};

export const ROY_RECEIVED_CATALOG_FIELDS = [
  "productName",
  "sku",
  "vendor",
  "productType",
  "priceMinor",
  "currency",
  "quantity",
  "status",
  "collections",
  "variantName",
  "imageReference",
  "syncedAt",
  "inventoryTracked",
  "inventoryObservedAt",
] as const;

export type RoyReceivedCatalogField =
  (typeof ROY_RECEIVED_CATALOG_FIELDS)[number];

export type ShopifyCatalogContext = {
  intent: RoyQueryIntent;
  query: string;
  scope: "targeted_catalog_sample" | "catalog_filter" | "knowledge_gap";
  entityScope: RoyCatalogEntityScope;
  resultLimit: number;
  receivedFields: readonly RoyReceivedCatalogField[];
  products: readonly ShopifyCatalogProduct[];
  audit: RoyCatalogAudit | null;
  /** The deterministic finding requested by a focused audit question. */
  auditSelection: RoyCatalogAuditCode | null;
  limitations: readonly string[];
};
import type { RoyQueryIntent } from "../../roy/query-intent.ts";
