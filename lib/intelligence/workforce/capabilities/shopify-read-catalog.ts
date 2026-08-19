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
