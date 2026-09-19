import type { ReadCapabilityDefinition } from "../capability";

export const shopifyReadCatalogCapability = {
  id: "shopify.read_catalog",
  effect: "read",
  dataSourceIds: [
    "varekompaniet.knowledge",
    "shopify.catalog_products",
    "shopify.product_collections",
  ],
} as const satisfies ReadCapabilityDefinition;

export const shopifyPhase2aReadCatalogCapability = {
  ...shopifyReadCatalogCapability,
  dataSourceIds: [...shopifyReadCatalogCapability.dataSourceIds,
    "shopify.canonical_product_content", "shopify.canonical_product_collections", "shopify.catalog_foundation_v1"],
} as const satisfies ReadCapabilityDefinition;
