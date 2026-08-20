export type ShopifyCatalogProduct = {
  sku: string | null;
  productName: string;
  vendor: string | null;
  productType: string | null;
  status: string | null;
  priceMinor: number | null;
  currency: string | null;
  quantity: number | null;
  collections: readonly { title: string; handle: string | null }[];
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
] as const;

export type RoyReceivedCatalogField =
  (typeof ROY_RECEIVED_CATALOG_FIELDS)[number];

export type ShopifyCatalogContext = {
  intent: RoyQueryIntent;
  query: string;
  scope: "targeted_catalog_sample" | "catalog_filter" | "knowledge_gap";
  resultLimit: number;
  receivedFields: readonly RoyReceivedCatalogField[];
  products: readonly ShopifyCatalogProduct[];
  limitations: readonly string[];
};
import type { RoyQueryIntent } from "../../roy/query-intent.ts";
